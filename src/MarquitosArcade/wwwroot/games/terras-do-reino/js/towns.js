// As vilas vizinhas, geridas pelo CPU.
//
// Não atacam nem são atacadas: crescem sozinhas, casa a casa, cada uma com o
// seu ofício (ver `TOWNS` em config.js), e comerciam — com o jogador pelo
// mercado e entre si, em caravanas que se veem a atravessar o mapa. São as
// rivais na tabela da prosperidade.
//
// Os edifícios de uma vila não se guardam, só quantos são: vão sempre para os
// mesmos sítios, pela mesma ordem (a lista `sites`, que sai da semente).

import {
    CARAVAN_SECONDS, TOWN_BASE_PROSPERITY, TOWN_GROWTH_PER_BUILDING, TOWN_GROWTH_SECONDS,
    TOWN_MAX_BUILDINGS, TOWN_PROSPERITY_PER_BUILDING, TOWN_WEALTH_PER_BUILDING, TOWNS
} from './config.js';
import { hash2 } from './rng.js';
import { fx, game } from './state.js';
import { CASTLE_CENTER, forEachInRadius, idx, isFreeLand } from './world.js';

/** Casas por onde a vila cresce, das mais perto do centro para fora. */
function townSites(world, site, k) {
    const list = [];
    forEachInRadius(site.x + 0.5, site.y + 0.5, 5.5, (x, y) => {
        if (x === site.x && y === site.y) return;
        const jitter = hash2(x, y, world.seed + 31 + k) * 1.6;
        list.push({ x, y, order: Math.hypot(x - site.x, y - site.y) + jitter });
    });
    return list.sort((a, b) => a.order - b.order);
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
        const keep = { kind: 'keep', owner: k, x: site.x, y: site.y, size: 1, roof: site.roof, pulse: 99 };
        world.building[idx(site.x, site.y)] = keep;
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
        if (!isFreeLand(world, site.x, site.y)) continue;
        const kind = def.kinds[town.n % def.kinds.length];
        const b = { kind, owner: k, x: site.x, y: site.y, size: 1, roof: def.roof, stage: 'ripe', growth: 1, pulse: 99 };
        world.building[idx(site.x, site.y)] = b;
        town.placed.push(b);
        town.n++;
        if (!quiet) fx.puffs.push({ gx: site.x + 0.5, gy: site.y + 0.5, t: 0 });
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
    sendCaravan({ x: CASTLE_CENTER.x - 0.5, y: CASTLE_CENTER.y + 0.6 }, town, good, '#f2c14e');
}

function sendCaravan(from, to, good, color) {
    if (fx.caravans.length > 8) return;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    fx.caravans.push({
        ax: from.x + 0.5, ay: from.y + 0.5,
        bx: to.x + 0.5, by: to.y + 0.5,
        t: 0,
        duration: CARAVAN_SECONDS * Math.max(0.5, distance / 18),
        good,
        color
    });
}

export function stepCaravans(dt) {
    for (const c of fx.caravans) c.t += dt / c.duration;
    fx.caravans = fx.caravans.filter((c) => c.t < 1);
}
