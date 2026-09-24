// O painel de baixo e o que ele mostra: construir, mercado, castelo, reinos,
// o objetivo e a ficha de uma casa do mapa.
//
// O conteúdo é HTML montado aqui e redesenhado de tempos a tempos enquanto o
// painel está aberto (os preços mudam, os bens entram). Os cliques vão todos
// por delegação no corpo do painel, com `data-action`, por isso sobrevivem a
// cada redesenho — e o redesenho espera que o dedo saia do painel, para um
// toque a meio não perder o botão debaixo dele.

import { escapeHtml } from '/lib/arcade/index.js';

import {
    BUILDING, BUILDINGS, DEMOLISH_REFUND, RESOURCE, TOWNS
} from './config.js';
import {
    canAfford, checkPlacement, countOf, inTerritory, missingFor, nextCastleLevel
} from './buildings.js';
import { fmt, fmtPrice, pct } from './format.js';
import { TRADABLE, buyPrice, priceTrend, sellPrice } from './market.js';
import { currentQuest } from './quests.js';
import { castleInfo, game } from './state.js';
import { townProsperity } from './towns.js';
import { els } from './ui.js';
import { T_HILL, T_WATER, countFeatureNear, idx } from './world.js';

let actions = {};
/** { name, arg } do painel aberto, ou null. */
let open = null;
let pointerInside = false;
let lastHtml = '';

export function initSheets(handlers) {
    actions = handlers;
    els.sheetCloseBtn.addEventListener('click', closeSheet);
    els.sheet.addEventListener('pointerdown', () => { pointerInside = true; });
    window.addEventListener('pointerup', () => { pointerInside = false; });
    window.addEventListener('pointercancel', () => { pointerInside = false; });
    els.sheetBody.addEventListener('click', (event) => {
        const el = event.target.closest('[data-action]');
        if (!el || el.disabled || !els.sheetBody.contains(el)) return;
        actions[el.dataset.action]?.(el.dataset.arg, el.dataset.n);
        refreshSheet(true);
    });
}

export const sheetOpen = () => open?.name ?? null;

export function openSheet(name, arg = null) {
    open = { name, arg };
    els.sheet.hidden = false;
    els.sheetBody.scrollTop = 0;
    lastHtml = '';
    refreshSheet(true);
    for (const btn of els.toolbar.querySelectorAll('.toolBtn')) {
        btn.classList.toggle('active', btn.dataset.sheet === name);
    }
}

export function closeSheet() {
    open = null;
    els.sheet.hidden = true;
    for (const btn of els.toolbar.querySelectorAll('.toolBtn')) btn.classList.remove('active');
    actions.onClose?.();
}

/** Redesenha o painel aberto. Sem `force`, não mexe enquanto o dedo estiver lá dentro. */
export function refreshSheet(force = false) {
    if (!open || (!force && pointerInside)) return;
    const view = VIEWS[open.name]?.(open.arg);
    if (!view) {
        closeSheet();
        return;
    }
    els.sheetIcon.textContent = view.icon;
    els.sheetTitle.textContent = view.title;
    els.sheetSub.textContent = view.sub || '';
    if (view.html !== lastHtml) {
        const scroll = els.sheetBody.scrollTop;
        els.sheetBody.innerHTML = view.html;
        els.sheetBody.scrollTop = scroll;
        lastHtml = view.html;
    }
}

// ---------- Peças de HTML ----------

function costHtml(cost = {}) {
    return `<span class="costRow">${Object.entries(cost).map(([res, amount]) => {
        const short = (game.res[res] || 0) < amount;
        return `<span class="cost${short ? ' is-short' : ''}">${RESOURCE[res].emoji} ${fmt(amount)}</span>`;
    }).join('')}</span>`;
}

function recipeText(def) {
    if (def.recipe) {
        const side = (map) => Object.entries(map || {}).map(([r, n]) => `${n} ${RESOURCE[r].emoji}`).join(' + ');
        const input = side(def.recipe.in);
        return `${input ? `${input} → ` : ''}${side(def.recipe.out)} a cada ${def.recipe.time} s`;
    }
    if (def.id === 'field') return `${def.yield} ${RESOURCE.wheat.emoji} por colheita (${def.grow} s a crescer)`;
    if (def.id === 'house') return `+${def.residents} moradores`;
    if (def.plants) return `Uma árvore a cada ${def.plants.time} s, até ${def.plants.radius} casas à volta`;
    if (def.farms) return `Semeia e colhe os campos até ${def.farms.radius} casas à volta`;
    return '';
}

function stat(value, label) {
    return `<div class="stat"><span class="statValue">${value}</span><span class="statLabel">${label}</span></div>`;
}

// ---------- Vistas ----------

function buildView() {
    // Por escalão: um edifício novo entra no fim de `BUILDINGS` (a gravação
    // guarda o índice), mas no painel aparece junto dos do seu escalão.
    const cards = [...BUILDINGS].sort((a, b) => a.tier - b.tier).map((def) => {
        const check = checkPlacement(def.id);
        const locked = def.tier > castleInfo().tier;
        let note = '';
        if (locked) note = `🔒 Castelo nível ${def.tier}`;
        else if (def.unique && countOf(def.id)) note = '✓ Já construído';
        else if (!canAfford(def.cost)) note = `Faltam ${missingFor(def.cost).map((m) => `${m.missing} ${RESOURCE[m.res].emoji}`).join(', ')}`;
        const workers = def.workers ? ` · 👷 ${def.workers}` : '';
        return `<button class="buildCard${locked ? ' is-locked' : ''}" type="button" data-action="place" data-arg="${def.id}"${check.ok ? '' : ' aria-disabled="true"'}>
            <span class="cardIcon" aria-hidden="true">${def.emoji}</span>
            <span class="cardName">${def.name}</span>
            ${costHtml(def.cost)}
            <span class="cardDesc">${escapeHtml(recipeText(def))}${workers}</span>
            ${note ? `<span class="cardNote">${note}</span>` : ''}
        </button>`;
    }).join('');
    return {
        icon: '🔨',
        title: 'Construir',
        sub: 'Escolhe um edifício e toca no mapa, dentro do território.',
        html: `<div class="buildGrid">${cards}</div>`
    };
}

function marketView() {
    if (!countOf('market')) {
        return {
            icon: '⚖️',
            title: 'Mercado',
            sub: 'Ainda não há mercado no reino.',
            html: `<p class="sheetText">Sem mercado não há comércio: as vilas vizinhas só compram e vendem a quem tem onde as receber.
                Constrói um <b>Mercado</b> dentro do território.</p>
                <div class="sheetActions"><button class="btn" type="button" data-action="place" data-arg="market">⚖️ Construir o mercado</button></div>`
        };
    }

    const fair = game.market.fair;
    const fairHtml = fair
        ? `<div class="fairNote"><span aria-hidden="true">🎪</span><span>Feira em <b>${TOWNS[fair.town].name}</b> até ao dia ${fair.until}:
            ${RESOURCE[fair.good].emoji} ${RESOURCE[fair.good].name.toLowerCase()} muito procurado.</span></div>`
        : '';

    const storage = game.derived.storage;
    const rows = TRADABLE.map((good) => {
        const res = RESOURCE[good];
        const have = Math.floor(game.res[good]);
        const trend = priceTrend(good);
        const arrow = trend > 0 ? '<span class="trend up">▲</span>' : trend < 0 ? '<span class="trend down">▼</span>' : '';
        const buyCost = buyPrice(good) * 5;
        return `<div class="marketRow">
            <span class="goodName"><span class="goodEmoji" aria-hidden="true">${res.emoji}</span>
                <span>${res.name}<span class="goodStock">no armazém: ${fmt(have)} / ${fmt(storage)}</span></span></span>
            <span class="goodPrice">💰 ${fmtPrice(sellPrice(good))}${arrow}</span>
            <span class="tradeBtns">
                <button class="tradeBtn tradeBtn--sell" type="button" data-action="sell" data-arg="${good}" data-n="1"${have < 1 ? ' disabled' : ''}>Vender 1</button>
                <button class="tradeBtn tradeBtn--sell" type="button" data-action="sell" data-arg="${good}" data-n="10"${have < 10 ? ' disabled' : ''}>Vender 10</button>
                <button class="tradeBtn tradeBtn--sell" type="button" data-action="sell" data-arg="${good}" data-n="all"${have < 1 ? ' disabled' : ''}>Tudo</button>
                <button class="tradeBtn tradeBtn--buy" type="button" data-action="buy" data-arg="${good}" data-n="5"${game.res.coins < buyCost || have + 5 > storage ? ' disabled' : ''}>Comprar 5 · ${fmtPrice(buyPrice(good))}</button>
            </span>
        </div>`;
    }).join('');

    return {
        icon: '⚖️',
        title: 'Mercado',
        sub: 'Vender muito de uma vez baixa o preço. As vilas pagam mais pelo que lhes falta.',
        html: fairHtml + rows
    };
}

function castleView() {
    const info = castleInfo();
    const d = game.derived;
    const next = nextCastleLevel();
    let nextHtml = '<p class="sheetText">O castelo está no nível máximo. O reino não tem fim: continua a crescer!</p>';
    if (next) {
        const unlocks = BUILDINGS.filter((b) => b.tier === next.tier && b.tier > info.tier).map((b) => `${b.emoji} ${b.name}`);
        nextHtml = `<span class="sectionLabel">Nível ${next.level}</span>
            <p class="sheetText">Território até <b>${next.radius} casas</b>, armazém de <b>${fmt(next.storage)}</b>,
                <b>+${next.residents - info.residents}</b> moradores no castelo${unlocks.length ? `, e abre: <b>${unlocks.join(', ')}</b>` : ''}.</p>
            <div style="margin-top:8px">${costHtml(next.cost)}</div>
            <div class="sheetActions">
                <button class="btn" type="button" data-action="upgrade"${canAfford(next.cost) ? '' : ' disabled'}>🏰 Subir ao nível ${next.level}</button>
            </div>`;
    }
    return {
        icon: '🏰',
        title: `Castelo · nível ${game.castleLevel}`,
        sub: 'O coração do reino: quanto maior, mais longe se constrói.',
        html: `<div class="sheetSection"><div class="statGrid">
                ${stat(fmt(d.prosperity), 'prosperidade')}
                ${stat(`💰 ${fmt(d.taxPerDay)}`, 'impostos por dia')}
                ${stat(`👥 ${d.residents}`, `moradores (${d.workersUsed} a trabalhar)`)}
                ${stat(pct(game.happy), 'contentamento')}
                ${stat(fmt(d.storage), 'armazém por bem')}
                ${stat(`${info.radius} casas`, 'território')}
            </div></div>
            <div class="sheetSection">
                <p class="sheetText">O povo come ao fim de cada dia: 🧀 queijo, 🍞 pão ou 🥛 leite. Bem alimentado — e com mais de
                    um tipo de comida — fica contente e paga mais impostos.</p>
            </div>
            <div class="sheetSection">${nextHtml}</div>`
    };
}

function kingdomsView() {
    const player = { name: actions.playerName?.() || 'O teu reino', score: game.derived.prosperity, player: true, sub: `Castelo nível ${game.castleLevel} · ${game.buildings.length} edifícios` };
    const towns = game.towns.map((town, k) => {
        const def = TOWNS[k];
        return {
            name: `${def.emoji} ${def.name}`,
            color: def.roof,
            score: townProsperity(k),
            sub: `faz ${def.supplies.map((r) => RESOURCE[r].emoji).join('')} · procura ${def.demands.map((r) => RESOURCE[r].emoji).join('')} · ${town.n} edifícios`
        };
    });
    const rows = [player, ...towns].sort((a, b) => b.score - a.score).map((row, i) => `
        <div class="rankRow${row.player ? ' is-player' : ''}">
            <span class="rankPos">${i + 1}</span>
            <span class="rankName">${row.color ? `<span class="swatch" style="background:${row.color}"></span>` : '👑 '}${escapeHtml(row.name)}<small>${row.sub}</small></span>
            <span class="rankScore">${fmt(row.score)}</span>
        </div>`).join('');
    return {
        icon: '👑',
        title: 'Reinos',
        sub: 'A prosperidade de cada um. Aqui ninguém faz guerra: ganha quem mais cresce.',
        html: `<div class="rankList">${rows}</div>
            <p class="sheetText" style="margin-top:12px">As vilas crescem sozinhas e comerciam entre si — vêem-se as caravanas a passar.
                O que produzem fica barato no mercado; o que procuram, caro.</p>`
    };
}

function questView() {
    const quest = currentQuest();
    const reward = Object.entries(quest.reward).map(([r, n]) => `${fmt(n)} ${RESOURCE[r].emoji}`).join(' + ');
    return {
        icon: '📜',
        title: 'Objetivo',
        sub: `Objetivo ${game.questIndex + 1}`,
        html: `<p class="sheetText"><b>${escapeHtml(quest.text)}</b></p>
            <p class="sheetText" style="margin-top:6px">${escapeHtml(quest.hint)}</p>
            <p class="sheetText" style="margin-top:10px">Recompensa: <b>${reward}</b></p>`
    };
}

const STATUS_TEXT = {
    ok: ['ok', '✅ A trabalhar'],
    noWorkers: ['bad', '💤 Sem trabalhadores — constrói mais casas'],
    noInput: ['warn', '⏳ À espera de matéria-prima'],
    full: ['warn', '📦 Armazém cheio — vende ou sobe o castelo'],
    noNear: ['bad', '🚫 Não há nada à volta para aproveitar'],
    paused: ['warn', '⏸️ Parado por ordem tua — os trabalhadores ficam livres']
};

function tileView(arg) {
    const [x, y] = String(arg).split(',').map(Number);
    const world = game.world;
    const i = idx(x, y);
    const b = world.building[i];

    if (b && b.owner !== 'player') {
        const town = TOWNS[b.owner];
        const def = BUILDING[b.kind];
        return {
            icon: b.kind === 'keep' ? '🏯' : def?.emoji || '🏠',
            title: b.kind === 'keep' ? `Castelo de ${town.name}` : `${def?.name || 'Edifício'} de ${town.name}`,
            sub: 'Uma vila vizinha, governada pelo CPU.',
            html: `<p class="sheetText">${town.name} faz ${town.supplies.map((r) => `${RESOURCE[r].emoji} ${RESOURCE[r].name.toLowerCase()}`).join(' e ')}
                e procura ${town.demands.map((r) => `${RESOURCE[r].emoji} ${RESOURCE[r].name.toLowerCase()}`).join(', ')}.
                Vende-lhe o que procura no ⚖️ Mercado.</p>
                <div class="sheetActions"><button class="btnOutline" type="button" data-action="sheet" data-arg="kingdoms">👑 Ver os reinos</button></div>`
        };
    }

    if (b && b.owner === 'player') {
        const def = BUILDING[b.kind];
        let body = `<p class="sheetText">${escapeHtml(def.desc)}</p>`;
        const recipe = recipeText(def);
        if (recipe) body += `<p class="sheetText" style="margin-top:6px"><b>${escapeHtml(recipe)}</b>${def.workers ? ` · 👷 ${def.workers} trabalhador${def.workers > 1 ? 'es' : ''}` : ''}</p>`;

        if (b.kind === 'field') {
            const label = b.stage === 'ripe' ? '🌾 Pronto a colher' : b.stage === 'growing' ? `🌱 A crescer (${pct(b.growth)})` : '🟫 Terra lavrada, por semear';
            body += `<div class="sheetSection"><div class="statusLine ${b.stage === 'ripe' ? 'ok' : 'warn'}">${label}</div>
                ${b.stage === 'growing' ? `<div class="progressTrack" style="--fill:${pct(b.growth)}"></div>` : ''}</div>`;
            const act = b.stage === 'ripe' ? ['harvest', '🌾 Colher'] : b.stage === 'empty' ? ['plant', '🌱 Semear'] : null;
            if (act) body += `<div class="sheetActions"><button class="btn" type="button" data-action="${act[0]}" data-arg="${x},${y}">${act[1]}</button></div>`;
        } else if (def.recipe || def.plants || def.farms) {
            const [tone, text] = STATUS_TEXT[b.status] || STATUS_TEXT.ok;
            let extra = '';
            if (def.near) {
                const found = countFeatureNear(world, x, y, def.near.feature, def.near.radius);
                extra = ` · ${found} ${def.near.feature === 'tree' ? 'árvore(s)' : 'rocha(s)'} perto (${pct(Math.min(1, found / def.near.full))})`;
            }
            body += `<div class="sheetSection"><div class="statusLine ${tone}">${text}${extra}</div>
                <div class="progressTrack" style="--fill:${pct(Math.min(1, b.progress))}"></div></div>`;
        }

        const toggle = def.workers
            ? `<button class="btnOutline" type="button" data-action="toggle" data-arg="${x},${y}">${b.paused ? '▶️ Retomar o trabalho' : '⏸️ Parar (liberta os trabalhadores)'}</button>`
            : '';
        const refund = Object.entries(def.cost).map(([r, n]) => `${Math.floor(n * DEMOLISH_REFUND)} ${RESOURCE[r].emoji}`).join(' + ');
        body += `<div class="sheetActions">${toggle}<button class="btnOutline" type="button" data-action="demolish" data-arg="${x},${y}">🧱 Demolir (devolve ${refund})</button></div>`;
        return { icon: def.emoji, title: def.name, sub: `No mapa em ${x}, ${y}`, html: body };
    }

    // Natureza.
    const feature = world.feature[i];
    const terrain = world.terrain[i];
    const inside = inTerritory(x, y);
    const where = inside ? 'Dentro do teu território.' : 'Fora do território — sobe o castelo para chegar cá.';
    if (feature === 'tree') return { icon: '🌳', title: 'Árvore', sub: where, html: '<p class="sheetText">Um <b>🪓 Lenhador</b> até duas casas daqui corta madeira nesta árvore — e as árvores não acabam. Um <b>🌲 Guarda-florestal</b> planta mais.</p>' };
    if (feature === 'rock') return { icon: '🪨', title: 'Rochedo', sub: where, html: '<p class="sheetText">Uma <b>⛏️ Pedreira</b> até duas casas daqui tira pedra destas rochas.</p>' };
    if (feature === 'ore') {
        const ok = checkPlacement('goldmine', x, y);
        return {
            icon: '✨',
            title: 'Veia de ouro',
            sub: where,
            html: `<p class="sheetText">Ouro à vista! Uma <b>⛰️ Mina de ouro</b> constrói-se mesmo aqui, em cima da veia (precisa do castelo no nível 3).</p>
                <div class="sheetActions"><button class="btn" type="button" data-action="buildAt" data-arg="goldmine" data-n="${x},${y}"${ok.ok ? '' : ' disabled'}>⛰️ Construir a mina</button></div>`
        };
    }
    if (terrain === T_WATER) return { icon: '💧', title: 'Lago', sub: where, html: '<p class="sheetText">Água limpa. Não se constrói em cima dela, mas enfeita o reino.</p>' };
    if (terrain === T_HILL) return { icon: '⛰️', title: 'Colina', sub: where, html: '<p class="sheetText">Terreno alto e pedregoso. Só as minas se fazem nas colinas — procura as veias douradas.</p>' };
    return {
        icon: '🟩',
        title: 'Terreno livre',
        sub: where,
        html: `<p class="sheetText">${inside ? 'Aqui cabe um edifício.' : 'Ainda fora do alcance do castelo.'}</p>
            ${inside ? '<div class="sheetActions"><button class="btn" type="button" data-action="sheet" data-arg="build">🔨 Construir aqui perto</button></div>' : ''}`
    };
}

const VIEWS = {
    build: buildView,
    market: marketView,
    castle: castleView,
    kingdoms: kingdomsView,
    quest: questView,
    tile: tileView
};
