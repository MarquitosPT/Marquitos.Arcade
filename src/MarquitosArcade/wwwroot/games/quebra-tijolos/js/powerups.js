// As cápsulas: caem de alguns tijolos partidos, e apanhá-las com a raquete dá
// um poder.
//
// Três delas mudam a raquete — larga, íman ou laser — e são exclusivas entre
// si: apanhar uma troca a que lá estava, como na máquina de salão. Duram até
// se perder a bola (o laser tem relógio). As outras somam-se: bola devagar
// (com relógio), três bolas e vida extra.
//
// Cada cápsula só começa a cair a partir de um nível (`from`), para os
// primeiros níveis apresentarem o jogo antes dos truques.

import {
    CAPSULE_CHANCE, CAPSULE_H, CAPSULE_MAX, CAPSULE_W, LASER_TIME, MAX_BALLS, MAX_LIVES, SLOW_TIME
} from './config.js';
import { setDirection } from './physics.js';
import { game } from './state.js';

export const CAPSULES = [
    { id: 'wide', letter: 'A', label: 'Raquete larga', color: '#4f7dff', from: 1, weight: 3 },
    { id: 'slow', letter: 'D', label: 'Bola devagar', color: '#ff9a3c', from: 1, weight: 3 },
    { id: 'multi', letter: 'M', label: 'Três bolas', color: '#3fd8f2', from: 2, weight: 3 },
    { id: 'life', letter: '+', label: 'Vida extra', color: '#ff6ec7', from: 3, weight: 0.7 },
    { id: 'catch', letter: 'C', label: 'Raquete-íman', color: '#4ade80', from: 4, weight: 2 },
    { id: 'laser', letter: 'L', label: 'Laser', color: '#ff4d6a', from: 7, weight: 2 }
];

export const capsuleById = (id) => CAPSULES.find((c) => c.id === id);

/** Talvez largue uma cápsula do sítio de um tijolo partido. */
export function maybeDropCapsule(brick) {
    if (game.capsules.length >= CAPSULE_MAX || Math.random() > CAPSULE_CHANCE) return;
    const pool = CAPSULES.filter((c) => c.from <= game.level.id
        && !(c.id === 'life' && game.lives >= MAX_LIVES)
        && !(c.id === 'multi' && game.balls.length >= MAX_BALLS));
    const total = pool.reduce((sum, c) => sum + c.weight, 0);
    let pick = Math.random() * total;
    const type = pool.find((c) => (pick -= c.weight) <= 0) || pool[0];
    game.capsules.push({
        type,
        x: brick.x + brick.w / 2 - CAPSULE_W / 2,
        y: brick.y + brick.h / 2 - CAPSULE_H / 2,
        spin: 0
    });
}

/** Aplica o poder de uma cápsula apanhada. */
export function applyCapsule(type) {
    switch (type.id) {
        case 'wide':
        case 'catch':
        case 'laser':
            setPaddleMode(type.id);
            break;
        case 'slow':
            game.timers.slow = SLOW_TIME;
            break;
        case 'multi':
            splitBalls();
            break;
        case 'life':
            game.lives = Math.min(MAX_LIVES, game.lives + 1);
            break;
        default:
            break;
    }
}

function setPaddleMode(mode) {
    // Ao largar o íman, as bolas que lá estavam coladas seguem viagem.
    if (game.paddle.mode === 'catch' && mode !== 'catch') {
        for (const ball of game.balls) if (ball.stuck && game.launched) ball.holdTimer = 0;
    }
    game.paddle.mode = mode;
    game.timers.laser = mode === 'laser' ? LASER_TIME : 0;
}

/** Cada bola que anda dá mais duas, abertas em leque. */
function splitBalls() {
    const moving = game.balls.filter((ball) => !ball.stuck);
    const sources = moving.length ? moving : game.balls.slice(0, 1);
    for (const source of sources) {
        for (const turn of [-0.42, 0.42]) {
            if (game.balls.length >= MAX_BALLS) return;
            const cos = Math.cos(turn);
            const sin = Math.sin(turn);
            const copy = {
                ...source,
                stuck: false,
                holdTimer: 0,
                trail: []
            };
            setDirection(copy, source.dx * cos - source.dy * sin, source.dx * sin + source.dy * cos);
            if (copy.dy > 0 && source.stuck) copy.dy = -copy.dy;
            game.balls.push(copy);
        }
    }
}

/** Perdeu-se a bola: os poderes vão com ela. */
export function clearPowers() {
    game.paddle.mode = null;
    game.timers.slow = 0;
    game.timers.laser = 0;
    game.capsules.length = 0;
    game.lasers.length = 0;
}
