// Os quatro bichos, e como se desenham.
//
// São desenhados no canvas, sem imagens: cabeça grande, olhos enormes com
// dois brilhos, corpo pequenino e pés que correm. Desenham-se em unidades de
// tile, com a origem nos pés — quem chama só diz onde e de que tamanho.
//
// Os quatro têm a mesma física de propósito: o quadro de pontuações é um só, e
// escolher a gatinha em vez do panda não pode ser escolher uma vantagem. A
// diferença é só a cara — e as orelhas, e a cauda.

const OUTLINE = '#3b2433';

export const ANIMALS = [
    {
        id: 'gato', name: 'Mimi', species: 'Gatinha',
        fur: '#f9a94b', dark: '#dc7f22', belly: '#ffe4bf', inner: '#ff9fb6', nose: '#ff7d9b'
    },
    {
        id: 'coelho', name: 'Pompom', species: 'Coelhinho',
        fur: '#f5f0fb', dark: '#cfc3e8', belly: '#ffffff', inner: '#ffb3c8', nose: '#ff8fb0'
    },
    {
        id: 'panda', name: 'Bambu', species: 'Pandinha',
        fur: '#ffffff', dark: '#2d2a36', belly: '#ffffff', inner: '#4a4656', nose: '#2d2a36'
    },
    {
        id: 'raposa', name: 'Ruiva', species: 'Raposinha',
        fur: '#ff7b3d', dark: '#cf5420', belly: '#fff3e6', inner: '#5c2a17', nose: '#3b2433'
    }
];

export const animalById = (id) => ANIMALS.find((a) => a.id === id) || ANIMALS[0];

/**
 * Desenha um bicho com os pés em (x, y), em píxeis, com `s` píxeis por tile.
 *
 * @param {object} pose
 * @param {number} [pose.facing=1] 1 para a direita, -1 para a esquerda.
 * @param {number} [pose.run=0] Fase da corrida (anda com a distância percorrida).
 * @param {number} [pose.speed=0] De 0 a 1: quanto se está a correr.
 * @param {number} [pose.vy=0] Velocidade vertical — no ar, as orelhas e os pés reagem.
 * @param {boolean} [pose.air=false]
 * @param {number} [pose.squash=0] Achatamento ao aterrar (positivo) ou ao saltar (negativo).
 * @param {boolean} [pose.blink=false]
 * @param {boolean} [pose.hurt=false] Olhos fechados com força.
 * @param {boolean} [pose.happy=false] Boca aberta de contente.
 */
export function drawAnimal(ctx, animal, x, y, s, pose = {}) {
    const { facing = 1, run = 0, speed = 0, vy = 0, air = false, squash = 0, blink = false, hurt = false, happy = false } = pose;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * facing * (1 + squash * 0.5), s * (1 - squash * 0.5));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.045;
    ctx.strokeStyle = OUTLINE;

    const bob = air ? 0 : Math.abs(Math.sin(run)) * 0.05 * speed;
    const stride = air ? 0 : Math.sin(run) * 0.12 * speed;

    drawTail(ctx, animal, run, speed, air);

    // Pés: dois feijões que correm.
    ctx.fillStyle = animal.dark;
    for (const [side, offset] of [[-1, stride], [1, -stride]]) {
        const fx = side * 0.13 + offset;
        const fy = air ? -0.02 + (vy < 0 ? -0.05 : 0.02) * side : -0.05;
        ellipse(ctx, fx, fy, 0.11, 0.065, 0, true, true);
    }

    // Corpo pequenino.
    ctx.save();
    ctx.translate(0, -bob);
    ctx.fillStyle = animal.id === 'panda' ? animal.dark : animal.fur;
    ellipse(ctx, 0, -0.27, 0.26, 0.23, 0, true, true);
    ctx.fillStyle = animal.belly;
    ellipse(ctx, 0.03, -0.24, 0.15, 0.13, 0, true, false);

    // Bracinhos: no ar abrem-se.
    ctx.fillStyle = animal.id === 'panda' ? animal.dark : animal.fur;
    const armLift = air ? (vy < 0 ? -0.12 : -0.05) : stride * 0.4;
    ellipse(ctx, 0.2, -0.3 + armLift, 0.08, 0.06, 0.4, true, true);

    // A cabeça, grande, com tudo o que a faz fofinha.
    drawHead(ctx, animal, { vy, air, blink, hurt, happy });
    ctx.restore();

    ctx.restore();
}

function drawHead(ctx, a, { vy, air, blink, hurt, happy }) {
    const hy = -0.74;
    drawEars(ctx, a, hy, vy, air);

    ctx.fillStyle = a.fur;
    circle(ctx, 0, hy, 0.43, true, true);

    if (a.id === 'raposa') {
        // Focinho branco e as faces.
        ctx.fillStyle = a.belly;
        ctx.beginPath();
        ctx.moveTo(-0.38, hy + 0.05);
        ctx.quadraticCurveTo(-0.15, hy + 0.42, 0.05, hy + 0.4);
        ctx.quadraticCurveTo(0.3, hy + 0.42, 0.42, hy + 0.05);
        ctx.quadraticCurveTo(0.2, hy + 0.12, 0.05, hy - 0.02);
        ctx.quadraticCurveTo(-0.15, hy + 0.12, -0.38, hy + 0.05);
        ctx.fill();
    }
    if (a.id === 'gato') {
        // Três riscas na testa.
        ctx.strokeStyle = a.dark;
        ctx.lineWidth = 0.05;
        for (const dx of [-0.09, 0, 0.09]) {
            ctx.beginPath();
            ctx.moveTo(dx, hy - 0.4);
            ctx.lineTo(dx * 1.1, hy - 0.27);
            ctx.stroke();
        }
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 0.045;
    }
    if (a.id === 'panda') {
        // As manchas à volta dos olhos.
        ctx.fillStyle = a.dark;
        ellipse(ctx, -0.12, hy + 0.02, 0.14, 0.18, 0.5, true, false);
        ellipse(ctx, 0.2, hy + 0.02, 0.14, 0.18, -0.5, true, false);
    }

    // Bochechas cor-de-rosa.
    ctx.fillStyle = 'rgba(255, 120, 150, 0.45)';
    ellipse(ctx, -0.26, hy + 0.14, 0.08, 0.05, 0, true, false);
    ellipse(ctx, 0.32, hy + 0.14, 0.08, 0.05, 0, true, false);

    // Olhos enormes, a olhar para a frente.
    const eyes = [[-0.12, hy - 0.01], [0.2, hy - 0.01]];
    for (const [ex, ey] of eyes) {
        if (hurt) {
            ctx.lineWidth = 0.05;
            ctx.beginPath();
            ctx.moveTo(ex - 0.08, ey - 0.06);
            ctx.lineTo(ex + 0.06, ey);
            ctx.lineTo(ex - 0.08, ey + 0.06);
            ctx.stroke();
            continue;
        }
        if (blink) {
            ctx.lineWidth = 0.045;
            ctx.beginPath();
            ctx.arc(ex, ey, 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
            continue;
        }
        ctx.fillStyle = '#ffffff';
        ellipse(ctx, ex, ey, 0.115, 0.14, 0, true, false);
        ctx.fillStyle = '#2a1b2a';
        ellipse(ctx, ex + 0.025, ey + 0.015, 0.09, 0.11, 0, true, false);
        ctx.fillStyle = '#ffffff';
        circle(ctx, ex - 0.005, ey - 0.035, 0.038, true, false);
        circle(ctx, ex + 0.06, ey + 0.05, 0.018, true, false);
    }

    // Nariz e boca.
    ctx.fillStyle = a.nose;
    ellipse(ctx, 0.05, hy + 0.12, 0.045, 0.03, 0, true, false);
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    if (happy || (air && vy < 0)) {
        ctx.fillStyle = '#c2405f';
        ellipse(ctx, 0.05, hy + 0.22, 0.05, 0.045, 0, true, true);
    } else {
        ctx.moveTo(-0.02, hy + 0.17);
        ctx.quadraticCurveTo(0.015, hy + 0.21, 0.05, hy + 0.16);
        ctx.quadraticCurveTo(0.085, hy + 0.21, 0.12, hy + 0.17);
        ctx.stroke();
    }
    ctx.lineWidth = 0.045;
}

function drawEars(ctx, a, hy, vy, air) {
    const droop = air ? Math.max(-0.15, Math.min(0.2, vy * 0.012)) : 0;
    ctx.lineWidth = 0.045;
    if (a.id === 'gato' || a.id === 'raposa') {
        const tall = a.id === 'raposa' ? 0.42 : 0.3;
        for (const side of [-1, 1]) {
            const bx = side * 0.24 + 0.03;
            ctx.fillStyle = a.fur;
            ctx.beginPath();
            ctx.moveTo(bx - 0.15, hy - 0.26);
            ctx.lineTo(bx + side * 0.06, hy - 0.3 - tall + droop);
            ctx.lineTo(bx + 0.15, hy - 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = a.inner;
            ctx.beginPath();
            ctx.moveTo(bx - 0.08, hy - 0.3);
            ctx.lineTo(bx + side * 0.05, hy - 0.26 - tall * 0.8 + droop);
            ctx.lineTo(bx + 0.08, hy - 0.32);
            ctx.closePath();
            ctx.fill();
        }
        return;
    }
    if (a.id === 'coelho') {
        for (const side of [-1, 1]) {
            const bx = side * 0.13 + 0.03;
            const tilt = side * 0.18 + droop * side * 1.5;
            ctx.save();
            ctx.translate(bx, hy - 0.32);
            ctx.rotate(tilt);
            ctx.fillStyle = a.fur;
            ellipse(ctx, 0, -0.3, 0.1, 0.32, 0, true, true);
            ctx.fillStyle = a.inner;
            ellipse(ctx, 0, -0.28, 0.05, 0.24, 0, true, false);
            ctx.restore();
        }
        return;
    }
    // Panda: orelhas redondas e pretas.
    ctx.fillStyle = a.dark;
    circle(ctx, -0.27, hy - 0.32, 0.13, true, true);
    circle(ctx, 0.33, hy - 0.32, 0.13, true, true);
}

function drawTail(ctx, a, run, speed, air) {
    const wag = Math.sin(run * 0.5) * 0.15 * (0.4 + speed) + (air ? -0.1 : 0);
    ctx.lineWidth = 0.045;
    if (a.id === 'gato') {
        ctx.strokeStyle = a.dark;
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(-0.22, -0.25);
        ctx.quadraticCurveTo(-0.48, -0.3 + wag, -0.42, -0.62 + wag);
        ctx.stroke();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 0.045;
        return;
    }
    if (a.id === 'coelho') {
        ctx.fillStyle = '#ffffff';
        circle(ctx, -0.27, -0.3, 0.1, true, true);
        return;
    }
    if (a.id === 'panda') {
        ctx.fillStyle = a.dark;
        circle(ctx, -0.25, -0.32, 0.07, true, false);
        return;
    }
    // Raposa: cauda farfalhuda com a ponta branca.
    ctx.save();
    ctx.translate(-0.22, -0.28);
    ctx.rotate(-0.7 + wag);
    ctx.fillStyle = a.fur;
    ellipse(ctx, -0.22, 0, 0.26, 0.13, 0, true, true);
    ctx.fillStyle = a.belly;
    ellipse(ctx, -0.4, 0, 0.09, 0.085, 0, true, false);
    ctx.restore();
}

function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, rot, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

/**
 * Um retrato do bicho num canvas (o cartão de escolha no menu): a cabeça e o
 * corpo inteiros, a olhar para quem escolhe.
 */
export function paintPortrait(canvas, animal, { happy = false } = {}) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / 1.25, h / 1.75);
    drawAnimal(ctx, animal, w / 2, h - s * 0.12, s, { happy });
}
