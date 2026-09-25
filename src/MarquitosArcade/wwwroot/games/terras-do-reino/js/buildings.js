// Construir, demolir, abrir estradas e subir o castelo — e as regras de onde
// cada coisa pode ir.
//
// As regras vivem numa só função (`checkPlacement`) porque é ela que responde
// a três perguntas diferentes: o cartão do edifício diz porque não se pode, o
// modo de construção pinta as casas válidas a verde, e o `place` recusa.
//
// Um edifício ocupa um bloco de 2x2 casas e fica guardado pelo canto de cima
// (x, y). O território conta-se a partir do centro do bloco.

import {
    BUILDING, BUILDING_SIZE, CASTLE_LEVELS, CASTLE_MAX_LEVEL, DEMOLISH_REFUND, FLATTEN_COST, FLATTEN_STONE, NEAR_FEATURES,
    RESOURCE, ROAD_COST
} from './config.js';
import { castleInfo, fx, game } from './state.js';
import {
    CASTLE_SIZE, CASTLE_TILE, ROAD_NONE, ROAD_PLAYER, T_GRASS, T_HILL, T_MEADOW, T_SAND, blockDistance, castleDistance,
    countFeatureNear, flattenTile, forEachInBlock, idx, inMap, isFreeBlock, isMineBlock
} from './world.js';

/** Custo em moedas equivalentes: o que um edifício "vale" para a prosperidade. */
export function costValue(cost = {}) {
    let total = 0;
    for (const [res, amount] of Object.entries(cost)) total += amount * (RESOURCE[res]?.price || 1);
    return total;
}

export function canAfford(cost = {}, times = 1) {
    return Object.entries(cost).every(([res, amount]) => (game.res[res] || 0) >= amount * times);
}

/** O que falta para pagar `cost`, como lista de { res, missing }. */
export function missingFor(cost = {}) {
    return Object.entries(cost)
        .filter(([res, amount]) => (game.res[res] || 0) < amount)
        .map(([res, amount]) => ({ res, missing: Math.ceil(amount - (game.res[res] || 0)) }));
}

function pay(cost = {}, times = 1) {
    for (const [res, amount] of Object.entries(cost)) game.res[res] -= amount * times;
}

export function isUnlocked(kind) {
    return BUILDING[kind].tier <= castleInfo().tier;
}

/** Uma cultura (trigo, vinha, algodão): semeia-se e colhe-se, sem trabalhadores. */
export const isCrop = (kind) => !!BUILDING[kind]?.crop;

export function countOf(kind) {
    return game.buildings.reduce((n, b) => n + (b.kind === kind ? 1 : 0), 0);
}

/** A casa (x, y) está dentro do território do castelo (que cresce com o nível dele). */
export function inTerritory(x, y) {
    return castleDistance(x, y) <= castleInfo().radius;
}

/** O bloco de um edifício está dentro do território: conta o centro dele. */
export function blockInTerritory(x, y, size = BUILDING_SIZE) {
    return blockDistance(x, y, size) <= castleInfo().radius;
}

/**
 * À volta do castelo fica uma praça de uma casa de largura, onde só se abrem
 * estradas: é por lá que o povo entra e sai do castelo, e um edifício colado
 * às torres ficava desenhado por baixo delas.
 */
function touchesCastleSquare(x, y, size) {
    return x < CASTLE_TILE.x + CASTLE_SIZE + 1 && x + size > CASTLE_TILE.x - 1
        && y < CASTLE_TILE.y + CASTLE_SIZE + 1 && y + size > CASTLE_TILE.y - 1;
}

/** Centro de um edifício, em coordenadas de grelha. */
export function centerOf(b) {
    return { x: b.x + b.size / 2, y: b.y + b.size / 2 };
}

/**
 * Pode construir-se `kind` com o canto de cima em (x, y)? Devolve
 * `{ ok, reason }`; sem sítio (`x` indefinido) só verifica o que não depende
 * dele.
 */
export function checkPlacement(kind, x, y, { ignoreCost = false } = {}) {
    const def = BUILDING[kind];
    if (!def) return { ok: false, reason: 'Edifício desconhecido' };
    if (!isUnlocked(kind)) return { ok: false, reason: `Castelo nível ${def.tier}` };
    if (def.unique && countOf(kind) > 0) return { ok: false, reason: 'Já construído' };
    if (!ignoreCost && !canAfford(def.cost)) return { ok: false, reason: 'Faltam recursos' };
    if (x === undefined) return { ok: true, reason: '' };

    const world = game.world;
    const size = BUILDING_SIZE;
    if (!inMap(x, y) || !inMap(x + size - 1, y + size - 1)) return { ok: false, reason: 'Fora do mapa' };
    if (!blockInTerritory(x, y, size)) return { ok: false, reason: 'Fora do território' };
    if (touchesCastleSquare(x, y, size)) return { ok: false, reason: 'Na praça do castelo só há estradas' };

    if (def.site === 'ore') {
        if (!isMineBlock(world, x, y, size)) return { ok: false, reason: 'Tem de ser numa colina com uma veia de ouro' };
    } else if (!isFreeBlock(world, x, y, size)) {
        return { ok: false, reason: 'Terreno ocupado' };
    }

    if (def.near) {
        const found = countFeatureNear(world, x, y, size, def.near.feature, def.near.radius);
        if (found < def.near.min) {
            return { ok: false, reason: NEAR_FEATURES[def.near.feature].need };
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
    const c = centerOf(b);
    fx.puffs.push({ gx: c.x, gy: c.y, t: 0 });
    return b;
}

/**
 * Cria o edifício e ocupa as casas dele — sem pagar nada. Usado também ao
 * carregar a gravação: aí o chão debaixo do edifício é forçado a terra limpa
 * (ou colina, para uma mina), para uma gravação antiga nunca deixar um
 * edifício em cima de uma árvore ou de um lago.
 */
export function createBuilding(kind, x, y, extra = {}, { force = false } = {}) {
    const size = BUILDING_SIZE;
    const b = {
        id: game.nextId++,
        kind,
        owner: 'player',
        x,
        y,
        size,
        progress: 0,
        /** Culturas: 'empty' | 'growing' | 'ripe', e o crescimento de 0 a 1. */
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
    const world = game.world;
    const mine = BUILDING[kind].site === 'ore';
    forEachInBlock(x, y, size, (cx, cy) => {
        const i = idx(cx, cy);
        if (force) {
            if (mine) {
                world.terrain[i] = T_HILL;
                if (world.feature[i] !== 'ore') world.feature[i] = null;
            } else {
                const t = world.terrain[i];
                if (t !== T_GRASS && t !== T_MEADOW && t !== T_SAND) world.terrain[i] = T_GRASS;
                world.elev[i] = 0;
                world.feature[i] = null;
            }
            world.road[i] = ROAD_NONE;
        }
        world.building[i] = b;
    });
    game.buildings.push(b);
    return b;
}

export function demolish(b) {
    if (!b || b.owner !== 'player' || b.kind === 'castle') return false;
    const def = BUILDING[b.kind];
    for (const [res, amount] of Object.entries(def.cost)) {
        game.res[res] = (game.res[res] || 0) + Math.floor(amount * DEMOLISH_REFUND);
    }
    game.buildings = game.buildings.filter((other) => other !== b);
    forEachInBlock(b.x, b.y, b.size, (x, y) => { game.world.building[idx(x, y)] = null; });
    const c = centerOf(b);
    fx.puffs.push({ gx: c.x, gy: c.y, t: 0 });
    return true;
}

// ---------- Estradas ----------

/** Pode abrir-se estrada na casa (x, y)? Só em chão plano e livre, dentro do território. */
export function canRoad(x, y) {
    if (!inMap(x, y) || !inTerritory(x, y)) return false;
    const world = game.world;
    const i = idx(x, y);
    const t = world.terrain[i];
    return (t === T_GRASS || t === T_MEADOW || t === T_SAND)
        && world.feature[i] === null && world.building[i] === null && world.road[i] === ROAD_NONE;
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const isPlayerRoad = (x, y) => inMap(x, y) && game.world.road[idx(x, y)] === ROAD_PLAYER;

/**
 * O caminho mais curto de (ax, ay) a (bx, by) por casas onde já há estrada ou
 * onde se pode abrir. Prefere as que já têm estrada — uma estrada nova segue
 * as velhas em vez de abrir uma paralela. Devolve a lista de casas (com as
 * pontas) ou null.
 */
export function roadPath(ax, ay, bx, by) {
    const passable = (x, y) => isPlayerRoad(x, y) || canRoad(x, y);
    if (!passable(bx, by) || !(passable(ax, ay))) return null;
    const size = game.world.size;
    const cost = new Float32Array(size * size).fill(Infinity);
    const prev = new Int32Array(size * size).fill(-1);
    const seen = new Uint8Array(size * size);
    // Dijkstra com passos de 1 (casa nova) e 1/2 (estrada que já existe): os
    // custos são meios inteiros, por isso uma fila de baldes chega.
    const start = idx(ax, ay);
    const goal = idx(bx, by);
    const buckets = [[start]];
    cost[start] = 0;
    for (let b = 0; b < buckets.length && !seen[goal]; b++) {
        const bucket = buckets[b];
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
            const i = bucket[k];
            if (seen[i]) continue;
            seen[i] = 1;
            if (i === goal) break;
            const x = i % size;
            const y = (i - x) / size;
            for (const [dx, dy] of STEPS) {
                const nx = x + dx;
                const ny = y + dy;
                if (!passable(nx, ny)) continue;
                const j = idx(nx, ny);
                const next = b + (isPlayerRoad(nx, ny) ? 1 : 2);
                if (next / 2 < cost[j]) {
                    cost[j] = next / 2;
                    prev[j] = i;
                    (buckets[next] ||= []).push(j);
                }
            }
        }
    }
    if (!seen[goal]) return null;
    const path = [];
    for (let i = goal; i !== -1; i = prev[i]) path.push({ x: i % size, y: Math.floor(i / size) });
    return path.reverse();
}

/** Quantas casas do caminho ainda não têm estrada (são as que se pagam). */
export function newRoadCells(path) {
    return path ? path.filter((c) => !isPlayerRoad(c.x, c.y)).length : 0;
}

/**
 * Abre a estrada ao longo do caminho, pagando as casas novas. Devolve quantas
 * se abriram, ou -1 se faltarem recursos.
 */
export function buildRoad(path) {
    const fresh = newRoadCells(path);
    if (!fresh) return 0;
    if (!canAfford(ROAD_COST, fresh)) return -1;
    pay(ROAD_COST, fresh);
    for (const c of path) game.world.road[idx(c.x, c.y)] = ROAD_PLAYER;
    game.roadsVersion++;
    return fresh;
}

/** Levanta um troço de estrada do jogador e devolve a pedra. */
export function removeRoad(x, y) {
    if (!isPlayerRoad(x, y)) return false;
    game.world.road[idx(x, y)] = ROAD_NONE;
    game.res.stone = (game.res.stone || 0) + ROAD_COST.stone;
    game.roadsVersion++;
    return true;
}

// ---------- Aplanar colinas ----------

/**
 * O bloco de 2x2 casas que se aplana quando se toca na casa (x, y): alinhado
 * às casas pares, como o tabuleiro antigo — dois toques ao lado aplanam
 * blocos vizinhos, sem sobreposições.
 */
export function flattenBlock(x, y) {
    return { x: x - (x % 2), y: y - (y % 2) };
}

/** As casas do bloco que se aplanam de facto: colina sem veia de ouro nem edifício. */
function flattenCells(x, y) {
    const world = game.world;
    const cells = [];
    const block = flattenBlock(x, y);
    forEachInBlock(block.x, block.y, 2, (cx, cy) => {
        if (!inMap(cx, cy) || !inTerritory(cx, cy)) return;
        const i = idx(cx, cy);
        if (world.terrain[i] === T_HILL && world.feature[i] !== 'ore' && !world.building[i]) cells.push(i);
    });
    return cells;
}

/**
 * Pode aplanar-se a colina em (x, y)? Devolve `{ ok, reason }`, como o
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
    if (!flattenCells(x, y).length) return { ok: false, reason: 'Nada para aplanar' };
    if (!ignoreCost && !canAfford(FLATTEN_COST)) return { ok: false, reason: 'Faltam recursos' };
    return { ok: true, reason: '' };
}

/** Aplana a colina à volta de (x, y) e devolve a pedra aproveitada, ou -1 se não puder. */
export function flatten(x, y) {
    if (!checkFlatten(x, y).ok) return -1;
    pay(FLATTEN_COST);
    const cells = flattenCells(x, y);
    for (const i of cells) {
        flattenTile(game.world, i);
        game.flattened.push(i);
    }
    game.planted = game.planted.filter((p) => !cells.includes(p));
    const stone = Math.max(0, Math.min(FLATTEN_STONE, game.derived.storage - game.res.stone));
    game.res.stone += stone;
    const block = flattenBlock(x, y);
    fx.puffs.push({ gx: block.x + 1, gy: block.y + 1, t: 0 });
    return stone;
}

// ---------- Castelo ----------

/** O castelo do jogador: não está em `game.buildings`, mas ocupa as suas 4x4 casas no mundo. */
export function placeCastle() {
    const castle = {
        id: 0, kind: 'castle', owner: 'player', x: CASTLE_TILE.x, y: CASTLE_TILE.y, size: CASTLE_SIZE, pulse: 99
    };
    forEachInBlock(castle.x, castle.y, CASTLE_SIZE, (x, y) => { game.world.building[idx(x, y)] = castle; });
    game.castle = castle;
    return castle;
}

export function nextCastleLevel() {
    return game.castleLevel < CASTLE_MAX_LEVEL ? CASTLE_LEVELS[game.castleLevel + 1] : null;
}

/**
 * O que o próximo nível exige além do custo (`needs` em CASTLE_LEVELS), como
 * lista de { label, have, need, ok } — o painel do castelo mostra-a toda.
 */
export function castleNeeds(next = nextCastleLevel()) {
    const needs = next?.needs || {};
    const list = [];
    if (needs.residents) {
        const have = game.derived.residents;
        list.push({ label: '👥 moradores', have, need: needs.residents, ok: have >= needs.residents });
    }
    if (needs.happy) {
        list.push({
            label: '😄 contentamento', have: game.happy, need: needs.happy, ok: game.happy >= needs.happy, percent: true
        });
    }
    return list;
}

export function canUpgradeCastle() {
    const next = nextCastleLevel();
    return !!next && canAfford(next.cost) && castleNeeds(next).every((n) => n.ok);
}

export function upgradeCastle() {
    const next = nextCastleLevel();
    if (!canUpgradeCastle()) return false;
    pay(next.cost);
    game.castleLevel = next.level;
    fx.puffs.push({ gx: CASTLE_TILE.x + CASTLE_SIZE / 2, gy: CASTLE_TILE.y + CASTLE_SIZE / 2, t: 0, big: true });
    return true;
}
