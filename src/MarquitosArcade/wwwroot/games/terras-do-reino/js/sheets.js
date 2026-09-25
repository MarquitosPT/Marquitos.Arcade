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
    BUILDING, BUILDINGS, CLEAR_COST, DEMOLISH_REFUND, FLATTEN_COST, FLATTEN_STONE, HAPPY_LEISURE, NEAR_FEATURES, RESOURCE, ROAD_COST,
    TOWNS
} from './config.js';
import {
    canAfford, canUpgradeCastle, castleNeeds, checkClear, checkFlatten, checkPlacement, countOf, inTerritory, missingFor,
    nextCastleLevel
} from './buildings.js';
import { fmt, fmtPrice, pct } from './format.js';
import { TRADABLE, buyPrice, priceTrend, sellPrice } from './market.js';
import { currentQuest } from './quests.js';
import { castleInfo, game } from './state.js';
import { townProsperity } from './towns.js';
import { els } from './ui.js';
import { ROAD_PLAYER, T_HILL, T_WATER, countFeatureNear, idx } from './world.js';

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

function servesText(def) {
    const uses = def.serves.uses ? `, 1 ${RESOURCE[def.serves.uses].emoji} por cada ${def.serves.per}` : '';
    return `Serve até ${def.serves.residents} moradores por dia${uses}`;
}

function recipeText(def) {
    if (def.recipe) {
        const side = (map) => Object.entries(map || {}).map(([r, n]) => `${n} ${RESOURCE[r].emoji}`).join(' + ');
        const input = side(def.recipe.in);
        const made = `${input ? `${input} → ` : ''}${side(def.recipe.out)} a cada ${def.recipe.time} s`;
        return def.serves ? `${made} · ${servesText(def)}` : made;
    }
    if (def.crop) return `${def.crop.yield} ${RESOURCE[def.crop.res].emoji} por colheita (${def.crop.grow} s a crescer)`;
    if (def.serves) return servesText(def);
    if (def.lodges) return `Até ${def.lodges.guests} visitantes por dia, a ${def.lodges.fee} 💰 cada, com uma refeição`;
    if (def.id === 'house') return `+${def.residents} moradores`;
    if (def.plants) return `Uma árvore a cada ${def.plants.time} s, até ${def.plants.radius} casas à volta`;
    if (def.farms) return `Semeia e colhe as culturas até ${def.farms.radius} casas à volta`;
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
    const road = `<button class="buildCard" type="button" data-action="place" data-arg="road"${canAfford(ROAD_COST) ? '' : ' aria-disabled="true"'}>
            <span class="cardIcon" aria-hidden="true">🛣️</span>
            <span class="cardName">Estrada de pedra</span>
            ${costHtml(ROAD_COST)}
            <span class="cardDesc">Por casa. Liga os edifícios: é por elas que o povo anda.</span>
        </button>`;
    return {
        icon: '🔨',
        title: 'Construir',
        sub: 'Escolhe um edifício e toca no mapa, dentro do território.',
        html: `<div class="buildGrid">${road}${cards}</div>`
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
        const needs = castleNeeds(next);
        const unlocks = BUILDINGS.filter((b) => b.tier === next.tier && b.tier > info.tier).map((b) => `${b.emoji} ${b.name}`);
        nextHtml = `<span class="sectionLabel">Nível ${next.level}</span>
            <p class="sheetText">Território até <b>${next.radius} casas</b>, armazém de <b>${fmt(next.storage)}</b>,
                <b>+${next.residents - info.residents}</b> moradores no castelo${unlocks.length ? `, e abre: <b>${unlocks.join(', ')}</b>` : ''}.</p>
            <div style="margin-top:8px">${costHtml(next.cost)}</div>
            ${needs.map((n) => `<div class="statusLine ${n.ok ? 'ok' : 'warn'}" style="margin-top:6px">${n.ok ? '✓' : '✗'} ${n.label}:
                ${n.percent ? `${pct(n.have)} de ${pct(n.need)}` : `${fmt(n.have)} de ${fmt(n.need)}`}</div>`).join('')}
            <div class="sheetActions">
                <button class="btn" type="button" data-action="upgrade"${canUpgradeCastle() ? '' : ' disabled'}>🏰 Subir ao nível ${next.level}</button>
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
                <p class="sheetText">O povo come ao fim de cada dia: 🎂 bolos, 🧀 queijo, 🍞 pão, 🍖 carne, 🍚 arroz, 🐟 peixe, 🥚 ovos ou 🥛 leite. Bem alimentado — e com mais de
                    um tipo de comida — fica contente e paga mais impostos.</p>
                ${leisureHtml()}
                ${guestsHtml()}
            </div>
            <div class="sheetSection">${nextHtml}</div>`
    };
}

/** O convívio e o luxo: que parte do povo a taberna, o teatro e a joalharia serviram no último fim de dia. */
function leisureHtml() {
    const served = game.derived.served || {};
    const rows = Object.entries(HAPPY_LEISURE).map(([kind, share]) => {
        const def = BUILDING[kind];
        if (def.tier > castleInfo().tier) return ['warn', `🔒 ${def.emoji} ${def.name}: castelo nível ${def.tier} (até +${pct(share)})`];
        const ratio = served[kind] || 0;
        return [ratio >= 0.995 ? 'ok' : 'warn', `${def.emoji} ${def.name}: ${pct(ratio)} do povo servido (até +${pct(share)})`];
    });
    const food = 1 - Object.values(HAPPY_LEISURE).reduce((a, b) => a + b, 0);
    return `<p class="sheetText" style="margin-top:6px">A comida leva o contentamento até ${pct(food)}; o resto é convívio,
        na 🍺 taberna (com vinho) e no 🎭 teatro, e o luxo das 💍 joias da joalharia.</p>
        ${rows.map(([tone, text]) => `<div class="statusLine ${tone}" style="margin-top:6px">${text}</div>`).join('')}`;
}

/** Os visitantes que os hotéis receberam no último fim de dia. */
function guestsHtml() {
    const inn = BUILDING.inn;
    if (inn.tier > castleInfo().tier) return `<div class="statusLine warn" style="margin-top:6px">🔒 ${inn.emoji} ${inn.name}: castelo nível ${inn.tier} (visitantes pagam a estadia)</div>`;
    if (!game.buildings.some((b) => b.kind === 'inn')) return '';
    const guests = game.derived.guests || 0;
    return `<div class="statusLine ${guests ? 'ok' : 'warn'}" style="margin-top:6px">${inn.emoji} ${inn.name}: ${guests} visitante${guests === 1 ? '' : 's'} no último dia
        (${fmt(guests * inn.lodges.fee)} 💰)</div>`;
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

/** Taberna e teatro abertos: a barra é o dia a passar, e ao fim dele servem o povo. */
const VENUE_OK = ['ok', '✅ Aberto — ao fim do dia recebe o povo'];
/** O hotel aberto: ao fim do dia chegam os visitantes. */
const INN_OK = ['ok', '✅ Aberto — ao fim do dia chegam os visitantes'];
/** O hotel sem nada na despensa: os visitantes não ficam. */
const INN_HUNGRY = ['warn', '🍽️ Sem comida na despensa — os visitantes não ficam'];

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

        if (def.crop) {
            const ripe = RESOURCE[def.crop.res].emoji;
            const label = b.stage === 'ripe' ? `${ripe} Pronto a colher` : b.stage === 'growing' ? `🌱 A crescer (${pct(b.growth)})` : '🟫 Terra lavrada, por semear';
            body += `<div class="sheetSection"><div class="statusLine ${b.stage === 'ripe' ? 'ok' : 'warn'}">${label}</div>
                ${b.stage === 'growing' ? `<div class="progressTrack" style="--fill:${pct(b.growth)}"></div>` : ''}</div>`;
            const act = b.stage === 'ripe' ? ['harvest', `${ripe} Colher`] : b.stage === 'empty' ? ['plant', '🌱 Semear'] : null;
            if (act) body += `<div class="sheetActions"><button class="btn" type="button" data-action="${act[0]}" data-arg="${x},${y}">${act[1]}</button></div>`;
        } else if (def.recipe || def.plants || def.farms || def.serves || def.lodges) {
            const venue = def.lodges ? { ok: INN_OK, noInput: INN_HUNGRY } : def.serves && !def.recipe ? { ok: VENUE_OK } : {};
            const [tone, text] = venue[b.status] || STATUS_TEXT[b.status] || STATUS_TEXT.ok;
            let extra = '';
            if (def.near) {
                const found = countFeatureNear(world, b.x, b.y, b.size, def.near.feature, def.near.radius);
                extra = ` · ${found} ${NEAR_FEATURES[def.near.feature].count} perto (${pct(Math.min(1, found / def.near.full))})`;
            }
            body += `<div class="sheetSection"><div class="statusLine ${tone}">${text}${extra}</div>
                <div class="progressTrack" style="--fill:${pct(Math.min(1, b.progress))}"></div></div>`;
        }

        const toggle = def.workers
            ? `<button class="btnOutline" type="button" data-action="toggle" data-arg="${x},${y}">${b.paused ? '▶️ Retomar o trabalho' : '⏸️ Parar (liberta os trabalhadores)'}</button>`
            : '';
        const refund = Object.entries(def.cost).map(([r, n]) => `${Math.floor(n * DEMOLISH_REFUND)} ${RESOURCE[r].emoji}`).join(' + ');
        body += `<div class="sheetActions">${toggle}<button class="btnOutline" type="button" data-action="demolish" data-arg="${x},${y}">🧱 Demolir (devolve ${refund})</button></div>`;
        return { icon: def.emoji, title: def.name, sub: `No mapa em ${b.x}, ${b.y}`, html: body };
    }

    // Natureza.
    const feature = world.feature[i];
    const terrain = world.terrain[i];
    const inside = inTerritory(x, y);
    const where = inside ? 'Dentro do teu território.' : 'Fora do território — sobe o castelo para chegar cá.';
    const road = world.road[i];
    if (road) {
        if (road !== ROAD_PLAYER) {
            return { icon: '🛣️', title: 'Rua', sub: 'De uma vila vizinha.', html: '<p class="sheetText">As vilas calcetam as ruas à volta de cada edifício que fazem — e a gente delas anda por aí.</p>' };
        }
        return {
            icon: '🛣️',
            title: 'Estrada de pedra',
            sub: where,
            html: `<p class="sheetText">O povo anda pelas estradas entre os edifícios que elas ligam: uma estrada tem de encostar a um edifício para lhe servir de porta.</p>
                <div class="sheetActions">
                    <button class="btn" type="button" data-action="roadFrom" data-arg="${x},${y}">🛣️ Continuar a estrada daqui</button>
                    <button class="btnOutline" type="button" data-action="unroad" data-arg="${x},${y}">🧱 Levantar este troço (devolve ${ROAD_COST.stone} ${RESOURCE.stone.emoji})</button>
                </div>`
        };
    }
    if (feature === 'tree') return clearView(x, y, { icon: '🌳', title: 'Árvore', sub: where, html: '<p class="sheetText">Um <b>🪓 Lenhador</b> aqui perto corta madeira nesta árvore — e as árvores não acabam. Um <b>🌲 Guarda-florestal</b> planta mais.</p>' });
    if (feature === 'rock') return clearView(x, y, { icon: '🪨', title: 'Rochedo', sub: where, html: '<p class="sheetText">Uma <b>⛏️ Pedreira</b> aqui perto tira pedra destas rochas.</p>' });
    if (feature === 'ore') {
        const ok = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => checkPlacement('goldmine', x + dx, y + dy).ok);
        return {
            icon: '✨',
            title: 'Veia de ouro',
            sub: where,
            html: `<p class="sheetText">Ouro à vista! Uma <b>⛰️ Mina de ouro</b> constrói-se mesmo aqui, em cima da veia, se as casas de colina à volta estiverem limpas (precisa do castelo no nível 3).</p>
                <div class="sheetActions"><button class="btn" type="button" data-action="buildAt" data-arg="goldmine" data-n="${x},${y}"${ok ? '' : ' disabled'}>⛰️ Construir a mina</button></div>`
        };
    }
    if (terrain === T_WATER) return { icon: '💧', title: 'Lago', sub: where, html: '<p class="sheetText">Água limpa. Não se constrói em cima dela, mas uma <b>🎣 Cabana de pesca</b> na margem manda os pescadores de barco pescar aqui.</p>' };
    if (terrain === T_HILL) return hillView(x, y, feature, where);
    return {
        icon: '🟩',
        title: 'Terreno livre',
        sub: where,
        html: `<p class="sheetText">${inside ? 'Aqui cabe um edifício.' : 'Ainda fora do alcance do castelo.'}</p>
            ${inside ? `<div class="sheetActions"><button class="btn" type="button" data-action="sheet" data-arg="build">🔨 Construir aqui perto</button>
                <button class="btnOutline" type="button" data-action="roadFrom" data-arg="${x},${y}">🛣️ Estrada a partir daqui</button></div>` : ''}`
    };
}

/** A ficha de uma árvore ou de um rochedo, com o botão para limpar a casa quando está no território. */
function clearView(x, y, view) {
    if (!checkClear(x, y, { ignoreCost: true }).ok) return view;
    const tree = game.world.feature[idx(x, y)] === 'tree';
    const cost = CLEAR_COST[tree ? 'tree' : 'rock'];
    const ok = canAfford(cost);
    const [what, button] = tree
        ? ['os lenhadores cortam a árvore e arrancam o cepo', '🪓 Cortar a árvore']
        : ['os cavouqueiros partem o rochedo e levam os cacos', '⛏️ Partir o rochedo'];
    view.html += `<div class="sheetSection">
            <p class="sheetText">🧹 <b>Limpar</b>: ${what}, e a casa fica livre para construir ou abrir estrada.
            Não se aproveita nada — é só o trabalho.</p>
            <p class="sheetText" style="margin-top:6px">${costHtml(cost)}</p>
        </div>
        <div class="sheetActions"><button class="btn" type="button" data-action="clear" data-arg="${x},${y}"${ok ? '' : ' disabled'}>${button}</button></div>`;
    return view;
}

function hillView(x, y, feature, where) {
    const text = '<p class="sheetText">Terreno alto e pedregoso. Só as minas se fazem nas colinas — procura as veias douradas.</p>';
    const site = checkFlatten(x, y, { ignoreCost: true });
    if (!site.ok) {
        const why = site.reason === 'Fora do território' ? '' : `<p class="sheetText" style="margin-top:6px">⛏️ ${escapeHtml(site.reason)}.</p>`;
        return { icon: '⛰️', title: 'Colina', sub: where, html: text + why };
    }
    const ok = canAfford(FLATTEN_COST);
    const lost = ' Árvores e rochedos no bloco vão-se com a terra; as veias de ouro ficam.';
    return {
        icon: '⛰️',
        title: 'Colina',
        sub: where,
        html: `${text}
            <div class="sheetSection">
                <p class="sheetText">⛏️ <b>Aplanar</b>: os trabalhadores cavam o bloco de 2x2 casas marcado até ao nível do chão e fica terra livre para construir.
                Das pedras que saem aproveitam-se ${FLATTEN_STONE} ${RESOURCE.stone.emoji}.${lost}</p>
                <p class="sheetText" style="margin-top:6px">${costHtml(FLATTEN_COST)}</p>
            </div>
            <div class="sheetActions"><button class="btn" type="button" data-action="flatten" data-arg="${x},${y}"${ok ? '' : ' disabled'}>⛏️ Aplanar a colina</button></div>`
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
