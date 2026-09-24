// Gravar e carregar o reino.
//
// A gravação vai pelo cliente de progresso do SDK (lib/arcade/progress.js):
// fica sempre no aparelho e, com sessão iniciada, também na conta. O servidor
// aceita no máximo 8 kB por jogo, por isso guarda-se o mínimo — a semente do
// mapa em vez do mapa, e os edifícios como listas curtas de números.
//
// A forma (v1):
//
//   {
//     v: 1, seed, saved,                      // semente do mapa e hora da gravação (ms)
//     played, clock, day, cl, happy,          // relógio, nível do castelo, contentamento
//     res: { coins, wood, ... },
//     b: [[tipo, x, y, progresso, fase, crescimento], ...],  // campos
//        [[tipo, x, y, progresso, parado], ...],             // o resto
//     pt: [índices de casas com árvores plantadas],
//     m: { s: { bem: stock }, f: feira|null, nf: dia da próxima feira },
//     t: [[edifícios, relógio, comércio, riqueza], ...],   // uma entrada por vila
//     q, st, bs                               // objetivo, estatísticas, melhor enviado ao quadro
//   }
//
// Junção das duas cópias (aparelho e conta): ganha a que tem mais tempo de
// jogo. Um reino não se junta campo a campo como as marcas de um nível — são
// dois mundos diferentes —, e o que tem mais horas é o que o jogador mais
// perderia.

import { createProgressClient } from '/lib/arcade/progress.js';

import { BUILDINGS, GAME_ID, OFFLINE_MAX_SECONDS, PROGRESS_STORAGE_KEY, START_RESOURCES } from './config.js';
import { createBuilding, placeCastle } from './buildings.js';
import { catchUp, refreshDerived } from './economy.js';
import { initMarket } from './market.js';
import { emptyResources, fx, game, ui } from './state.js';
import { newTowns, placeTowns } from './towns.js';
import { generateWorld } from './world.js';

const VERSION = 1;
const KIND_INDEX = Object.fromEntries(BUILDINGS.map((b, i) => [b.id, i]));
const STAGES = ['empty', 'growing', 'ripe'];

const isSave = (data) => !!data && data.v === VERSION && Number.isFinite(data.seed);

export const progress = createProgressClient(GAME_ID, {
    storageKey: PROGRESS_STORAGE_KEY,
    empty: () => ({}),
    accept: (data) => (isSave(data) ? data : {}),
    merge: (local, remote) => {
        if (!isSave(remote)) return local;
        if (!isSave(local)) return remote;
        return (remote.played || 0) >= (local.played || 0) ? remote : local;
    }
});

export const hasSave = () => isSave(progress.data);

const r2 = (n) => Math.round(n * 100) / 100;

function resetState(seed) {
    game.seed = seed;
    game.world = generateWorld(seed);
    game.played = 0;
    game.clock = 0;
    game.day = 1;
    game.castleLevel = 1;
    game.res = emptyResources();
    game.happy = 0.45;
    game.buildings = [];
    game.nextId = 1;
    game.planted = [];
    game.market = { stock: {}, fair: null, nextFairDay: 3 };
    game.towns = [];
    game.questIndex = 0;
    game.stats = { harvested: 0, sold: 0, bought: 0, earned: 0, built: 0 };
    game.bestSubmitted = 0;
    fx.caravans = [];
    fx.floats = [];
    fx.puffs = [];
    ui.placing = null;
    ui.selected = null;
    ui.hover = null;
    placeCastle();
}

/** Um reino novo, numa semente nova. */
export function newGame(seed = Math.floor(Math.random() * 2 ** 31)) {
    resetState(seed);
    Object.assign(game.res, START_RESOURCES);
    game.towns = newTowns();
    placeTowns();
    initMarket();
    refreshDerived();
}

export function serialize() {
    const res = {};
    for (const [k, v] of Object.entries(game.res)) if (v) res[k] = Math.round(v * 10) / 10;

    return {
        v: VERSION,
        seed: game.seed,
        saved: Date.now(),
        played: Math.round(game.played),
        clock: r2(game.clock),
        day: game.day,
        cl: game.castleLevel,
        happy: r2(game.happy),
        res,
        b: game.buildings.map((b) => {
            const row = [KIND_INDEX[b.kind], b.x, b.y, r2(b.progress || 0)];
            if (b.kind === 'field') row.push(STAGES.indexOf(b.stage), r2(b.growth));
            else if (b.paused) row.push(1);
            return row;
        }),
        pt: game.planted.filter((i) => game.world.feature[i] === 'tree'),
        m: {
            s: Object.fromEntries(Object.entries(game.market.stock).map(([k, v]) => [k, Math.round(v)])),
            f: game.market.fair,
            nf: game.market.nextFairDay
        },
        t: game.towns.map((t) => [t.n, Math.round(t.timer), Math.round(t.trade), Math.round(t.wealth)]),
        q: game.questIndex,
        st: Object.fromEntries(Object.entries(game.stats).map(([k, v]) => [k, Math.round(v)])),
        bs: game.bestSubmitted
    };
}

/**
 * Carrega a gravação para o estado. Não recupera o tempo fora — isso é o
 * `resumeOffline`, à parte, para o menu poder mostrar o reino antes de o
 * jogador decidir continuar.
 */
export function loadSave(data = progress.data) {
    if (!isSave(data)) return false;
    resetState(data.seed);

    game.played = data.played || 0;
    game.clock = data.clock || 0;
    game.day = data.day || 1;
    game.castleLevel = data.cl || 1;
    game.happy = Number.isFinite(data.happy) ? data.happy : 0.45;
    Object.assign(game.res, data.res || {});
    game.questIndex = data.q || 0;
    Object.assign(game.stats, data.st || {});
    game.bestSubmitted = data.bs || 0;

    for (const row of data.b || []) {
        const def = BUILDINGS[row[0]];
        if (!def) continue;
        const [, x, y, prog] = row;
        const b = createBuilding(def.id, x, y, { progress: prog || 0 });
        if (def.id === 'field') {
            b.stage = STAGES[row[4]] || 'empty';
            b.growth = row[5] || 0;
        } else {
            b.paused = row[4] === 1;
        }
    }

    for (const i of data.pt || []) {
        if (!game.world.building[i]) {
            game.world.feature[i] = 'tree';
            game.planted.push(i);
        }
    }

    const towns = newTowns(() => 0);
    (data.t || []).forEach((row, k) => {
        if (!towns[k]) return;
        towns[k].n = row[0] || towns[k].n;
        towns[k].timer = row[1] || 0;
        towns[k].trade = row[2] || 0;
        towns[k].wealth = row[3] || 0;
    });
    game.towns = towns;
    placeTowns();

    initMarket();
    if (data.m?.s) Object.assign(game.market.stock, data.m.s);
    game.market.fair = data.m?.f || null;
    game.market.nextFairDay = data.m?.nf || 3;

    refreshDerived();
    return true;
}

/**
 * Recupera o tempo em que o jogo esteve fechado, até ao teto de três horas.
 * @returns {{ seconds: number, delta: object, days: number } | null}
 */
export function resumeOffline(data = progress.data) {
    if (!isSave(data) || !data.saved) return null;
    const seconds = Math.min(OFFLINE_MAX_SECONDS, Math.max(0, (Date.now() - data.saved) / 1000));
    if (seconds < 30) return null;
    const result = catchUp(seconds);
    return { seconds, ...result };
}

export function saveNow() {
    if (!game.world) return;
    progress.update(() => serialize());
}
