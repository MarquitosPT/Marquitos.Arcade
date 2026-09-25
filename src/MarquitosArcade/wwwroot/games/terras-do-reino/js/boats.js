// Os barcos das cabanas de pesca.
//
// Cada trabalhador de uma cabana de pesca é um pescador com o seu barco: sai
// do cais, rema pelo lago até um sítio, pesca à cana um bocado — de vez em
// quando um peixe salta na ponta da linha —, muda de sítio ou volta ao cais a
// descansar, e sai outra vez. Como a gente nas estradas (ver walkers.js), só
// se vê: o peixe entra no armazém pela receita da cabana, e nada disto se
// guarda.
//
// Os barcos andam só por casas de lago, a partir do cais, e não se afastam
// dele mais do que `BOAT_RANGE` casas. Quando a cabana para (sem
// trabalhadores, parada pelo jogador, armazém cheio), os barcos voltam ao cais
// e recolhem; se for demolida, desaparecem.

import { BOAT_FISH_MAX, BOAT_FISH_MIN, BOAT_RANGE, BOAT_SPEED, BUILDING } from './config.js';
import { fx, game } from './state.js';
import { SIDES, T_WATER, idx, inMap, shoreSide } from './world.js';

/** Segundos a aparecer no cais e a desaparecer ao recolher. */
const FADE = 0.5;
/** Segundos parado no cais entre duas saídas. */
const REST_MIN = 2;
const REST_MAX = 5;
/** Quanto dura um peixe fora de água, na ponta da linha. */
export const CATCH_SECONDS = 0.9;

const STEPS = [...SIDES, [1, 1], [1, -1], [-1, 1], [-1, -1]];

const SHIRTS = ['#3f6fb5', '#b8483a', '#5d8c3a', '#c98a2c', '#2f8a8a', '#d9d2c0'];
const HULLS = ['#8a5a30', '#7a4f2c', '#9a6a3f', '#6f5a44'];
const SKIN = ['#f1c9a0', '#dca47a', '#b97d52', '#8a5a3a'];
const HATS = ['#d8b14a', '#c9a36b', '#6b4a2b', '#3f63b8'];

const isWater = (x, y) => inMap(x, y) && game.world.terrain[idx(x, y)] === T_WATER;

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * O cais de uma cabana: a casa de lago onde os barcos atracam. É a da ponta do
 * cais, se lá houver água; senão a casa de lago mais perto do centro da cabana.
 * O lago não muda, por isso guarda-se no próprio edifício (não vai à gravação).
 */
function dockOf(b) {
    if (b.dock !== undefined) return b.dock;
    const size = b.size;
    const { side, reach } = shoreSide(game.world, b.x, b.y, size);
    let dock = null;
    if (reach) {
        const [dx, dy] = SIDES[side];
        // Na ponta do cais: a fila onde a água começa, e a seguinte.
        for (let d = reach; d <= reach + 1 && !dock; d++) {
            for (let k = size - 1; k >= 0 && !dock; k--) {
                const x = dx > 0 ? b.x + size - 1 + d : dx < 0 ? b.x - d : b.x + k;
                const y = dy > 0 ? b.y + size - 1 + d : dy < 0 ? b.y - d : b.y + k;
                if (isWater(x, y)) dock = { x, y };
            }
        }
    }
    if (!dock) {
        const cx = b.x + size / 2;
        const cy = b.y + size / 2;
        let best = Infinity;
        const r = Math.ceil(BUILDING.fishery.near.radius) + 1;
        for (let y = b.y - r; y < b.y + size + r; y++) {
            for (let x = b.x - r; x < b.x + size + r; x++) {
                if (!isWater(x, y)) continue;
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
                if (d < best) {
                    best = d;
                    dock = { x, y };
                }
            }
        }
    }
    b.dock = dock;
    return dock;
}

/**
 * Todas as casas de lago que se alcançam a partir de (sx, sy) sem sair de
 * `BOAT_RANGE` casas do cais, com o caminho até cada uma. Na diagonal só se
 * passa se as duas casas do lado também forem água — nada de cortar esquinas
 * de terra.
 */
function waterFrom(sx, sy, dock) {
    const size = game.world.size;
    const prev = new Map([[idx(sx, sy), -1]]);
    const queue = [idx(sx, sy)];
    for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        const x = i % size;
        const y = (i - x) / size;
        for (const [dx, dy] of STEPS) {
            const nx = x + dx;
            const ny = y + dy;
            if (!isWater(nx, ny)) continue;
            if (dx && dy && (!isWater(x + dx, y) || !isWater(x, y + dy))) continue;
            if (Math.hypot(nx - dock.x, ny - dock.y) > BOAT_RANGE) continue;
            const j = idx(nx, ny);
            if (prev.has(j)) continue;
            prev.set(j, i);
            queue.push(j);
        }
    }
    const pathTo = (goal) => {
        const path = [];
        for (let i = goal; i !== -1; i = prev.get(i)) path.push({ x: i % size, y: Math.floor(i / size) });
        return path.reverse();
    };
    return { cells: queue, pathTo };
}

/**
 * Para que lado lançar a linha: o bordo com água onde a boia cai (a mais de
 * uma casa, ver `drawRod` em render.js). Com água dos dois lados, ao acaso.
 */
function castSide(boat) {
    const at = boat.path[boat.path.length - 1];
    const len = Math.hypot(boat.dir.x, boat.dir.y) || 1;
    const wet = (side) => isWater(
        Math.floor(at.x + 0.5 - (boat.dir.y / len) * side * 1.3),
        Math.floor(at.y + 0.5 + (boat.dir.x / len) * side * 1.3)
    );
    const right = wet(1);
    const left = wet(-1);
    if (right !== left) return right ? 1 : -1;
    return Math.random() < 0.5 ? 1 : -1;
}

/** Uma volta de (x, y) até outro sítio de pesca, ou de volta ao cais. */
function route(boat, home) {
    const from = boat.path[boat.path.length - 1];
    const water = waterFrom(from.x, from.y, boat.dock);
    let goal = idx(boat.dock.x, boat.dock.y);
    if (!home) {
        // Longe do sítio onde está e dos outros barcos da mesma cabana, que um
        // lago não se pesca todo no mesmo palmo.
        const others = fx.boats.filter((o) => o !== boat && o.home === boat.home).map((o) => o.path[o.path.length - 1]);
        const spots = water.cells.filter((i) => {
            const x = i % game.world.size;
            const y = Math.floor(i / game.world.size);
            return Math.hypot(x - from.x, y - from.y) >= 1.5 && others.every((o) => Math.hypot(x - o.x, y - o.y) >= 1.5);
        });
        if (!spots.length) return false;
        goal = pick(spots);
    }
    boat.path = water.pathTo(goal);
    boat.pos = 0;
    return true;
}

function launch(b, dock) {
    const boat = {
        home: b,
        dock,
        path: [dock],
        pos: 0,
        /** 'rest' no cais, 'row' a remar, 'fish' a pescar, 'back' a voltar para recolher. */
        state: 'rest',
        timer: 0.4 + Math.random(),
        age: 0,
        leaving: 0,
        speed: BOAT_SPEED * (0.85 + Math.random() * 0.3),
        /** Para onde aponta a proa, na grelha: fica a última direção em que remou. */
        dir: { x: 1, y: 0 },
        /** De que lado do barco lança a linha: 1 à direita da proa, -1 à esquerda. */
        cast: Math.random() < 0.5 ? 1 : -1,
        /** Um peixe na linha: segundos desde que mordeu (ou -1). */
        bite: -1,
        nextBite: 2 + Math.random() * 4,
        hull: pick(HULLS),
        shirt: pick(SHIRTS),
        skin: pick(SKIN),
        hat: pick(HATS),
        seed: Math.random() * 10
    };
    fx.boats.push(boat);
    return boat;
}

/** Quantos barcos devem andar na água por cabana: um por trabalhador, com a cabana a trabalhar. */
function wanted(b) {
    return b.status === 'ok' ? BUILDING[b.kind].workers || 0 : 0;
}

function stepBoat(boat, dt, keep) {
    boat.age += dt;
    if (!keep) {
        // A cabana parou: quem está no cais recolhe já, quem está na água volta.
        if (boat.state === 'rest') boat.state = 'gone';
        else if (boat.state === 'row' || boat.state === 'fish') {
            boat.state = 'back';
            route(boat, true);
        }
    }
    if (boat.state === 'row' || boat.state === 'back') {
        const k = Math.min(Math.floor(boat.pos), boat.path.length - 2);
        if (k >= 0) {
            const a = boat.path[k];
            const b = boat.path[k + 1];
            boat.dir = { x: b.x - a.x, y: b.y - a.y };
            // Na diagonal a casa seguinte está mais longe: o barco não acelera.
            boat.pos = Math.min(boat.path.length - 1, boat.pos + (boat.speed * dt) / Math.hypot(boat.dir.x, boat.dir.y));
        }
        if (boat.pos < boat.path.length - 1) return;
        if (boat.state === 'back') {
            boat.state = keep ? 'rest' : 'gone';
            boat.timer = REST_MIN + Math.random() * (REST_MAX - REST_MIN);
            boat.path = [boat.dock];
            boat.pos = 0;
            return;
        }
        boat.state = 'fish';
        boat.timer = BOAT_FISH_MIN + Math.random() * (BOAT_FISH_MAX - BOAT_FISH_MIN);
        boat.cast = castSide(boat);
        boat.bite = -1;
        boat.nextBite = 1.5 + Math.random() * 3;
        return;
    }

    boat.timer -= dt;
    if (boat.state === 'fish') {
        if (boat.bite >= 0) {
            boat.bite += dt;
            if (boat.bite >= CATCH_SECONDS) {
                boat.bite = -1;
                boat.nextBite = 2 + Math.random() * 4;
            }
        } else if ((boat.nextBite -= dt) <= 0) {
            boat.bite = 0;
        }
        if (boat.timer <= 0 && boat.bite < 0) {
            // Muda de sítio ou vai descansar ao cais.
            const home = Math.random() < 0.35;
            boat.state = home ? 'back' : 'row';
            if (!route(boat, home)) boat.state = 'fish';
        }
        return;
    }

    if (boat.state === 'rest' && boat.timer <= 0) {
        boat.state = 'row';
        if (!route(boat, false)) boat.timer = REST_MAX;
    }
}

/**
 * Rema com todos os barcos e põe mais na água se faltarem.
 * @param {number} dt Segundos de jogo (0 com o jogo em pausa).
 */
export function stepBoats(dt) {
    if (!game.world || dt <= 0) return;

    const fisheries = game.buildings.filter((b) => b.kind === 'fishery');
    const count = new Map();
    for (const boat of fx.boats) {
        if (!fisheries.includes(boat.home)) boat.state = 'gone';
        if (boat.state !== 'gone') {
            // Um barco é um trabalhador: conta até ao que a cabana quer, o resto volta ao cais.
            const n = (count.get(boat.home) || 0) + 1;
            count.set(boat.home, n);
            stepBoat(boat, dt, n <= wanted(boat.home));
        }
        if (boat.state === 'gone') boat.leaving += dt;
    }
    fx.boats = fx.boats.filter((boat) => boat.leaving < FADE);

    for (const b of fisheries) {
        const dock = dockOf(b);
        if (!dock) continue;
        const have = fx.boats.filter((boat) => boat.home === b && boat.state !== 'gone').length;
        for (let n = have; n < wanted(b); n++) launch(b, dock);
    }
}

/**
 * Onde está o barco: ponto de grelha (ao centro das casas, com o balanço de
 * cada um), a casa onde se desenha — das duas entre as quais vai, a mais à
 * frente na vista, escolhe-a quem desenha — e para onde aponta a proa.
 */
export function boatPlace(boat) {
    const k = Math.max(0, Math.min(Math.floor(boat.pos), boat.path.length - 2));
    const a = boat.path[k];
    const b = boat.path[Math.min(k + 1, boat.path.length - 1)];
    const f = boat.path.length > 1 ? boat.pos - k : 0;
    // Parado, o barco fica um pouco ao lado do centro da casa: dois barcos no mesmo sítio não se sobrepõem.
    const still = boat.state === 'fish' || boat.state === 'rest';
    const jx = still ? Math.sin(boat.seed * 3.1) * 0.15 : 0;
    const jy = still ? Math.cos(boat.seed * 2.3) * 0.15 : 0;
    return {
        gx: a.x + 0.5 + (b.x - a.x) * f + jx,
        gy: a.y + 0.5 + (b.y - a.y) * f + jy,
        from: a,
        to: b,
        dir: boat.dir
    };
}

/** Transparência do barco a sair do cais pela primeira vez ou a recolher. */
export function boatAlpha(boat) {
    return Math.max(0, Math.min(1, boat.age / FADE, 1 - boat.leaving / FADE));
}
