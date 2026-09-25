// O guia do jogo (guia.html): regras, níveis do castelo, objetivos, edifícios
// e bens.
//
// Os números não se escrevem aqui: saem das mesmas tabelas que o jogo lê
// (config.js e quests.js). Mudar o custo de um edifício, o tempo de uma
// receita ou a recompensa de um objetivo muda-os também no guia — o guia não
// pode mentir sobre o jogo.

import {
    AUTOSAVE_SECONDS, BUILDING, BUILDINGS, BUY_MARKUP, CASTLE_LEVELS, CASTLE_MAX_LEVEL, CASTLE_RESIDENTS, CLEAR_COST, DAY_SECONDS,
    DEMOLISH_REFUND, FAIR_DAYS, FAIR_EVERY_DAYS, FLATTEN_COST, FLATTEN_STONE, FOODS, HAPPY_BASE, HAPPY_FED, HAPPY_LEISURE,
    HAPPY_VARIETY, IDLE_TAX_SHARE, NEAR_FEATURES, PRICE_MAX, PRICE_MIN, RESOURCE, RESOURCES, ROAD_COST, SPEEDS, START_RESOURCES,
    TAX_PER_RESIDENT, TOWN_MAX_BUILDINGS, TOWNS
} from './config.js';
import { skipSplashOnNextVisit } from '/lib/arcade/splash.js';

import { fmt, pct } from './format.js';
import { QUESTS, milestone } from './quests.js';

// ---------- Peças ----------

const good = (id) => `<span class="good">${RESOURCE[id].emoji} ${RESOURCE[id].name}</span>`;
const building = (def) => `<span class="good">${def.emoji} ${def.name}</span>`;

function costHtml(cost = {}) {
    const parts = Object.entries(cost);
    if (!parts.length) return '<span class="muted">Grátis</span>';
    return `<span class="costRow">${parts.map(([res, n]) => `<span class="cost" title="${RESOURCE[res].name}">${RESOURCE[res].emoji} ${fmt(n)}</span>`).join('')}</span>`;
}

const side = (map = {}) => Object.entries(map).map(([res, n]) => `${n} ${RESOURCE[res].emoji}`).join(' + ');

/** Lista em português: "a, b e c". */
function joinPt(items) {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

const list = (items) => `<ul class="bullets">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

function fill(id, html) {
    document.getElementById(id).innerHTML = html;
}

// ---------- O jogo ----------

function kingdom() {
    return `<p>Recebes um castelo no meio de um prado, algumas moedas e um pouco de madeira e pedra.
        Com isso fundas um reino: constróis casas para o povo, lavras campos, abres minas e oficinas, e vendes o que
        sobra às <b>três vilas vizinhas</b>. Aqui ninguém faz guerra — ganha quem mais <b>prospera</b>.</p>
        <p>A <b>prosperidade</b> é a pontuação do reino: as moedas, os bens do armazém ao preço de referência,
        o que custaram os edifícios e o que custou subir o castelo. As vilas vizinhas crescem sozinhas e são as tuas
        rivais na tabela dos 👑 Reinos.</p>
        <p>O jogo não tem fim: há uma lista de objetivos que ensina tudo, passo a passo, e depois dela
        marcos de prosperidade cada vez maiores.</p>
        <div class="startBox"><span class="muted">Começas com</span> ${costHtml(START_RESOURCES)}
            <span class="muted">e ${CASTLE_RESIDENTS} moradores no castelo.</span></div>`;
}

// ---------- Regras ----------

function rules() {
    const foods = FOODS.map((id) => `<span class="chip">${RESOURCE[id].emoji} ${RESOURCE[id].name} <b>×${RESOURCE[id].meals}</b></span>`).join('');
    const leisure = Object.entries(HAPPY_LEISURE).map(([kind, share]) => `${building(BUILDING[kind])} (+${pct(share)})`);
    const fullFood = HAPPY_BASE + HAPPY_FED + HAPPY_VARIETY;

    return `<h3>⏳ O tempo</h3>
        ${list([
            `Um dia do reino dura <b>${DAY_SECONDS} segundos</b> de jogo. É ao fim de cada dia que o povo come.`,
            `O botão ⏩ muda a velocidade do relógio: ${joinPt(SPEEDS.map((s) => `<b>${s}x</b>`))}.`,
            'O tempo só anda com o jogo aberto: fora dele o reino fica em pausa e continua exatamente onde ficou.',
            `O reino grava-se sozinho a cada ${AUTOSAVE_SECONDS} segundos. Sem sessão iniciada fica só neste aparelho; com sessão, vai contigo para qualquer lado.`
        ])}

        <h3>👥 O povo e o trabalho</h3>
        ${list([
            `O castelo traz os primeiros moradores; cada ${building(BUILDING.house)} traz mais <b>${BUILDING.house.residents}</b>. O castelo traz mais moradores a cada nível.`,
            'As oficinas precisam de trabalhadores (👷). Os moradores vão para os edifícios <b>pela ordem em que foram construídos</b>: o primeiro a ser feito é o primeiro a ter gente. Sem gente que chegue, um edifício fica parado.',
            'Um edifício pode ser <b>parado</b> na ficha dele: liberta os trabalhadores e deixa de gastar matéria-prima — útil quando a carpintaria come a madeira que queres para construir.',
            'Culturas (campos, vinhas, canaviais…) e a casa não precisam de trabalhadores.'
        ])}

        <h3>💰 Impostos</h3>
        ${list([
            `Cada morador a trabalhar paga <b>${TAX_PER_RESIDENT} moedas por dia</b>, multiplicadas pelo contentamento do povo.`,
            `Quem não tem trabalho paga só <b>${pct(IDLE_TAX_SHARE)}</b> disso — encher o mapa de casas não enriquece ninguém.`,
            'Os impostos vão pingando ao longo do dia, não caem todos de uma vez.'
        ])}

        <h3>🍽️ Comida e contentamento</h3>
        <p>Ao fim do dia cada morador come uma refeição. O povo come primeiro o que mais alimenta; o número é quantas refeições dá cada unidade:</p>
        <div class="chips">${foods}</div>
        ${list([
            `Mesmo sem comer nada de jeito, o povo nunca fica abaixo de <b>${pct(HAPPY_BASE)}</b> contente — isto não é um jogo de revoltas.`,
            `Com todos bem alimentados sobe mais <b>${pct(HAPPY_FED)}</b>, e com <b>dois ou mais tipos de comida</b> na mesa mais <b>${pct(HAPPY_VARIETY)}</b>. A comida leva o contentamento até ${pct(fullFood)}.`,
            `O resto é convívio: ${joinPt(leisure)}, na proporção do povo que conseguem servir.`,
            'O contentamento não salta de um dia para o outro: anda metade do caminho por dia.',
            'Mais contentamento é mais impostos — e os últimos níveis do castelo pedem um povo contente.'
        ])}

        <h3>🔨 Construir</h3>
        ${list([
            'Só se constrói dentro do <b>território</b> do castelo, que cresce a cada nível.',
            'Os edifícios ocupam 2×2 casas (o castelo 4×4). À volta do castelo fica uma praça onde só se abrem estradas.',
            'Alguns edifícios precisam de vizinhos: árvores, rochas ou água por perto. Quanto mais houver, mais depressa trabalham.',
            'Cada edifício abre com um nível do castelo (o seu escalão). Os bloqueados aparecem com 🔒.',
            `Demolir devolve <b>${pct(DEMOLISH_REFUND)}</b> do que custou (toca duas vezes em Demolir para confirmar).`
        ])}

        <h3>📦 O armazém</h3>
        ${list([
            'Cada bem tem o mesmo limite no armazém, que cresce com o nível do castelo (ver a tabela abaixo). As moedas não têm limite.',
            'Com o armazém cheio de um bem, quem o produz para: vende o que sobra ou sobe o castelo.'
        ])}`;
}

// ---------- Castelo ----------

function castle() {
    const cards = CASTLE_LEVELS.slice(1).map((lvl) => {
        const unlocks = BUILDINGS.filter((b) => b.tier === lvl.tier);
        const needs = lvl.needs
            ? `<p class="lvlLine"><span class="muted">Requisitos</span> 👥 ${fmt(lvl.needs.residents)} moradores · 😊 ${pct(lvl.needs.happy)} contentes</p>`
            : '';
        return `<article class="lvlCard">
            <header class="lvlHead">
                <span class="levelBadge">${lvl.level}</span>
                <div class="lvlStats">
                    <span><b>${lvl.radius}</b> casas de território</span>
                    <span>armazém de <b>${fmt(lvl.storage)}</b> por bem</span>
                    <span><b>${lvl.residents}</b> moradores no castelo</span>
                </div>
            </header>
            <p class="lvlLine"><span class="muted">Custo</span> ${lvl.cost ? costHtml(lvl.cost) : 'o castelo com que se começa'}</p>
            ${needs}
            <p class="lvlLine"><span class="muted">Abre</span></p>
            <div class="chips chips--tight">${unlocks.map((b) => `<span class="chip">${b.emoji} ${b.name}</span>`).join('')}</div>
        </article>`;
    }).join('');

    return `<p>O castelo é o coração do reino. Subi-lo (em 🏰 Castelo) alarga o território onde se pode construir,
        aumenta o armazém, traz mais moradores e abre um novo escalão de edifícios. Há <b>${CASTLE_MAX_LEVEL} níveis</b>.</p>
        <p>A partir do nível 3, além de pagar, é preciso <b>ter</b> um reino a sério: um número mínimo de moradores
        e o povo contente. Isso não se compra.</p>
        <div class="lvlList">${cards}</div>`;
}

// ---------- Objetivos ----------

function quests() {
    const reward = (r) => Object.entries(r).map(([res, n]) => `${fmt(n)} ${RESOURCE[res].emoji}`).join(' + ');
    const items = QUESTS.map((q, i) => `<li class="quest">
            <span class="questNum">${i + 1}</span>
            <span class="questMain"><b>${q.text}</b><span class="muted">${q.hint}</span></span>
            <span class="questReward">${reward(q.reward)}</span>
        </li>`).join('');
    const first = milestone(QUESTS.length);
    const second = milestone(QUESTS.length + 1);
    return `<p>O cartão 📜 Objetivo, por baixo dos bens, mostra um objetivo de cada vez. Cumpri-lo dá uma recompensa e
        passa ao seguinte — é assim que o jogo ensina tudo, sem tutorial.</p>
        <ol class="quests">${items}</ol>
        <p>Depois do último, o reino continua: os objetivos passam a ser <b>marcos de prosperidade</b>, cada um o dobro do
        anterior — ${fmt(first.target)}, ${fmt(second.target)}, e assim por diante —, com uma recompensa de
        ${pct(first.reward.coins / first.target)} do marco em moedas.</p>`;
}

// ---------- Edifícios ----------

const TIER_LABEL = (tier) => (tier === 1 ? 'Desde o início' : `Castelo nível ${tier}`);

function whatItDoes(def) {
    if (def.recipe) {
        const input = side(def.recipe.in);
        return `${input ? `${input} → ` : ''}${side(def.recipe.out)} a cada ${def.recipe.time} s`;
    }
    if (def.crop) return `${def.crop.yield} ${RESOURCE[def.crop.res].emoji} por colheita · ${def.crop.grow} s a crescer`;
    if (def.serves) {
        const drink = def.serves.drink ? ` · gasta 1 ${RESOURCE[def.serves.drink].emoji} por cada ${def.serves.per}` : '';
        return `Serve até ${def.serves.residents} moradores por dia${drink}`;
    }
    if (def.residents) return `+${def.residents} moradores`;
    if (def.plants) return `Planta uma árvore a cada ${def.plants.time} s, até ${def.plants.radius.toLocaleString('pt-PT')} casas à volta`;
    if (def.farms) return `Semeia e colhe sozinho as culturas até ${def.farms.radius} casas à volta`;
    return '';
}

function tags(def) {
    const t = [];
    if (def.workers) t.push(`👷 ${def.workers} trabalhador${def.workers > 1 ? 'es' : ''}`);
    if (def.crop) t.push('🌱 Cultura: toca para semear e colher');
    if (def.unique) t.push('☝️ Só um por reino');
    if (def.site === 'ore') t.push('✨ Numa colina com veia de ouro');
    if (def.near) {
        const f = NEAR_FEATURES[def.near.feature];
        t.push(`${f.icon} ${f.need}: pelo menos ${def.near.min} ${f.count} a ${def.near.radius.toLocaleString('pt-PT')} casas (a todo o gás com ${def.near.full})`);
    }
    if (def.serves) t.push(`😊 Até +${pct(HAPPY_LEISURE[def.id] || 0)} de contentamento`);
    return t.map((x) => `<li>${x}</li>`).join('');
}

function buildings() {
    const tiers = [...new Set(BUILDINGS.map((b) => b.tier))].sort((a, b) => a - b);
    const groups = tiers.map((tier) => {
        const cards = BUILDINGS.filter((b) => b.tier === tier).map((def) => `<article class="bCard" id="edificio-${def.id}">
                <header class="bHead"><span class="bIcon" aria-hidden="true">${def.emoji}</span><h4>${def.name}</h4></header>
                <p class="bDesc">${def.desc}</p>
                ${whatItDoes(def) ? `<p class="bDoes">${whatItDoes(def)}</p>` : ''}
                <ul class="bTags">${tags(def)}</ul>
                <div class="bCost">${costHtml(def.cost)}</div>
            </article>`).join('');
        return `<h3>${tier === 1 ? '🏡' : '🔓'} ${TIER_LABEL(tier)}</h3><div class="bGrid">${cards}</div>`;
    }).join('');

    const road = `<article class="bCard">
            <header class="bHead"><span class="bIcon" aria-hidden="true">🛣️</span><h4>Estrada de pedra</h4></header>
            <p class="bDesc">Liga os edifícios: é por elas que o povo anda de um lado para o outro. Paga-se por casa.</p>
            <ul class="bTags"><li>↩️ Levantar um troço devolve a pedra</li></ul>
            <div class="bCost">${costHtml(ROAD_COST)}</div>
        </article>`;

    return `<p>Tudo o que se constrói, pelo escalão em que abre. Os custos são os da construção; os tempos são com
        todos os trabalhadores e, nos edifícios que precisam de vizinhos, com vizinhos que cheguem.</p>
        <p>Uma oficina sem trabalhadores, sem matéria-prima ou com o armazém cheio fica à espera — a ficha dela diz porquê.</p>
        ${groups}
        <h3>🛣️ Sempre disponível</h3><div class="bGrid">${road}</div>`;
}

// ---------- Bens ----------

function goods() {
    const producers = (id) => BUILDINGS.filter((b) => b.recipe?.out?.[id] || b.crop?.res === id);
    const consumers = (id) => BUILDINGS.filter((b) => b.recipe?.in?.[id] || b.serves?.drink === id);
    const builds = (id) => {
        const names = BUILDINGS.filter((b) => b.cost[id]).map((b) => `${b.emoji} ${b.name}`);
        if (ROAD_COST[id]) names.unshift('🛣️ Estrada');
        const levels = CASTLE_LEVELS.slice(2).filter((l) => l.cost?.[id]).map((l) => l.level);
        if (levels.length) names.push(`🏰 Castelo nível ${joinPt(levels.map(String))}`);
        return names;
    };
    const towns = (id, key) => TOWNS.filter((t) => t[key].includes(id)).map((t) => `${t.emoji} ${t.name}`);
    const line = (label, html) => `<p class="gLine"><span class="gLabel">${label}</span><span>${html}</span></p>`;

    const cards = RESOURCES.map((r) => {
        const made = producers(r.id).map(building);
        const used = consumers(r.id).map(building);
        const cost = builds(r.id);
        const supplied = towns(r.id, 'supplies');
        const wanted = towns(r.id, 'demands');
        const lines = [
            line('Vem de', r.id === 'coins' ? 'Impostos, vendas no mercado e recompensas dos objetivos' : made.length ? made.join(', ') : 'Só do mercado'),
            used.length ? line('Gasta-se em', used.join(', ')) : '',
            r.meals ? line('Comida', `${r.meals} refeiç${r.meals > 1 ? 'ões' : 'ão'} por unidade`) : '',
            r.id === 'coins' ? line('Serve para', 'Pagar quase tudo: edifícios, estradas, o castelo e as compras no mercado') : '',
            cost.length && r.id !== 'coins' ? line('Constrói', `<span class="gList">${cost.join(', ')}</span>`) : '',
            !used.length && !r.meals && !cost.length && r.tradable ? line('Serve para', 'Vender nas feiras') : ''
        ].join('');
        const tagsHtml = [
            supplied.length ? `<span class="tag tag--cheap">Barato: feito em ${joinPt(supplied)}</span>` : '',
            wanted.length ? `<span class="tag tag--dear">Procurado em ${joinPt(wanted)}</span>` : ''
        ].join('');
        return `<article class="gCard" id="bem-${r.id}">
            <header class="gHead">
                <span class="bIcon" aria-hidden="true">${r.emoji}</span>
                <h4>${r.name}</h4>
                <span class="gPrice">${r.id === 'coins' ? 'a medida de tudo' : `💰 ${fmt(r.price)}`}</span>
            </header>
            ${lines}
            ${tagsHtml ? `<div class="gTags">${tagsHtml}</div>` : ''}
        </article>`;
    }).join('');

    const chains = BUILDINGS.filter((b) => b.recipe?.in).map((b) => `<li>${side(b.recipe.in)} <span class="arrow">→</span> ${side(b.recipe.out)} <span class="muted">(${b.emoji} ${b.name})</span></li>`).join('');

    return `<p>Os bens do reino e o preço de referência de cada um — o que vale para a prosperidade e o centro à volta do
        qual o preço do mercado sobe e desce.</p>
        <div class="gGrid">${cards}</div>
        <h3>🔗 Cadeias de produção</h3>
        <ul class="chains">${chains}</ul>`;
}

// ---------- Mercado ----------

function market() {
    const towns = TOWNS.map((t) => `<article class="townCard" style="--roof:${t.roof}">
            <h4>${t.emoji} ${t.name}</h4>
            <p><span class="muted">Faz</span> ${t.supplies.map((id) => RESOURCE[id].emoji).join(' ')}</p>
            <p><span class="muted">Procura</span> ${t.demands.map((id) => RESOURCE[id].emoji).join(' ')}</p>
        </article>`).join('');
    return `<p>Com um ${building(BUILDING.market)} no reino, o painel ⚖️ Mercado compra e vende qualquer bem às vilas vizinhas.</p>
        ${list([
            '<b>Vender muito de uma vez baixa o preço</b>: cada bem tem um stock nas vilas, e quanto mais cheio, mais barato. Vender aos poucos rende mais.',
            `Comprar custa <b>${pct(BUY_MARKUP - 1)} mais</b> do que vender, e esvazia o stock (o preço sobe).`,
            `O preço do dia anda entre <b>${pct(PRICE_MIN)}</b> e <b>${pct(PRICE_MAX)}</b> do preço de referência. As setas ▲ ▼ dizem se está caro ou barato.`,
            'Com o tempo o stock volta ao equilíbrio: o que as vilas fazem fica barato, o que procuram fica caro.',
            `De ${FAIR_EVERY_DAYS} em ${FAIR_EVERY_DAYS} dias, mais ou menos, abre uma 🎪 <b>feira</b> numa vila: durante ${FAIR_DAYS} dias, um dos bens que ela procura fica muito mais caro. É a altura de vender.`,
            'Cada venda sai do castelo numa caravana até à vila — e as vilas também mandam caravanas umas às outras.'
        ])}
        <h3>🏘️ As vilas vizinhas</h3>
        <p>Governadas pelo CPU, crescem sozinhas (até ${TOWN_MAX_BUILDINGS} edifícios cada) e enriquecem com o tempo e com o
        comércio. Não atacam nem são atacadas: são as rivais na tabela 👑 Reinos.</p>
        <div class="townGrid">${towns}</div>`;
}

// ---------- Terreno ----------

function terrain() {
    return list([
        `🌳 <b>Árvores</b> — dão madeira a um ${building(BUILDING.woodcutter)} perto e não acabam. Um ${building(BUILDING.forester)} planta mais. Cortar uma árvore para libertar a casa custa ${costHtml(CLEAR_COST.tree)} (não dá madeira).`,
        `🪨 <b>Rochedos</b> — dão pedra a uma ${building(BUILDING.quarry)} perto. Parti-los para libertar a casa custa ${costHtml(CLEAR_COST.rock)} (não dá pedra).`,
        `💧 <b>Lagos</b> — não se constrói em cima, mas a ${building(BUILDING.fishery)} e o ${building(BUILDING.paddy)} precisam de ficar à beira de água.`,
        `⛰️ <b>Colinas</b> — terreno alto onde não se constrói. Um bloco de 2×2 pode ser <b>aplanado</b> por ${costHtml(FLATTEN_COST)} e devolve ${FLATTEN_STONE} ${RESOURCE.stone.emoji}.`,
        `✨ <b>Veias de ouro</b> — nas colinas. São o único sítio onde se faz uma ${building(BUILDING.goldmine)}, e nunca se aplanam.`,
        '🛣️ <b>Estradas</b> — ligam os edifícios. Uma estrada tem de encostar a um edifício para lhe servir de porta, e é por elas que se vê o povo a andar.'
    ]);
}

// ---------- Controlos ----------

function controls() {
    const rows = [
        ['Mover o mapa', 'Arrastar com o dedo', 'Arrastar · setas · W A S D'],
        ['Aproximar / afastar', 'Beliscar', 'Roda do rato · + e −'],
        ['Rodar a vista', 'Botão 🔄 Rodar', 'Q e E'],
        ['Ver uma casa do mapa', 'Tocar nela', 'Clicar nela'],
        ['Construir', '🔨 Construir, tocar no sítio e confirmar com ✓', 'Clicar no sítio · Enter confirma'],
        ['Ocultar edifícios e árvores (a construir)', 'Botão 🌳', 'H'],
        ['Cancelar / fechar', '✕ ou Terminar', 'Esc'],
        ['Velocidade do tempo', 'Botão ⏩ no topo', 'Botão ⏩ no topo'],
        ['Pausa', 'Botão Pausa', 'Botão Pausa']
    ].map(([what, touch, desk]) => `<tr><th scope="row">${what}</th><td data-label="📱 Toque">${touch}</td><td data-label="🖥️ Teclado e rato">${desk}</td></tr>`).join('');
    return `<div class="tableWrap"><table class="table table--stack">
            <thead><tr><th scope="col">Ação</th><th scope="col">📱 Toque</th><th scope="col">🖥️ Teclado e rato</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <p>Por baixo dos bens está o painel de ferramentas: 🔨 Construir, ⚖️ Mercado, 🏰 Castelo (o estado do reino e o
        próximo nível), 👑 Reinos (a tabela da prosperidade) e 🔄 Rodar.</p>`;
}

fill('reinoBody', kingdom());
fill('regrasBody', rules());
fill('casteloBody', castle());
fill('objetivosBody', quests());
fill('edificiosBody', buildings());
fill('bensBody', goods());
fill('mercadoBody', market());
fill('terrenoBody', terrain());
fill('controlosBody', controls());

// Veio de um link com âncora (#castelo): o conteúdo só agora existe, por isso salta-se para lá outra vez.
if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();

// ---------- Voltar ao jogo ----------
//
// Quem volta do guia para o jogo não está a arrancar a consola: o jogo abre
// sem o ecrã de arranque (ver lib/arcade/splash-skip.js). Vale para os links
// "Voltar ao jogo" e, para quem veio do jogo, para o botão de retroceder do
// browser — que é o que o `pagehide` apanha quando o jogo não está em cache.
const GAME_PATH = new URL('./', location.href).pathname;
const cameFromGame = (() => {
    try {
        return new URL(document.referrer).pathname.replace(/index\.html$/, '') === GAME_PATH;
    } catch {
        return false;
    }
})();

/** Saiu por um link para outro sítio (a arcada): aí o retroceder não é para o jogo. */
let leftElsewhere = false;

document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link || new URL(link.href).pathname === location.pathname) return;
    if (new URL(link.href).pathname.replace(/index\.html$/, '') === GAME_PATH) skipSplashOnNextVisit(GAME_PATH);
    else leftElsewhere = true;
});
if (cameFromGame) {
    window.addEventListener('pagehide', () => {
        if (!leftElsewhere) skipSplashOnNextVisit(GAME_PATH);
    });
}
