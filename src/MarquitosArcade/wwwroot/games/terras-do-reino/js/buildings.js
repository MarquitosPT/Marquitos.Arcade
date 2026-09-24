// Construir, demolir e subir o castelo — e as regras de onde cada coisa pode ir.
//
// As regras vivem numa só função (`checkPlacement`) porque é ela que responde
// a três perguntas diferentes: o cartão do edifício diz porque não se pode, o
// modo de construção pinta as casas válidas a verde, e o `place` recusa.

import {
    BUILDING, CASTLE_LEVELS, CASTLE_MAX_LEVEL, DEMOLISH_REFUND, FLATTEN_COST, FLATTEN_STONE, RESOURCE
} from './config.js';
import { castleInfo, fx, game } from './state.js';
import {
    CASTLE_TILE, T_HILL, castleDistance, countFeatureNear, flattenTile, idx, inMap, isFreeLand
} from './world.js';

/** Custo em moedas equivalentes: o que um edifício "vale" para a prosperidade. */
export function costValue(cost = {}) {
    let total = 0;
    for (const [res, amount] of Object.entries(cost)) total += amount * (RESOURCE[res]?.price || 1);
    return total;
}

export function canAfford(cost = {}) {
    return Object.entries(cost).every(([res, amount]) => (game.res[res] || 0) >= amount);
}

/** O que falta para pagar `cost`, como lista de { res, missing }. */
export function missingFor(cost = {}) {
    return Object.entries(cost)
        .filter(([res, amount]) => (game.res[res] || 0) < amount)
        .map(([res, amount]) => ({ res, missing: Math.ceil(amount - (game.res[res] || 0)) }));
}

function pay(cost = {}) {
    for (const [res, amount] of Object.entries(cost)) game.res[res] -= amount;
}

export function isUnlocked(kind) {
    return BUILDING[kind].tier <= castleInfo().tier;
}

export function countOf(kind) {
    return game.buildings.reduce((n, b) => n + (b.kind === kind ? 1 : 0), 0);
}

/** Dentro do território do castelo (que cresce com o nível dele). */
export function inTerritory(x, y) {
    return castleDistance(x, y) <= castleInfo().radius;
}

/**
 * Pode construir-se `kind` nesta casa? Devolve `{ ok, reason }`; sem casa
 * (`x` indefinido) só verifica o que não depende do sítio.
 */
export function checkPlacement(kind, x, y, { ignoreCost = false } = {}) {
    const def = BUILDING[kind];
    if (!def) return { ok: false, reason: 'Edifício desconhecido' };
    if (!isUnlocked(kind)) return { ok: false, reason: `Castelo nível ${def.tier}` };
    if (def.unique && countOf(kind) > 0) return { ok: false, reason: 'Já construído' };
    if (!ignoreCost && !canAfford(def.cost)) return { ok: false, reason: 'Faltam recursos' };
    if (x === undefined) return { ok: true, reason: '' };

    const world = game.world;
    if (!inMap(x, y)) return { ok: false, reason: 'Fora do mapa' };
    if (!inTerritory(x, y)) return { ok: false, reason: 'Fora do território' };

    const i = idx(x, y);
    if (def.site === 'ore') {
        if (world.feature[i] !== 'ore' || world.building[i]) return { ok: false, reason: 'Tem de ser numa veia de ouro' };
    } else if (!isFreeLand(world, x, y)) {
        return { ok: false, reason: 'Terreno ocupado' };
    }

    if (def.near) {
        const found = countFeatureNear(world, x, y, def.near.feature, def.near.radius);
        if (found < def.near.min) {
            return { ok: false, reason: def.near.feature === 'tree' ? 'Precisa de árvores perto' : 'Precisa de rochas perto' };
        }
    }

    return { ok: true, reason: '' };
}

/** Constrói e devolve o edifício novo, ou null se não puder. */
export function place(kind, x, y) {
    if (!checkPlacement(kind, x, y).ok) return null;
    const def = BUILDING[kind];
    pay(def.cost);
    const b = createBuilding(kind, x, y);
    game.stats.built++;
    fx.puffs.push({ gx: x + 0.5, gy: y + 0.5, t: 0 });
    return b;
}

/** Cria o edifício e ocupa a casa — sem pagar nada. Usado também ao carregar a gravação. */
export function createBuilding(kind, x, y, extra = {}) {
    const b = {
        id: game.nextId++,
        kind,
        owner: 'player',
        x,
        y,
        size: 1,
        progress: 0,
        /** Campos: 'empty' | 'growing' | 'ripe', e o crescimento de 0 a 1. */
        stage: 'empty',
        growth: 0,
        staffed: false,
        /** Parado pelo jogador: não trabalha nem ocupa trabalhadores. */
        paused: false,
        /** 'ok' | 'noWorkers' | 'noInput' | 'full' | 'noNear' | 'paused' */
        status: 'ok',
        /** Segundos desde o último produto — anima o edifício a trabalhar. */
        pulse: 99,
        ...extra
    };
    game.buildings.push(b);
    game.world.building[idx(x, y)] = b;
    return b;
}

export function demolish(b) {
    if (!b || b.owner !== 'player' || b.kind === 'castle') return false;
    const def = BUILDING[b.kind];
    for (const [res, amount] of Object.entries(def.cost)) {
        game.res[res] = (game.res[res] || 0) + Math.floor(amount * DEMOLISH_REFUND);
    }
    game.buildings = game.buildings.filter((other) => other !== b);
    game.world.building[idx(b.x, b.y)] = null;
    fx.puffs.push({ gx: b.x + 0.5, gy: b.y + 0.5, t: 0 });
    return true;
}

// ---------- Aplanar colinas ----------

/**
 * Pode aplanar-se a colina (x, y)? Devolve `{ ok, reason }`, como o
 * `checkPlacement`. Com `ignoreCost` só vê o sítio — é o que decide se a ficha
 * da colina mostra o botão.
 */
export function checkFlatten(x, y, { ignoreCost = false } = {}) {
    const world = game.world;
    if (!inMap(x, y)) return { ok: false, reason: 'Fora do mapa' };
    const i = idx(x, y);
    if (world.terrain[i] !== T_HILL) return { ok: false, reason: 'Não é uma colina' };
    if (!inTerritory(x, y)) return { ok: false, reason: 'Fora do território' };
    if (world.building[i]) return { ok: false, reason: 'Terreno ocupado' };
    if (world.feature[i] === 'ore') return { ok: false, reason: 'Uma veia de ouro não se aplana' };
    if (!ignoreCost && !canAfford(FLATTEN_COST)) return { ok: false, reason: 'Faltam recursos' };
    return { ok: true, reason: '' };
}

/** Aplana a colina e devolve a pedra aproveitada, ou -1 se não puder. */
export function flatten(x, y) {
    if (!checkFlatten(x, y).ok) return -1;
    pay(FLATTEN_COST);
    const i = idx(x, y);
    flattenTile(game.world, i);
    game.flattened.push(i);
    game.planted = game.planted.filter((p) => p !== i);
    const stone = Math.max(0, Math.min(FLATTEN_STONE, game.derived.storage - game.res.stone));
    game.res.stone += stone;
    fx.puffs.push({ gx: x + 0.5, gy: y + 0.5, t: 0 });
    return stone;
}

// ---------- Castelo ----------

/** O castelo do jogador: não está em `game.buildings`, mas ocupa as suas 2x2 casas no mundo. */
export function placeCastle() {
    const castle = { id: 0, kind: 'castle', owner: 'player', x: CASTLE_TILE.x, y: CASTLE_TILE.y, size: 2, pulse: 99 };
    for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) game.world.building[idx(castle.x + dx, castle.y + dy)] = castle;
    }
    game.castle = castle;
    return castle;
}

export function nextCastleLevel() {
    return game.castleLevel < CASTLE_MAX_LEVEL ? CASTLE_LEVELS[game.castleLevel + 1] : null;
}

export function upgradeCastle() {
    const next = nextCastleLevel();
    if (!next || !canAfford(next.cost)) return false;
    pay(next.cost);
    game.castleLevel = next.level;
    fx.puffs.push({ gx: CASTLE_TILE.x + 1, gy: CASTLE_TILE.y + 1, t: 0, big: true });
    return true;
}
