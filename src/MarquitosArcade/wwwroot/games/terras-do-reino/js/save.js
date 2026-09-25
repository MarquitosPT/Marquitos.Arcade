// Gravar e carregar o reino.
//
// A gravação vai pelo cliente de progresso do SDK (lib/arcade/progress.js):
// fica sempre no aparelho e, com sessão iniciada, também na conta. O servidor
// aceita no máximo 8 kB por jogo, por isso guarda-se o mínimo — a semente do
// mapa em vez do mapa, e os edifícios como listas curtas de números.
//
// A forma (v2):
//
//   {
//     v: 2, seed, saved,                      // semente do mapa e hora da gravação (ms)
//     played, clock, day, cl, happy,          // relógio, nível do castelo, contentamento
//     res: { coins, wood, ... },
//     b: [[tipo, x, y, progresso, fase, crescimento], ...],  // campos
//        [[tipo, x, y, progresso, parado], ...],             // o resto
//     pt: [índices de casas com árvores plantadas],
//     fl: [índices de casas de colina aplanadas],       // opcional
//     r: 'base64',                            // estradas: um bit por casa do quadrado à volta do castelo (opcional)
//     m: { s: { bem: stock }, f: feira|null, nf: dia da próxima feira },
//     t: [[edifícios, relógio, comércio, riqueza], ...],   // uma entrada por vila
//     q, st, bs,                              // objetivo, estatísticas, melhor enviado ao quadro
//     vw: [x, y, zoom, rotação], sp           // a vista e a velocidade do relógio (opcionais)
//   }
//
// As coordenadas são de casas do mapa de 88x88, e um edifício guarda o canto
// de cima do seu bloco de 2x2. A v1 era do tempo em que cada casa era um
// edifício (mapa de 44x44): ao carregar, passa a v2 dobrando as coordenadas —
// o relevo é amostrado de modo a que o reino caia no mesmo sítio.
//
// Junção das duas cópias (aparelho e conta): ganha a que tem mais tempo de
// jogo. Um reino não se junta campo a campo como as marcas de um nível — são
// dois mundos diferentes —, e o que tem mais horas é o que o jogador mais
// perderia.
//
// Fora do jogo o reino fica em pausa: não se recupera tempo nenhum ao voltar.
// A gravação leva tudo o que é preciso para continuar do ponto exato onde se
// saiu — os contadores a meio com duas casas decimais, a vista e a velocidade.

import { createProgressClient } from '/lib/arcade/progress.js';

import { BUILDINGS, GAME_ID, PROGRESS_STORAGE_KEY, SPEEDS, START_RESOURCES, ZOOM_MAX, ZOOM_MIN } from './config.js';
import { createBuilding, placeCastle } from './buildings.js';
import { refreshDerived } from './economy.js';
import { camera, lookAt, worldToGrid } from './iso.js';
import { initMarket } from './market.js';
import { emptyResources, fx, game, ui } from './state.js';
import { newTowns, placeTowns } from './towns.js';
import { CASTLE_CENTER, ROAD_PLAYER, T_GRASS, T_HILL, T_WATER, flattenTile, generateWorld, idx, inMap } from './world.js';

const VERSION = 2;
/** Lado do mapa da v1. */
const V1_SIZE = 44;
/**
 * As estradas guardam-se num quadrado à volta do castelo, um bit por casa: é o
 * que o território máximo alcança. Fica sempre no mesmo tamanho (600
 * caracteres), por muitas estradas que haja.
 */
const ROAD_BOX = 60;
const ROAD_X0 = CASTLE_CENTER.x - ROAD_BOX / 2;
const ROAD_Y0 = CASTLE_CENTER.y - ROAD_BOX / 2;
const KIND_INDEX = Object.fromEntries(BUILDINGS.map((b, i) => [b.id, i]));
const STAGES = ['empty', 'growing', 'ripe'];

const isSave = (data) => !!data && (data.v === VERSION || data.v === 1) && Number.isFinite(data.seed);

/** Passa uma gravação v1 (casas de 44x44) a v2 (88x88). As outras vêm como estão. */
function upgrade(data) {
    if (!isSave(data) || data.v === VERSION) return data;
    const cells = (i) => {
        const x = (i % V1_SIZE) * 2;
        const y = Math.floor(i / V1_SIZE) * 2;
        return [idx(x, y), idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)];
    };
    return {
        ...data,
        v: VERSION,
        b: (data.b || []).map((row) => [row[0], row[1] * 2, row[2] * 2, ...row.slice(3)]),
        pt: (data.pt || []).map((i) => cells(i)[0]),
        fl: (data.fl || []).flatMap(cells)
    };
}

function encodeRoads(world) {
    const bytes = new Uint8Array(Math.ceil((ROAD_BOX * ROAD_BOX) / 8));
    let any = false;
    for (let y = 0; y < ROAD_BOX; y++) {
        for (let x = 0; x < ROAD_BOX; x++) {
            if (world.road[idx(ROAD_X0 + x, ROAD_Y0 + y)] !== ROAD_PLAYER) continue;
            const bit = y * ROAD_BOX + x;
            bytes[bit >> 3] |= 1 << (bit & 7);
            any = true;
        }
    }
    return any ? btoa(String.fromCharCode(...bytes)) : undefined;
}

function decodeRoads(text, place) {
    let raw = '';
    try {
        raw = atob(text);
    } catch {
        return;
    }
    for (let bit = 0; bit < ROAD_BOX * ROAD_BOX; bit++) {
        if (!(raw.charCodeAt(bit >> 3) & (1 << (bit & 7)))) continue;
        const x = ROAD_X0 + (bit % ROAD_BOX);
        const y = ROAD_Y0 + Math.floor(bit / ROAD_BOX);
        if (inMap(x, y)) place(x, y);
    }
}

export const progress = createProgressClient(GAME_ID, {
    storageKey: PROGRESS_STORAGE_KEY,
    empty: () => ({}),
    accept: (data) => (isSave(data) ? upgrade(data) : {}),
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
    game.speed = 1;
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
    game.flattened = [];
    game.roadsVersion++;
    game.market = { stock: {}, fair: null, nextFairDay: 3 };
    game.towns = [];
    game.questIndex = 0;
    game.stats = { harvested: 0, sold: 0, bought: 0, earned: 0, built: 0 };
    game.bestSubmitted = 0;
    fx.caravans = [];
    fx.walkers = [];
    fx.boats = [];
    fx.floats = [];
    fx.puffs = [];
    ui.placing = null;
    ui.roadFrom = null;
    ui.selected = null;
    ui.hover = null;
    ui.pending = null;
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
    for (const [k, v] of Object.entries(game.res)) if (v) res[k] = r2(v);

    return {
        v: VERSION,
        seed: game.seed,
        saved: Date.now(),
        played: r2(game.played),
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
        fl: game.flattened,
        r: encodeRoads(game.world),
        m: {
            s: Object.fromEntries(Object.entries(game.market.stock).map(([k, v]) => [k, r2(v)])),
            f: game.market.fair,
            nf: game.market.nextFairDay
        },
        t: game.towns.map((t) => [t.n, r2(t.timer), r2(t.trade), r2(t.wealth)]),
        q: game.questIndex,
        st: Object.fromEntries(Object.entries(game.stats).map(([k, v]) => [k, Math.round(v)])),
        bs: game.bestSubmitted,
        vw: viewNow(),
        sp: game.speed
    };
}

/**
 * A vista em jogo: a casa ao centro do ecrã, o zoom e a rotação. No menu a
 * câmara anda a passear, e fica a vista da última gravação.
 */
function viewNow() {
    if (game.phase !== 'playing') return progress.data?.vw;
    const g = worldToGrid(camera.x, camera.y);
    return [r2(g.x), r2(g.y), r2(camera.zoom), camera.rot];
}

/**
 * Carrega a gravação para o estado. A vista não: o menu mostra o reino com a
 * câmara dele, e a vista gravada só se põe ao entrar (`restoreView`).
 */
export function loadSave(data = progress.data) {
    if (!isSave(data)) return false;
    data = upgrade(data);
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
    game.speed = SPEEDS.includes(data.sp) ? data.sp : 1;

    // Primeiro o chão: pode haver edifícios e árvores em cima de uma colina aplanada.
    for (const i of data.fl || []) {
        if (!Number.isInteger(i) || game.world.terrain[i] !== T_HILL || game.world.feature[i] === 'ore') continue;
        flattenTile(game.world, i);
        game.flattened.push(i);
    }

    for (const row of data.b || []) {
        const def = BUILDINGS[row[0]];
        if (!def) continue;
        const [, x, y, prog] = row;
        if (!inMap(x, y) || !inMap(x + 1, y + 1)) continue;
        if (game.world.building[idx(x, y)] || game.world.building[idx(x + 1, y + 1)]
            || game.world.building[idx(x + 1, y)] || game.world.building[idx(x, y + 1)]) continue;
        const b = createBuilding(def.id, x, y, { progress: prog || 0 }, { force: true });
        if (def.id === 'field') {
            b.stage = STAGES[row[4]] || 'empty';
            b.growth = row[5] || 0;
        } else {
            b.paused = row[4] === 1;
        }
    }

    if (typeof data.r === 'string') {
        decodeRoads(data.r, (x, y) => {
            const i = idx(x, y);
            if (game.world.building[i] || game.world.terrain[i] === T_HILL) return;
            // Um lago que o mapa ganhou depois de a estrada ser aberta: fica um aterro por baixo dela.
            if (game.world.terrain[i] === T_WATER) game.world.terrain[i] = T_GRASS;
            game.world.feature[i] = null;
            game.world.road[i] = ROAD_PLAYER;
        });
    }

    for (const i of data.pt || []) {
        if (!game.world.building[i] && !game.world.road[i] && game.world.terrain[i] !== T_WATER) {
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
 * Põe a câmara onde estava quando se gravou.
 * @returns {boolean} false se a gravação não tem vista (é de antes de a ter).
 */
export function restoreView(data = progress.data) {
    const vw = data?.vw;
    if (!Array.isArray(vw) || vw.length < 4 || !vw.every(Number.isFinite)) return false;
    const [x, y, zoom, rot] = vw;
    camera.rot = ((Math.round(rot) % 4) + 4) % 4;
    camera.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    lookAt(x, y);
    return true;
}

export function saveNow() {
    if (!game.world) return;
    progress.update(() => serialize());
}
