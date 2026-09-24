// Primitivas de desenho isométrico: caixas, telhados, torres, cones.
//
// Tudo é desenhado à volta de um ponto de chão (o centro de um edifício), em
// unidades de mundo com zoom 1. A unidade no chão é o bloco de um edifício
// (`BUILDING_SIZE` casas de lado, 64 x 32 píxeis): as medidas das peças vêm em
// fração desse bloco no chão (a, b) e em píxeis na altura.
//
// A luz vem da esquerda e de cima: os tampos são os mais claros, as faces
// viradas para a esquerda (+y) ficam a meia-luz, as viradas para a direita
// (+x) ficam na sombra. É isto que dá volume a um desenho que é só polígonos.

import { BUILDING_SIZE, TILE_H, TILE_W } from './config.js';

const HW = (TILE_W * BUILDING_SIZE) / 2;
const HH = (TILE_H * BUILDING_SIZE) / 2;

/** Ponto de grelha relativo (gx, gy) a uma altura z -> ponto de ecrã relativo. */
export const P = (gx, gy, z = 0) => [(gx - gy) * HW, (gx + gy) * HH - z];

export function poly(ctx, points, fill, stroke = null) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
}

/** Lê #rrggbb ou rgb(r,g,b) — o `shade` devolve o segundo e pode ser encadeado. */
function parseColor(color) {
    if (color[0] === '#') {
        const n = parseInt(color.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const [r, g, b] = color.match(/\d+/g).map(Number);
    return [r, g, b];
}

/** Clareia (f > 0) ou escurece (f < 0) uma cor #rrggbb (ou rgb(...)). */
export function shade(color, f) {
    let [r, g, b] = parseColor(color);
    if (f >= 0) {
        r += (255 - r) * f;
        g += (255 - g) * f;
        b += (255 - b) * f;
    } else {
        r *= 1 + f;
        g *= 1 + f;
        b *= 1 + f;
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Losango de uma casa (ou fração dela), centrado em (ox, oy) de grelha. */
export function diamond(ctx, a = 1, b = 1, z = 0, fill = null, stroke = null, ox = 0, oy = 0) {
    poly(ctx, [
        P(ox - a / 2, oy - b / 2, z),
        P(ox + a / 2, oy - b / 2, z),
        P(ox + a / 2, oy + b / 2, z),
        P(ox - a / 2, oy + b / 2, z)
    ], fill, stroke);
}

/**
 * Caixa: planta a x b casas centrada em (ox, oy), da altura z à z + h.
 * `color` é a cor da parede; os três lados saem dela por sombreamento.
 */
export function box(ctx, a, b, h, color, { ox = 0, oy = 0, z = 0, top = null } = {}) {
    const x0 = ox - a / 2;
    const x1 = ox + a / 2;
    const y0 = oy - b / 2;
    const y1 = oy + b / 2;
    poly(ctx, [P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + h), P(x0, y1, z + h)], shade(color, -0.08));
    poly(ctx, [P(x1, y1, z), P(x1, y0, z), P(x1, y0, z + h), P(x1, y1, z + h)], shade(color, -0.3));
    poly(ctx, [P(x0, y0, z + h), P(x1, y0, z + h), P(x1, y1, z + h), P(x0, y1, z + h)], top || shade(color, 0.12));
}

/**
 * Telhado de duas águas por cima de uma caixa a x b, com a cumeeira ao longo
 * de x (`alongX`) ou de y. `wall` pinta a empena (o triângulo da parede).
 */
export function gable(ctx, a, b, z, rise, roof, wall, { ox = 0, oy = 0, alongX = true, over = 0.07 } = {}) {
    if (alongX) {
        const x0 = ox - a / 2 - over;
        const x1 = ox + a / 2 + over;
        const y0 = oy - b / 2 - over;
        const y1 = oy + b / 2 + over;
        poly(ctx, [P(x0, y0, z), P(x1, y0, z), P(x1, oy, z + rise), P(x0, oy, z + rise)], shade(roof, 0.05));
        poly(ctx, [P(ox + a / 2, oy - b / 2, z), P(ox + a / 2, oy + b / 2, z), P(ox + a / 2, oy, z + rise)], shade(wall, -0.3));
        poly(ctx, [P(x0, y1, z), P(x1, y1, z), P(x1, oy, z + rise), P(x0, oy, z + rise)], roof);
        ctx.strokeStyle = shade(roof, -0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(...P(x0, oy, z + rise));
        ctx.lineTo(...P(x1, oy, z + rise));
        ctx.stroke();
    } else {
        const x0 = ox - a / 2 - over;
        const x1 = ox + a / 2 + over;
        const y0 = oy - b / 2 - over;
        const y1 = oy + b / 2 + over;
        poly(ctx, [P(x0, y0, z), P(x0, y1, z), P(ox, y1, z + rise), P(ox, y0, z + rise)], shade(roof, 0.1));
        poly(ctx, [P(ox - a / 2, oy + b / 2, z), P(ox + a / 2, oy + b / 2, z), P(ox, oy + b / 2, z + rise)], shade(wall, -0.08));
        poly(ctx, [P(x1, y0, z), P(x1, y1, z), P(ox, y1, z + rise), P(ox, y0, z + rise)], shade(roof, -0.22));
        ctx.strokeStyle = shade(roof, -0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(...P(ox, y0, z + rise));
        ctx.lineTo(...P(ox, y1, z + rise));
        ctx.stroke();
    }
}

/** Telhado de quatro águas (pirâmide) por cima de uma caixa a x b. */
export function pyramid(ctx, a, b, z, rise, roof, { ox = 0, oy = 0, over = 0.06 } = {}) {
    const x0 = ox - a / 2 - over;
    const x1 = ox + a / 2 + over;
    const y0 = oy - b / 2 - over;
    const y1 = oy + b / 2 + over;
    const apex = P(ox, oy, z + rise);
    poly(ctx, [P(x0, y1, z), P(x1, y1, z), apex], roof);
    poly(ctx, [P(x1, y1, z), P(x1, y0, z), apex], shade(roof, -0.25));
}

/**
 * Torre redonda: cilindro de raio `r` píxeis e altura `h`, com a base à altura z.
 * Devolve o topo, para o chamador pôr lá um cone ou ameias.
 */
export function cylinder(ctx, r, h, color, { ox = 0, oy = 0, z = 0 } = {}) {
    const [cx, cy] = P(ox, oy, z);
    const ry = r * 0.5;
    const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    grad.addColorStop(0, shade(color, 0.1));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - h);
    ctx.lineTo(cx - r, cy);
    ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + r, cy - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(color, 0.18);
    ctx.beginPath();
    ctx.ellipse(cx, cy - h, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    return { x: cx, y: cy - h };
}

/** Telhado cónico (o das torres azuis dos castelos). */
export function cone(ctx, x, y, r, rise, color) {
    const ry = r * 0.5;
    const grad = ctx.createLinearGradient(x - r, 0, x + r, 0);
    grad.addColorStop(0, shade(color, 0.2));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, shade(color, -0.4));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.ellipse(x, y, r, ry, 0, Math.PI, 0, true);
    ctx.lineTo(x, y - rise);
    ctx.closePath();
    ctx.fill();
}

/** Ameias ao longo do topo de uma caixa: dentinhos na aresta da frente. */
export function crenels(ctx, a, b, z, color, { ox = 0, oy = 0, n = 4 } = {}) {
    const size = 3.5;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const gx = ox - a / 2 + a * t;
        box(ctx, 0.09, 0.09, size, color, { ox: gx, oy: oy + b / 2 - 0.045, z });
        const gy = oy - b / 2 + b * t;
        box(ctx, 0.09, 0.09, size, color, { ox: ox + a / 2 - 0.045, oy: gy, z });
    }
}

/** Sombra oval no chão. */
export function groundShadow(ctx, rx, ry, alpha = 0.22, dx = 4, dy = 2) {
    ctx.fillStyle = `rgba(20, 40, 10, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(dx, dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

/** Janela/porta pintada numa face: um retângulo inclinado ao longo da parede. */
export function wallPatch(ctx, side, a, b, u, w, z0, z1, color, { ox = 0, oy = 0 } = {}) {
    // side 'left' = face +y (ao longo de x); 'right' = face +x (ao longo de y).
    if (side === 'left') {
        const y = oy + b / 2 + 0.005;
        const xa = ox - a / 2 + a * u - w / 2;
        const xb = xa + w;
        poly(ctx, [P(xa, y, z0), P(xb, y, z0), P(xb, y, z1), P(xa, y, z1)], color);
    } else {
        const x = ox + a / 2 + 0.005;
        const ya = oy + b / 2 - b * u + w / 2;
        const yb = ya - w;
        poly(ctx, [P(x, ya, z0), P(x, yb, z0), P(x, yb, z1), P(x, ya, z1)], color);
    }
}
