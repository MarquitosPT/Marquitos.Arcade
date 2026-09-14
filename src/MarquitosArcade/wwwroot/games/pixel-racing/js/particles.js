// Partículas: fumo, faíscas, marcas de travagem, chamas do boost e confetes.
//
// Tudo num array simples com filtragem por tempo de vida. São centenas de
// elementos de vida curta; um objeto por partícula com um `filter` por frame é
// mais do que suficiente a 60fps e evita a complicação de um pool.
//
// As marcas de travagem (`mark`) são o caso à parte: não se mexem e duram muito
// mais, para o rasto do drift ficar no asfalto.

import { clamp, pick, rand } from '/lib/arcade/math.js';
import { CAR_LEN, CAR_W } from './config.js';
import { race } from './state.js';

let particles = [];
let confettiParticles = [];

/** Limpa o rasto entre corridas — senão as marcas da pista anterior viajavam. */

export function resetParticles() {
    particles = [];
    confettiParticles = [];
}

export const hasConfetti = () => confettiParticles.length > 0;

function spawnParticle(p) { particles.push(p); }

export function spawnSmoke(car) {
    const back = -CAR_LEN * 0.55;
    const x = car.x + Math.cos(car.velAngle) * back, y = car.y + Math.sin(car.velAngle) * back;
    spawnParticle({ type: 'smoke', x, y, vx: rand(-12, 12), vy: rand(-12, 12), life: rand(0.4, 0.7), maxLife: 0.7, size: rand(4, 8), color: 'rgba(200,200,210,' });
}

export function spawnDriftSpark(car, side) {
    const backX = -CAR_LEN * 0.42, sideX = side * CAR_W * 0.45;
    const wx = car.x + Math.cos(car.velAngle) * backX + Math.cos(car.velAngle + Math.PI / 2) * sideX;
    const wy = car.y + Math.sin(car.velAngle) * backX + Math.sin(car.velAngle + Math.PI / 2) * sideX;
    spawnParticle({ type: 'spark', x: wx, y: wy, vx: rand(-40, 40), vy: rand(-40, 40), life: rand(0.15, 0.3), maxLife: 0.3, size: rand(2, 4), color: 'rgba(255,190,60,' });
    spawnParticle({ type: 'mark', x: wx, y: wy, angle: car.facing, life: 2.2, maxLife: 2.2, size: 5, color: 'rgba(15,12,10,' });
}

export function spawnBoostFlame(car) {
    const back = -CAR_LEN * 0.55;
    const x = car.x + Math.cos(car.velAngle) * back, y = car.y + Math.sin(car.velAngle) * back;
    spawnParticle({ type: 'flame', x, y, vx: -Math.cos(car.velAngle) * rand(60, 140) + rand(-20, 20), vy: -Math.sin(car.velAngle) * rand(60, 140) + rand(-20, 20), life: rand(0.2, 0.4), maxLife: 0.4, size: rand(6, 11), color: Math.random() < 0.5 ? 'rgba(255,120,20,' : 'rgba(255,220,60,' });
}

export function spawnPadBurst(car) {
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        spawnParticle({ type: 'spark', x: car.x, y: car.y, vx: Math.cos(a) * rand(60, 160), vy: Math.sin(a) * rand(60, 160), life: 0.5, maxLife: 0.5, size: rand(3, 5), color: 'rgba(255,240,90,' });
    }
}

export function spawnWallDust(car) {
    for (let i = 0; i < 8; i++) {
        spawnParticle({ type: 'smoke', x: car.x, y: car.y, vx: rand(-70, 70), vy: rand(-70, 70), life: rand(0.3, 0.6), maxLife: 0.6, size: rand(4, 9), color: 'rgba(190,170,120,' });
    }
}

/** Salpico escuro de quem está a patinar em cima de uma poça de óleo. */
export function spawnOilSpray(car) {
    for (let i = 0; i < 2; i++) {
        spawnParticle({
            type: 'smoke', x: car.x + rand(-10, 10), y: car.y + rand(-10, 10),
            vx: rand(-60, 60), vy: rand(-60, 60), life: rand(0.25, 0.5), maxLife: 0.5,
            size: rand(3, 7), color: 'rgba(40,35,55,'
        });
    }
}

export function spawnImpactSpark(x, y) {
    for (let i = 0; i < 10; i++) {
        const a = rand(0, Math.PI * 2);
        spawnParticle({ type: 'spark', x, y, vx: Math.cos(a) * rand(60, 150), vy: Math.sin(a) * rand(60, 150), life: 0.35, maxLife: 0.35, size: rand(2, 4), color: 'rgba(255,255,255,' });
    }
}

export function spawnDriftPerfectBurst(car) {
    for (let i = 0; i < 14; i++) {
        const a = rand(0, Math.PI * 2);
        spawnParticle({ type: 'flame', x: car.x, y: car.y, vx: Math.cos(a) * rand(40, 130), vy: Math.sin(a) * rand(40, 130), life: 0.5, maxLife: 0.5, size: rand(4, 8), color: 'rgba(60,230,255,' });
    }
}

export function updateParticles(dt) {
    for (const p of particles) {
        if (p.type !== 'mark') { p.x += p.vx * dt; p.y += p.vy * dt; }
        if (p.type === 'smoke') { p.vy -= 6 * dt; }
        p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
}

export function drawParticles() {
    const ctx = race.view.ctx;
    for (const p of particles) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        ctx.save();
        if (p.type === 'mark') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color + (a * 0.35) + ')';
            ctx.fillRect(-6, -1.5, 12, 3);
        } else {
            ctx.fillStyle = p.color + a + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.type === 'flame' ? (0.5 + a * 0.5) : 1), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

export function spawnConfetti() {
    confettiParticles = [];
    for (let i = 0; i < 90; i++) {
        confettiParticles.push({
            x: rand(0, race.view.width), y: rand(-race.view.height * 0.3, 0), vx: rand(-40, 40), vy: rand(60, 160),
            rot: rand(0, Math.PI * 2), vr: rand(-6, 6), size: rand(5, 10),
            color: pick(['#ffcf3f', '#00e5ff', '#ff2fa0', '#7cff2f', '#ff6a1a'])
        });
    }
}

export function updateConfetti(dt) {
    for (const c of confettiParticles) { c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.vy += 40 * dt; }
    confettiParticles = confettiParticles.filter(c => c.y < race.view.height + 30);
}

export function drawConfetti() {
    const ctx = race.view.ctx;
    for (const c of confettiParticles) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.6);
        ctx.restore();
    }
}
