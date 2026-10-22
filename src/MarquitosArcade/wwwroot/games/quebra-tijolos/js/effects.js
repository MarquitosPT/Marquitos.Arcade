// Efeitos visuais: estilhaços dos tijolos, pontos a flutuar, ondas das
// explosões e o abanão do ecrã. Só os dados e o passo do tempo — quem os
// desenha é o js/render.js, no mesmo referencial do campo.

import { rand } from '/lib/arcade/math.js';
import { game } from './state.js';

const MAX_PARTICLES = 260;

/** Estilhaços de um tijolo partido, na cor dele. */
export function burst(brick, color, count = 10) {
    for (let i = 0; i < count && game.particles.length < MAX_PARTICLES; i++) {
        game.particles.push({
            x: brick.x + rand(2, brick.w - 2),
            y: brick.y + rand(2, brick.h - 2),
            vx: rand(-110, 110),
            vy: rand(-140, 40),
            size: rand(2, 4.5),
            spin: rand(-8, 8),
            angle: rand(0, Math.PI),
            life: rand(0.45, 0.8),
            age: 0,
            color
        });
    }
}

/** Faíscas num ponto (a bola na raquete, o laser num tijolo). */
export function sparks(x, y, color, count = 6) {
    for (let i = 0; i < count && game.particles.length < MAX_PARTICLES; i++) {
        game.particles.push({
            x, y,
            vx: rand(-90, 90),
            vy: rand(-160, -30),
            size: rand(1.5, 2.5),
            spin: 0,
            angle: 0,
            life: rand(0.2, 0.4),
            age: 0,
            color
        });
    }
}

export function floater(x, y, text, color = '#ffffff') {
    game.floaters.push({ x, y, text, color, age: 0, life: 0.9 });
}

export function ring(x, y, color, radius = 46) {
    game.rings.push({ x, y, color, radius, age: 0, life: 0.45 });
}

export function shake(amount) {
    game.shake = Math.max(game.shake, amount);
}

export function clearEffects() {
    game.particles.length = 0;
    game.floaters.length = 0;
    game.rings.length = 0;
    game.shake = 0;
    game.flash = 0;
}

export function updateEffects(dt) {
    for (const p of game.particles) {
        p.age += dt;
        p.vy += 520 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
    }
    game.particles = game.particles.filter((p) => p.age < p.life);

    for (const f of game.floaters) {
        f.age += dt;
        f.y -= 34 * dt;
    }
    game.floaters = game.floaters.filter((f) => f.age < f.life);

    for (const r of game.rings) r.age += dt;
    game.rings = game.rings.filter((r) => r.age < r.life);

    game.shake = Math.max(0, game.shake - dt * 18);
    game.flash = Math.max(0, game.flash - dt * 3);
    for (const brick of game.bricks) if (brick.flash > 0) brick.flash = Math.max(0, brick.flash - dt * 6);
    game.paddle.glow = Math.max(0, game.paddle.glow - dt * 4);
}
