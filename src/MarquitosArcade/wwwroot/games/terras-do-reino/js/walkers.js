// A gente nas estradas.
//
// Onde há estradas, o povo anda por elas: sai de um edifício que dê para a
// estrada, vai a pé até outro e entra. Só se vê — não mexe na economia nem se
// guarda —, mas é o que faz um reino parecer vivo, e é a recompensa de ligar
// os edifícios por estradas: sem estrada ninguém sai de casa.
//
// As "portas" de um edifício são as casas de estrada encostadas ao bloco dele.
// Cada um anda só pela sua rede: o povo do reino pelas estradas do jogador, o
// de cada vila pelas ruas dela. Quanto mais moradores, mais gente na rua.

import { MAX_WALKERS, RESIDENTS_PER_WALKER, TOWNS, WALK_SPEED } from './config.js';
import { fx, game } from './state.js';
import { ROAD_PLAYER, ROAD_TOWN, idx, inMap } from './world.js';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Segundos a aparecer à porta e a desaparecer ao entrar. */
const FADE = 0.4;
/** De quanto em quanto tempo sai mais alguém, se ainda houver lugar na rua. */
const SPAWN_EVERY = 0.35;
const TOWN_MAX_WALKERS = 7;

const SHIRTS = ['#3f6fb5', '#b8483a', '#5d8c3a', '#8a5aa8', '#c98a2c', '#2f8a8a', '#d9d2c0'];
const HAIR = ['#3b2a1c', '#6b4a2b', '#1f1a16', '#b0823f', '#8c8c8c'];
const SKIN = ['#f1c9a0', '#dca47a', '#b97d52', '#8a5a3a'];

/** Portas por grupo: 'player' e o índice de cada vila. Refeitas quando as estradas ou os edifícios mudam. */
let doors = { key: '', groups: new Map() };
const spawnTimers = new Map();

function doorsFor(group) {
    const key = `${game.roadsVersion}|${game.buildings.length}|${game.world.seed}`;
    if (doors.key !== key) {
        doors = { key, groups: findDoors() };
        // Quem ia por uma estrada que já não existe vai-se embora.
        fx.walkers = fx.walkers.filter((w) => w.path.every((c) => game.world.road[idx(c.x, c.y)] === w.road));
    }
    return doors.groups.get(group) || [];
}

function findDoors() {
    const world = game.world;
    const size = world.size;
    const groups = new Map();
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const road = world.road[idx(x, y)];
            if (!road) continue;
            const seen = new Set();
            for (const [dx, dy] of SIDES) {
                if (!inMap(x + dx, y + dy)) continue;
                const b = world.building[idx(x + dx, y + dy)];
                if (!b || seen.has(b)) continue;
                const group = b.owner === 'player' ? 'player' : b.owner;
                // Uma porta só serve a gente da mesma rede: o povo do reino não sai para as ruas de uma vila.
                if ((group === 'player') !== (road === ROAD_PLAYER)) continue;
                seen.add(b);
                if (!groups.has(group)) groups.set(group, []);
                groups.get(group).push({ x, y, b });
            }
        }
    }
    return groups;
}

/** O caminho mais curto pela rede `road` de uma porta a outra (com as pontas), ou null. */
function pathBetween(from, to, road) {
    const world = game.world;
    const size = world.size;
    const start = idx(from.x, from.y);
    const goal = idx(to.x, to.y);
    const prev = new Int32Array(size * size).fill(-1);
    prev[start] = start;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        if (i === goal) break;
        const x = i % size;
        const y = (i - x) / size;
        for (const [dx, dy] of SIDES) {
            const nx = x + dx;
            const ny = y + dy;
            if (!inMap(nx, ny)) continue;
            const j = idx(nx, ny);
            if (prev[j] !== -1 || world.road[j] !== road) continue;
            prev[j] = i;
            queue.push(j);
        }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let i = goal; ; i = prev[i]) {
        path.push({ x: i % size, y: Math.floor(i / size) });
        if (i === start) break;
    }
    return path.reverse();
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function spawn(group) {
    const list = doorsFor(group);
    if (list.length < 2) return;
    const road = group === 'player' ? ROAD_PLAYER : ROAD_TOWN;
    const from = pick(list);
    // Umas quantas tentativas de destino: pode calhar uma porta do mesmo
    // edifício ou uma estrada que não liga.
    for (let tries = 0; tries < 4; tries++) {
        const to = pick(list);
        if (to.b === from.b) continue;
        const path = pathBetween(from, to, road);
        if (!path || path.length < 3) continue;
        const town = group === 'player' ? null : TOWNS[group];
        fx.walkers.push({
            group,
            road,
            path,
            pos: 0,
            age: 0,
            leaving: 0,
            speed: WALK_SPEED * (0.8 + Math.random() * 0.4),
            shirt: town && Math.random() < 0.6 ? town.roof : pick(SHIRTS),
            hair: pick(HAIR),
            skin: pick(SKIN),
            load: Math.random() < 0.3,
            side: Math.random() < 0.5 ? 1 : -1,
            seed: Math.random() * 10
        });
        return;
    }
}

/** Quanta gente deve andar na rua de cada grupo. */
function wanted(group) {
    if (group === 'player') return Math.min(MAX_WALKERS, Math.floor(game.derived.residents / RESIDENTS_PER_WALKER));
    const town = game.towns[group];
    return town ? Math.min(TOWN_MAX_WALKERS, Math.floor(town.n / 2)) : 0;
}

/**
 * Anda com toda a gente e põe mais na rua se faltar.
 * @param {number} dt Segundos de jogo (0 com o jogo em pausa).
 */
export function stepWalkers(dt) {
    if (!game.world || dt <= 0) return;
    for (const w of fx.walkers) {
        w.age += dt;
        if (w.pos < w.path.length - 1) w.pos = Math.min(w.path.length - 1, w.pos + w.speed * dt);
        else w.leaving += dt;
    }
    fx.walkers = fx.walkers.filter((w) => w.leaving < FADE);

    const groups = ['player', ...game.towns.map((_, k) => k)];
    for (const group of groups) {
        const timer = (spawnTimers.get(group) || 0) + dt;
        spawnTimers.set(group, timer);
        if (timer < SPAWN_EVERY) continue;
        spawnTimers.set(group, 0);
        let count = 0;
        for (const w of fx.walkers) if (w.group === group) count++;
        if (count < wanted(group)) spawn(group);
    }
}

/**
 * Onde está a pessoa: ponto de grelha, as duas casas entre as quais vai
 * (quem desenha escolhe a mais à frente na vista, para os pés não ficarem por
 * baixo do chão da seguinte) e o passo que leva, em casas.
 */
export function walkerPlace(w) {
    const k = Math.min(Math.floor(w.pos), w.path.length - 2);
    const f = w.pos - k;
    const a = w.path[k];
    const b = w.path[k + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Cada um anda do seu lado da estrada, como deve ser.
    const off = 0.2 * w.side;
    const gx = a.x + 0.5 + dx * f - dy * off;
    const gy = a.y + 0.5 + dy * f + dx * off;
    return { gx, gy, from: a, to: b, dx, dy };
}

/** Transparência de quem está a sair de casa ou a entrar. */
export function walkerAlpha(w) {
    return Math.min(1, w.age / FADE, 1 - w.leaving / FADE);
}
