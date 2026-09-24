// O mapa: relva, prados, florestas, lagos, rochedos e colinas com veios de ouro.
//
// Sai todo de uma semente (ver rng.js). A gravação só leva a semente e o que o
// jogador mudou por cima — os edifícios e as árvores plantadas —, e o resto
// volta a nascer igual ao abrir o jogo.
//
// O castelo do jogador fica sempre ao centro e as três vilas vizinhas longe
// dele, cada uma para o seu lado. À volta do castelo garante-se o que é preciso
// para o começo não depender da sorte: árvores, rochas, água e uma colina com
// ouro ao alcance do castelo no nível 3.

import { CASTLE_LEVELS, MAP_SIZE, TOWNS } from './config.js';
import { createRng, fbm, hash2 } from './rng.js';

export const T_GRASS = 0;
export const T_MEADOW = 1;
export const T_WATER = 2;
export const T_SAND = 3;
export const T_HILL = 4;

/** Canto de cima do castelo do jogador (ocupa 2x2 casas). */
export const CASTLE_TILE = { x: MAP_SIZE / 2 - 1, y: MAP_SIZE / 2 - 1 };
/** Centro do castelo, em coordenadas de grelha (é o canto partilhado pelas 4 casas). */
export const CASTLE_CENTER = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };

/** Raio à volta do castelo que fica sempre limpo. */
const CLEAR_RADIUS = 3.2;
const TOWN_DISTANCE = 18;
const TOWN_CLEAR = 2.2;
/** Raio que uma vila ocupa quando está grande (ver towns.js). */
const TOWN_ROOM = 4.5;

export const idx = (x, y) => y * MAP_SIZE + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;

/** Distância do centro de uma casa ao centro do castelo. */
export function castleDistance(x, y) {
    return Math.hypot(x + 0.5 - CASTLE_CENTER.x, y + 0.5 - CASTLE_CENTER.y);
}

/**
 * @param {number} seed
 * @returns O mundo: arrays por casa (terreno, relevo, elemento, edifício) e os sítios das vilas.
 */
export function generateWorld(seed) {
    const size = MAP_SIZE;
    const n = size * size;
    const rng = createRng(seed);

    const world = {
        seed,
        size,
        terrain: new Uint8Array(n),
        elev: new Int8Array(n),
        /** null | 'tree' | 'rock' | 'ore' */
        feature: new Array(n).fill(null),
        /** O edifício que ocupa a casa (do jogador ou de uma vila), ou null. */
        building: new Array(n).fill(null),
        /** Pequena variação de cor de cada casa, para a relva não parecer um azulejo. */
        tint: new Float32Array(n),
        towns: []
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = idx(x, y);
            // Perto do castelo o terreno sobe um pouco: um castelo numa ilhota
            // no meio de um lago deixava o começo sem espaço para construir.
            const nearCastle = Math.max(0, 1 - Math.hypot(x + 0.5 - CASTLE_CENTER.x, y + 0.5 - CASTLE_CENTER.y) / 11);
            const h = fbm(x * 0.09, y * 0.09, seed, 3) + nearCastle * 0.1;
            const forest = fbm(x * 0.13 + 40, y * 0.13, seed + 7, 3);
            const rocks = fbm(x * 0.21, y * 0.21 + 30, seed + 13, 2);
            const meadow = fbm(x * 0.17 + 9, y * 0.17 + 3, seed + 21, 2);
            const jitter = hash2(x, y, seed);
            world.tint[i] = hash2(x, y, seed + 99);

            let terrain = meadow > 0.58 ? T_MEADOW : T_GRASS;
            let elev = 0;
            let feature = null;

            if (h < 0.31) {
                terrain = T_WATER;
                elev = -1;
            } else if (h < 0.345) {
                terrain = T_SAND;
            } else if (h > 0.66) {
                terrain = T_HILL;
                elev = 1;
                if (rocks > 0.6 && jitter < 0.45) feature = jitter < 0.18 ? 'ore' : 'rock';
                else if (forest > 0.6 && jitter < 0.5) feature = 'tree';
            } else if (forest > 0.57 && jitter < 0.85) {
                feature = 'tree';
            } else if (rocks > 0.66 && jitter < 0.5) {
                feature = 'rock';
            } else if (jitter < 0.035) {
                feature = 'tree';
            }

            world.terrain[i] = terrain;
            world.elev[i] = elev;
            world.feature[i] = feature;
        }
    }

    // As vilas: três direções à volta do castelo, longe dele e longe das bordas.
    // Em cada direção experimentam-se vários sítios e fica o que tem mais terra
    // à volta — uma vila no meio de um lago não tinha onde crescer.
    const base = rng.next() * Math.PI * 2;
    TOWNS.forEach((town, k) => {
        let best = null;
        for (let attempt = 0; attempt < 14; attempt++) {
            const angle = base + (k * Math.PI * 2) / TOWNS.length + rng.range(-0.45, 0.45);
            const distance = rng.range(TOWN_DISTANCE - 2, TOWN_DISTANCE + 2);
            const x = clampInt(Math.round(CASTLE_CENTER.x + Math.cos(angle) * distance), 5, size - 6);
            const y = clampInt(Math.round(CASTLE_CENTER.y + Math.sin(angle) * distance), 5, size - 6);
            let land = 0;
            forEachInRadius(x + 0.5, y + 0.5, TOWN_ROOM, (tx, ty) => {
                const t = world.terrain[idx(tx, ty)];
                if (t !== T_WATER && t !== T_HILL) land++;
            });
            if (!best || land > best.land) best = { x, y, land };
        }
        // O que ainda for água perto do centro vira terra: a vila precisa de chão.
        forEachInRadius(best.x + 0.5, best.y + 0.5, TOWN_ROOM - 1, (tx, ty) => {
            const i = idx(tx, ty);
            if (world.terrain[i] === T_WATER || world.terrain[i] === T_HILL) {
                world.terrain[i] = T_GRASS;
                world.elev[i] = 0;
                world.feature[i] = null;
            }
        });
        clearArea(world, best.x + 0.5, best.y + 0.5, TOWN_CLEAR);
        world.towns.push({ ...town, x: best.x, y: best.y });
    });

    clearArea(world, CASTLE_CENTER.x, CASTLE_CENTER.y, CLEAR_RADIUS);
    guaranteeStart(world, rng);

    return world;
}

function clampInt(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function clearArea(world, cx, cy, radius) {
    forEachInRadius(cx, cy, radius, (x, y) => {
        const i = idx(x, y);
        world.terrain[i] = world.terrain[i] === T_MEADOW ? T_MEADOW : T_GRASS;
        world.elev[i] = 0;
        world.feature[i] = null;
    });
}

/** Corre `fn(x, y)` para cada casa cujo centro está a menos de `radius` do ponto de grelha (cx, cy). */
export function forEachInRadius(cx, cy, radius, fn) {
    const r = Math.ceil(radius);
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    for (let y = y0 - r - 1; y <= y0 + r; y++) {
        for (let x = x0 - r - 1; x <= x0 + r; x++) {
            if (!inMap(x, y)) continue;
            if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= radius) fn(x, y);
        }
    }
}

/**
 * O que o começo precisa, ao alcance do castelo. O ruído costuma dá-lo, mas
 * "costuma" não chega: uma semente sem rochas perto era um jogo encravado
 * antes de começar.
 */
function guaranteeStart(world, rng) {
    const count = (radius, test) => {
        let total = 0;
        forEachInRadius(CASTLE_CENTER.x, CASTLE_CENTER.y, radius, (x, y) => {
            if (test(idx(x, y))) total++;
        });
        return total;
    };

    const patch = (distance, radius, paint) => {
        const angle = rng.next() * Math.PI * 2;
        const cx = CASTLE_CENTER.x + Math.cos(angle) * distance;
        const cy = CASTLE_CENTER.y + Math.sin(angle) * distance;
        forEachInRadius(cx, cy, radius, (x, y) => {
            if (Math.hypot(x + 0.5 - CASTLE_CENTER.x, y + 0.5 - CASTLE_CENTER.y) <= CLEAR_RADIUS + 0.5) return;
            if (world.towns.some((t) => Math.hypot(x - t.x, y - t.y) <= TOWN_CLEAR + 1)) return;
            paint(idx(x, y), x, y);
        });
    };

    const radius1 = CASTLE_LEVELS[1].radius;
    const radius3 = CASTLE_LEVELS[3].radius;

    // Não basta haver árvores e rochas perto: tem de haver uma casa livre, no
    // território inicial, com elas à volta — é lá que vão o lenhador e a
    // pedreira. Sem isso o castelo nunca passava do nível 1.
    const hasSpot = (feature, min) => {
        let found = false;
        forEachInRadius(CASTLE_CENTER.x, CASTLE_CENTER.y, radius1 - 0.3, (x, y) => {
            if (!found && isFreeLand(world, x, y) && countFeatureNear(world, x, y, feature, 2) >= min) found = true;
        });
        return found;
    };
    const land = (i) => {
        if (world.terrain[i] === T_WATER || world.terrain[i] === T_HILL) {
            world.terrain[i] = T_GRASS;
            world.elev[i] = 0;
        }
    };

    if (count(radius1 + 2, (i) => world.terrain[i] === T_WATER) < 3) {
        patch(7.5, 1.6, (i) => {
            world.terrain[i] = T_WATER;
            world.elev[i] = -1;
            world.feature[i] = null;
        });
    }

    // A água primeiro: um lago novo não pode afogar o sítio do lenhador.
    for (let tries = 0; tries < 4 && !hasSpot('tree', 3); tries++) {
        patch(4.6, 1.7, (i) => {
            land(i);
            world.feature[i] = 'tree';
        });
    }

    for (let tries = 0; tries < 4 && !hasSpot('rock', 2); tries++) {
        patch(4.6, 1.2, (i) => {
            land(i);
            world.feature[i] = 'rock';
        });
    }

    if (count(radius3 - 0.5, (i) => world.feature[i] === 'ore') < 2) {
        let ores = 0;
        const painted = [];
        patch(9.5, 1.9, (i, x, y) => {
            world.terrain[i] = T_HILL;
            world.elev[i] = 1;
            const roll = hash2(x, y, world.seed + 5);
            world.feature[i] = ores < 3 && roll < 0.45 ? 'ore' : roll < 0.6 ? 'rock' : null;
            if (world.feature[i] === 'ore') ores++;
            painted.push(i);
        });
        // Se o acaso não pôs nenhuma veia no remendo, põe-se uma a direito.
        if (!ores && painted.length) world.feature[painted[0]] = 'ore';
    }

    // A areia só faz sentido à beira de água: sem ela à volta, volta a relva.
    for (let y = 0; y < world.size; y++) {
        for (let x = 0; x < world.size; x++) {
            const i = idx(x, y);
            if (world.terrain[i] !== T_SAND) continue;
            let wet = false;
            for (let dy = -1; dy <= 1 && !wet; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (inMap(x + dx, y + dy) && world.terrain[idx(x + dx, y + dy)] === T_WATER) { wet = true; break; }
                }
            }
            if (!wet) world.terrain[i] = T_GRASS;
        }
    }
}

/**
 * Aplana uma colina: a casa passa a relva ao nível do chão e perde o que
 * tinha em cima (árvores, rochas). Usado pelo jogador (ver buildings.js) e ao
 * carregar a gravação, que guarda os índices das casas aplanadas.
 */
export function flattenTile(world, i) {
    world.terrain[i] = T_GRASS;
    world.elev[i] = 0;
    world.feature[i] = null;
}

/** Terra onde se pode construir: nem água, nem colina (só as minas vão lá), nem árvores ou rochas. */
export function isFreeLand(world, x, y) {
    if (!inMap(x, y)) return false;
    const i = idx(x, y);
    const t = world.terrain[i];
    return (t === T_GRASS || t === T_MEADOW || t === T_SAND)
        && world.feature[i] === null
        && world.building[i] === null;
}

/** Conta os elementos `feature` num raio à volta da casa (x, y), sem contar a própria. */
export function countFeatureNear(world, x, y, feature, radius) {
    let total = 0;
    forEachInRadius(x + 0.5, y + 0.5, radius + 0.25, (tx, ty) => {
        if (tx === x && ty === y) return;
        if (world.feature[idx(tx, ty)] === feature) total++;
    });
    return total;
}
