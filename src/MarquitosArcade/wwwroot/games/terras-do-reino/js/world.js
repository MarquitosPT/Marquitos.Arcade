// O mapa: relva, prados, florestas, lagos, rochedos e colinas com veios de ouro.
//
// Sai todo de uma semente (ver rng.js). A gravação só leva a semente e o que o
// jogador mudou por cima — os edifícios, as estradas, as árvores plantadas e
// as colinas aplanadas —, e o resto volta a nascer igual ao abrir o jogo.
//
// Uma casa do mapa é a peça mais pequena: uma árvore, um rochedo, um troço de
// estrada. Os edifícios ocupam blocos de 2x2 casas (o castelo 4x4). O ruído do
// relevo é amostrado a meia resolução — uma colina tem o tamanho que tinha
// quando cada casa era um edifício —, e é isso que deixa as gravações antigas
// caírem no mesmo sítio (ver save.js).
//
// O castelo do jogador fica sempre ao centro e as três vilas vizinhas longe
// dele, cada uma para o seu lado. À volta do castelo garante-se o que é preciso
// para o começo não depender da sorte: árvores, rochas, água e uma colina com
// ouro ao alcance do castelo no nível 3.

import { BUILDING, CASTLE_LEVELS, MAP_SIZE, TOWNS } from './config.js';
import { createRng, fbm, hash2 } from './rng.js';

export const T_GRASS = 0;
export const T_MEADOW = 1;
export const T_WATER = 2;
export const T_SAND = 3;
export const T_HILL = 4;

/** O que há numa casa de estrada: nada, uma estrada do jogador ou uma rua de uma vila. */
export const ROAD_NONE = 0;
export const ROAD_PLAYER = 1;
export const ROAD_TOWN = 2;

/** Lado do castelo do jogador, em casas. */
export const CASTLE_SIZE = 4;
/** Canto de cima do castelo do jogador. */
export const CASTLE_TILE = { x: MAP_SIZE / 2 - CASTLE_SIZE / 2, y: MAP_SIZE / 2 - CASTLE_SIZE / 2 };
/** Centro do castelo, em coordenadas de grelha (o ponto no meio das suas casas). */
export const CASTLE_CENTER = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };

/** Raio à volta do castelo que fica sempre limpo. */
const CLEAR_RADIUS = 6.4;
const TOWN_DISTANCE = 36;
const TOWN_CLEAR = 4.4;
/** Raio que uma vila ocupa quando está grande (ver towns.js). */
const TOWN_ROOM = 9;
/** O ruído do relevo e das florestas lê-se a esta escala: duas casas por "casa" do ruído. */
const NOISE_SCALE = 0.5;

export const idx = (x, y) => y * MAP_SIZE + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;

/** Distância do centro da casa (x, y) ao centro do castelo. */
export function castleDistance(x, y) {
    return Math.hypot(x + 0.5 - CASTLE_CENTER.x, y + 0.5 - CASTLE_CENTER.y);
}

/** Distância do centro de um bloco (canto de cima em x, y) ao centro do castelo. */
export function blockDistance(x, y, size) {
    return Math.hypot(x + size / 2 - CASTLE_CENTER.x, y + size / 2 - CASTLE_CENTER.y);
}

/**
 * @param {number} seed
 * @returns O mundo: arrays por casa (terreno, relevo, elemento, edifício, estrada) e os sítios das vilas.
 */
export function generateWorld(seed) {
    const size = MAP_SIZE;
    const n = size * size;
    const rng = createRng(seed);

    const world = {
        seed,
        size,
        terrain: new Uint8Array(n),
        /**
         * Relevo de cada casa, em níveis. Por agora o chão é todo plano (tudo a
         * 0): as colinas e os lagos distinguem-se só pela cor. O desenho, o
         * toque e a gravação já sabem lidar com relevo, para quando voltar.
         */
        elev: new Int8Array(n),
        /** null | 'tree' | 'rock' | 'ore' */
        feature: new Array(n).fill(null),
        /** O edifício que ocupa a casa (do jogador ou de uma vila), ou null. */
        building: new Array(n).fill(null),
        /** ROAD_NONE, ROAD_PLAYER ou ROAD_TOWN. */
        road: new Uint8Array(n),
        /** Pequena variação de cor de cada casa, para a relva não parecer um azulejo. */
        tint: new Float32Array(n),
        towns: []
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = idx(x, y);
            // Coordenadas do ruído: meia resolução, com o centro de cada par de
            // casas no sítio onde antes estava o centro de uma.
            const nx = (x - 0.5) * NOISE_SCALE;
            const ny = (y - 0.5) * NOISE_SCALE;
            // Perto do castelo o terreno sobe um pouco: um castelo numa ilhota
            // no meio de um lago deixava o começo sem espaço para construir.
            const nearCastle = Math.max(0, 1 - castleDistance(x, y) / 22);
            const h = fbm(nx * 0.09, ny * 0.09, seed, 3) + nearCastle * 0.1;
            const forest = fbm(nx * 0.13 + 40, ny * 0.13, seed + 7, 3);
            const rocks = fbm(nx * 0.21, ny * 0.21 + 30, seed + 13, 2);
            const meadow = fbm(nx * 0.17 + 9, ny * 0.17 + 3, seed + 21, 2);
            const jitter = hash2(x, y, seed);
            // A cor da relva varia devagar, em manchas largas: casa a casa
            // parecia um tabuleiro de xadrez.
            world.tint[i] = Math.min(1, Math.max(0, (fbm(x * 0.11 + 5, y * 0.11 + 11, seed + 99, 2) - 0.2) / 0.6 + (jitter - 0.5) * 0.15));

            let terrain = meadow > 0.58 ? T_MEADOW : T_GRASS;
            let feature = null;

            if (h < 0.31) {
                terrain = T_WATER;
            } else if (h < 0.345) {
                terrain = T_SAND;
            } else if (h > 0.66) {
                terrain = T_HILL;
                if (rocks > 0.6 && jitter < 0.22) feature = jitter < 0.07 ? 'ore' : 'rock';
                else if (forest > 0.6 && jitter < 0.24) feature = 'tree';
            } else if (forest > 0.57 && jitter < 0.32) {
                feature = 'tree';
            } else if (rocks > 0.66 && jitter < 0.24) {
                feature = 'rock';
            } else if (jitter < 0.012) {
                feature = 'tree';
            }

            world.terrain[i] = terrain;
            world.feature[i] = feature;
        }
    }

    // As vilas: três direções à volta do castelo, longe dele e longe das bordas.
    // Em cada direção experimentam-se vários sítios e fica o que tem mais terra
    // à volta — uma vila no meio de um lago não tinha onde crescer. O sítio é o
    // canto de cima do castelo da vila (2x2); o centro fica em (x+1, y+1).
    const base = rng.next() * Math.PI * 2;
    TOWNS.forEach((town, k) => {
        let best = null;
        for (let attempt = 0; attempt < 14; attempt++) {
            const angle = base + (k * Math.PI * 2) / TOWNS.length + rng.range(-0.45, 0.45);
            const distance = rng.range(TOWN_DISTANCE - 4, TOWN_DISTANCE + 4);
            const x = clampInt(Math.round(CASTLE_CENTER.x + Math.cos(angle) * distance) - 1, 10, size - 12);
            const y = clampInt(Math.round(CASTLE_CENTER.y + Math.sin(angle) * distance) - 1, 10, size - 12);
            let land = 0;
            forEachInRadius(x + 1, y + 1, TOWN_ROOM, (tx, ty) => {
                const t = world.terrain[idx(tx, ty)];
                if (t !== T_WATER && t !== T_HILL) land++;
            });
            if (!best || land > best.land) best = { x, y, land };
        }
        // O que ainda for água perto do centro vira terra: a vila precisa de chão.
        forEachInRadius(best.x + 1, best.y + 1, TOWN_ROOM - 2, (tx, ty) => {
            const i = idx(tx, ty);
            if (world.terrain[i] === T_WATER || world.terrain[i] === T_HILL) {
                world.terrain[i] = T_GRASS;
                world.elev[i] = 0;
                world.feature[i] = null;
            }
        });
        clearArea(world, best.x + 1, best.y + 1, TOWN_CLEAR);
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

/** Corre `fn(x, y)` para cada casa do bloco de lado `size` com o canto de cima em (x, y). */
export function forEachInBlock(x, y, size, fn) {
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) fn(x + dx, y + dy);
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
            if (castleDistance(x, y) <= CLEAR_RADIUS + 1) return;
            if (world.towns.some((t) => Math.hypot(x - t.x - 1, y - t.y - 1) <= TOWN_CLEAR + 2)) return;
            paint(idx(x, y), x, y);
        });
        return { x: Math.floor(cx), y: Math.floor(cy) };
    };

    const radius1 = CASTLE_LEVELS[1].radius;
    const radius3 = CASTLE_LEVELS[3].radius;

    // Não basta haver árvores e rochas perto: tem de haver um bloco livre, no
    // território inicial, com elas à volta — é lá que vão o lenhador e a
    // pedreira. Sem isso o castelo nunca passava do nível 1.
    const hasSpot = (kind) => {
        const near = BUILDING[kind].near;
        let found = false;
        forEachInRadius(CASTLE_CENTER.x, CASTLE_CENTER.y, radius1 - 1.5, (x, y) => {
            if (found || !isFreeBlock(world, x, y, 2)) return;
            if (countFeatureNear(world, x, y, 2, near.feature, near.radius) >= near.min + 1) found = true;
        });
        return found;
    };
    const land = (i) => {
        if (world.terrain[i] === T_WATER || world.terrain[i] === T_HILL) {
            world.terrain[i] = T_GRASS;
            world.elev[i] = 0;
        }
    };

    if (count(radius1 + 4, (i) => world.terrain[i] === T_WATER) < 12) {
        patch(15, 3.2, (i) => {
            world.terrain[i] = T_WATER;
            world.feature[i] = null;
        });
    }

    // A água primeiro: um lago novo não pode afogar o sítio do lenhador.
    for (let tries = 0; tries < 4 && !hasSpot('woodcutter'); tries++) {
        patch(9.2, 3.4, (i, x, y) => {
            land(i);
            world.feature[i] = hash2(x, y, world.seed + 3) < 0.6 ? 'tree' : null;
        });
    }

    for (let tries = 0; tries < 4 && !hasSpot('quarry'); tries++) {
        patch(9.2, 2.4, (i, x, y) => {
            land(i);
            world.feature[i] = hash2(x, y, world.seed + 4) < 0.6 ? 'rock' : null;
        });
    }

    // Uma mina precisa de um bloco de colina com uma veia e nada mais em cima.
    let mine = false;
    forEachInRadius(CASTLE_CENTER.x, CASTLE_CENTER.y, radius3 - 2, (x, y) => {
        if (!mine && isMineBlock(world, x, y, 2)) mine = true;
    });
    if (!mine) {
        const center = patch(19, 3.8, (i, x, y) => {
            world.terrain[i] = T_HILL;
            const roll = hash2(x, y, world.seed + 5);
            world.feature[i] = roll < 0.12 ? 'ore' : roll < 0.26 ? 'rock' : null;
        });
        // O acaso pode não ter deixado um bloco limpo: faz-se um a direito no meio.
        forEachInBlock(center.x, center.y, 2, (x, y) => {
            if (!inMap(x, y)) return;
            const i = idx(x, y);
            world.terrain[i] = T_HILL;
            world.feature[i] = x === center.x && y === center.y ? 'ore' : null;
        });
    }

    // A areia só faz sentido à beira de água: sem ela à volta, volta a relva.
    for (let y = 0; y < world.size; y++) {
        for (let x = 0; x < world.size; x++) {
            const i = idx(x, y);
            if (world.terrain[i] !== T_SAND) continue;
            let wet = false;
            for (let dy = -2; dy <= 2 && !wet; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    if (inMap(x + dx, y + dy) && world.terrain[idx(x + dx, y + dy)] === T_WATER) { wet = true; break; }
                }
            }
            if (!wet) world.terrain[i] = T_GRASS;
        }
    }
}

/**
 * Aplana uma casa de colina: passa a relva ao nível do chão e perde o que
 * tinha em cima (árvores, rochas). Usado pelo jogador (ver buildings.js) e ao
 * carregar a gravação, que guarda os índices das casas aplanadas.
 */
export function flattenTile(world, i) {
    world.terrain[i] = T_GRASS;
    world.elev[i] = 0;
    world.feature[i] = null;
}

/** Terra livre numa casa: nem água, nem colina, nem árvores, rochas, edifícios ou estradas. */
export function isFreeLand(world, x, y) {
    if (!inMap(x, y)) return false;
    const i = idx(x, y);
    const t = world.terrain[i];
    return (t === T_GRASS || t === T_MEADOW || t === T_SAND)
        && world.feature[i] === null
        && world.building[i] === null
        && world.road[i] === ROAD_NONE;
}

/** Todas as casas do bloco são terra livre. */
export function isFreeBlock(world, x, y, size) {
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            if (!isFreeLand(world, x + dx, y + dy)) return false;
        }
    }
    return true;
}

/** Um bloco onde cabe uma mina: tudo colina, sem nada em cima além de pelo menos uma veia de ouro. */
export function isMineBlock(world, x, y, size) {
    let ore = false;
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            if (!inMap(x + dx, y + dy)) return false;
            const i = idx(x + dx, y + dy);
            if (world.terrain[i] !== T_HILL || world.building[i] || world.road[i]) return false;
            const f = world.feature[i];
            if (f === 'ore') ore = true;
            else if (f !== null) return false;
        }
    }
    return ore;
}

/**
 * Conta os elementos `feature` à volta do bloco de lado `size` com o canto de
 * cima em (x, y): as casas com o centro a menos de `radius` do centro do
 * bloco, sem contar as do próprio bloco.
 */
export function countFeatureNear(world, x, y, size, feature, radius) {
    let total = 0;
    forEachInRadius(x + size / 2, y + size / 2, radius, (tx, ty) => {
        if (tx >= x && ty >= y && tx < x + size && ty < y + size) return;
        if (world.feature[idx(tx, ty)] === feature) total++;
    });
    return total;
}
