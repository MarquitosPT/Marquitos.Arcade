// Partículas: o brilho de uma guloseima apanhada, a poeira de uma aterragem,
// os pedaços de um caixote e os "+50" que sobem. Só enfeitam — nada aqui mexe
// nas regras do jogo.

import { game } from './state.js';

const MAX_PARTICLES = 260;

function push(p) {
    if (game.particles.length >= MAX_PARTICLES) game.particles.shift();
    game.particles.push(p);
}

/** Um punhado de faíscas ou pedaços a saltar de (x, y), em tiles. */
export function burst(x, y, color, count = 8, { speed = 4, life = 0.5, size = 0.12, gravity = 10, kind = 'dot' } = {}) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.6);
        push({
            kind, x, y, color, size: size * (0.6 + Math.random() * 0.8),
            vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * 0.3,
            gravity, life, age: 0, spin: (Math.random() - 0.5) * 10, rot: Math.random() * Math.PI
        });
    }
}

/** Poeira aos pés, para os lados. */
export function dust(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
        const side = i % 2 ? 1 : -1;
        push({
            kind: 'puff', x, y, color: 'rgba(255, 255, 255, 0.75)', size: 0.12 + Math.random() * 0.1,
            vx: side * (1 + Math.random() * 1.5), vy: -0.5 - Math.random(), gravity: 0,
            life: 0.35, age: 0, spin: 0, rot: 0
        });
    }
}

/** Um texto a subir e a desaparecer: "+50", "+250"… */
export function popText(x, y, text, color = '#ffffff') {
    push({ kind: 'text', x, y, text, color, vx: 0, vy: -1.6, gravity: 0, life: 0.8, age: 0, size: 0.42, spin: 0, rot: 0 });
}

/** O anel de uma explosão. */
export function ring(x, y, radius, color) {
    push({ kind: 'ring', x, y, color, size: radius, vx: 0, vy: 0, gravity: 0, life: 0.45, age: 0, spin: 0, rot: 0 });
}

export function updateParticles(dt) {
    const list = game.particles;
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
            list.splice(i, 1);
            continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
    }
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
}
