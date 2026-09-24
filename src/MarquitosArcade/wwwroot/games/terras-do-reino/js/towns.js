// As vilas vizinhas, geridas pelo CPU.
//
// Não atacam nem são atacadas: crescem sozinhas, casa a casa, cada uma com o
// seu ofício (ver `TOWNS` em config.js), e comerciam — com o jogador pelo
// mercado e entre si, em caravanas que se veem a atravessar o mapa. São as
// rivais na tabela da prosperidade.
//
// Os edifícios de uma vila não se guardam, só quantos são: vão sempre para os
// mesmos sítios, pela mesma ordem (a lista `sites`, que sai da semente).
//
// Uma vila cresce numa quadrícula: blocos de 2x2 casas com uma casa de
// intervalo entre eles, e é nesse intervalo que abre as ruas — cada edifício
// novo calceta o anel à volta dele. As ruas também não se guardam: saem dos
// edifícios.

import {
    CARAVAN_SECONDS, TOWN_BASE_PROSPERITY, TOWN_GROWTH_PER_BUILDING, TOWN_GROWTH_SECONDS,
    TOWN_MAX_BUILDINGS, TOWN_PROSPERITY_PER_BUILDING, TOWN_WEALTH_PER_BUILDING, TOWNS
} from './config.js';
import { hash2 } from './rng.js';
import { fx, game } from './state.js';
import {
    CASTLE_CENTER, ROAD_NONE, ROAD_TOWN, T_GRASS, T_MEADOW, T_SAND, forEachInBlock, idx, inMap, isFreeBlock
} from './world.js';

/** Passo da quadrícula de uma vila: um bloco de 2 casas e uma rua. */
const PITCH = 3;
const RINGS = 3;

/** Blocos por onde a vila cresce, dos mais perto do castelo dela para fora. */
function townSites(world, site, k) {
    const list = [];
    for (let j = -RINGS; j <= RINGS; j++) {
        for (let i = -RINGS; i <= RINGS; i++) {
            if (!i && !j) continue;
            const x = site.x + i * PITCH;
            const y = site.y + j * PITCH;
            if (!inMap(x - 1, y - 1) || !inMap(x + 2, y + 2)) continue;
            const jitter = hash2(i, j, world.seed + 31 + k) * 0.8;
            list.push({ x, y, order: Math.hypot(i, j) + jitter });
        }
    }
    return list.sort((a, b) => a.order - b.order);
}

/** Calceta o anel de casas à volta de um bloco da vila: são as ruas dela. */
function paveAround(world, x, y) {
    for (let cy = y - 1; cy <= y + 2; cy++) {
        for (let cx = x - 1; cx <= x + 2; cx++) {
            if (!inMap(cx, cy) || (cx >= x && cy >= y && cx <= x + 1 && cy <= y + 1)) continue;
            const i = idx(cx, cy);
            const t = world.terrain[i];
            if ((t !== T_GRASS && t !== T_MEADOW && t !== T_SAND) || world.building[i] || world.road[i] !== ROAD_NONE) continue;
            // A vila corta a árvore ou parte o rochedo que lhe fique no meio da rua.
            world.feature[i] = null;
            world.road[i] = ROAD_TOWN;
        }
    }
}

/** Estado novo das vilas (partida nova): começam já com umas casas. */
export function newTowns(random = Math.random) {
    return TOWNS.map(() => ({ n: 4 + Math.floor(random() * 3), timer: random() * 30, trade: 0, wealth: 0 }));
}

/**
 * Põe as vilas no mundo: o castelo de cada uma e os seus `n` edifícios.
 * Chamar depois de os edifícios do jogador estarem no mapa.
 */
export function placeTowns() {
    const world = game.world;
    world.towns.forEach((site, k) => {
        const town = game.towns[k];
        town.sites = townSites(world, site, k);
        town.cursor = 0;
        town.placed = [];
        const keep = { kind: 'keep', owner: k, x: site.x, y: site.y, size: 2, roof: site.roof, pulse: 99 };
        forEachInBlock(site.x, site.y, 2, (x, y) => { world.building[idx(x, y)] = keep; });
        paveAround(world, site.x, site.y);
        const target = town.n;
        town.n = 0;
        for (let i = 0; i < target; i++) growTown(k, { quiet: true });
    });
}

/** A vila acrescenta um edifício, se ainda tiver onde. */
function growTown(k, { quiet = false } = {}) {
    const world = game.world;
    const town = game.towns[k];
    const def = TOWNS[k];
    while (town.cursor < town.sites.length) {
        const site = town.sites[town.cursor++];
        if (!isFreeBlock(world, site.x, site.y, 2)) continue;
        const kind = def.kinds[town.n % def.kinds.length];
        const b = { kind, owner: k, x: site.x, y: site.y, size: 2, roof: def.roof, stage: 'ripe', growth: 1, pulse: 99 };
        forEachInBlock(site.x, site.y, 2, (x, y) => { world.building[idx(x, y)] = b; });
        paveAround(world, site.x, site.y);
        game.roadsVersion++;
        town.placed.push(b);
        town.n++;
        if (!quiet) fx.puffs.push({ gx: site.x + 1, gy: site.y + 1, t: 0 });
        return true;
    }
    return false;
}

export function townProsperity(k) {
    const town = game.towns[k];
    return Math.round(TOWN_BASE_PROSPERITY + town.n * TOWN_PROSPERITY_PER_BUILDING + town.wealth + town.trade * 0.5);
}

/** Avança as vilas: crescem de tempos a tempos e mandam caravanas umas às outras. */
export function stepTowns(dt, { quiet = false } = {}) {
    game.towns.forEach((town, k) => {
        town.wealth += town.n * TOWN_WEALTH_PER_BUILDING * dt;
        town.timer += dt;
        const wait = TOWN_GROWTH_SECONDS + town.n * TOWN_GROWTH_PER_BUILDING;
        if (town.timer >= wait) {
            town.timer -= wait;
            if (town.n < TOWN_MAX_BUILDINGS) growTown(k, { quiet });
        }
    });

    if (quiet) return;

    // Caravanas entre vilas: só se veem, não mexem na economia.
    if (Math.random() < dt / 12 && game.world.towns.length > 1) {
        const from = Math.floor(Math.random() * game.world.towns.length);
        let to = Math.floor(Math.random() * (game.world.towns.length - 1));
        if (to >= from) to++;
        const good = TOWNS[from].supplies[Math.floor(Math.random() * TOWNS[from].supplies.length)];
        sendCaravan(game.world.towns[from], game.world.towns[to], good, TOWNS[from].roof);
    }
}

/** Caravana do castelo do jogador para uma vila (depois de uma venda no mercado). */
export function sendPlayerCaravan(townIndex, good) {
    const town = game.world.towns[townIndex];
    if (!town) return;
    sendCaravan({ x: CASTLE_CENTER.x - 2, y: CASTLE_CENTER.y + 1 }, town, good, '#f2c14e');
}

function sendCaravan(from, to, good, color) {
    if (fx.caravans.length > 8) return;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    fx.caravans.push({
        ax: from.x + 1, ay: from.y + 1,
        bx: to.x + 1, by: to.y + 1,
        t: 0,
        duration: CARAVAN_SECONDS * Math.max(0.5, distance / 36),
        good,
        color
    });
}

export function stepCaravans(dt) {
    for (const c of fx.caravans) c.t += dt / c.duration;
    fx.caravans = fx.caravans.filter((c) => c.t < 1);
}
