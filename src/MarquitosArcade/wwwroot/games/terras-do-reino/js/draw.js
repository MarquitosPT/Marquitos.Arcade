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
//
// Quando a vista roda (ver iso.js), as peças rodam com ela: as medidas vêm
// sempre na grelha da peça, e `P` passa-as para a grelha da vista antes de
// projetar. As caixas e os telhados pintam as faces que ficam viradas para
// quem olha, e as janelas e portas das faces que ficaram de costas não se
// pintam. A luz é a do ecrã — vem sempre da esquerda, rode a vista para onde
// rodar —, como no chão.

import { BUILDING_SIZE, TILE_H, TILE_W } from './config.js';
import { camera } from './iso.js';

const HW = (TILE_W * BUILDING_SIZE) / 2;
const HH = (TILE_H * BUILDING_SIZE) / 2;

/** Enquanto > 0, as peças não rodam com a vista (ver `unturned`). */
let fixed = 0;

/** Um deslocamento na grelha da peça -> na grelha da vista. */
function turn(gx, gy) {
    switch (fixed ? 0 : camera.rot) {
        case 1: return [-gy, gx];
        case 2: return [-gx, -gy];
        case 3: return [gy, -gx];
        default: return [gx, gy];
    }
}

/** Ponto da grelha da vista (vx, vy) a uma altura z -> ponto de ecrã relativo. */
const V = (vx, vy, z = 0) => [(vx - vy) * HW, (vx + vy) * HH - z];

/** Ponto de grelha relativo (gx, gy) a uma altura z -> ponto de ecrã relativo. */
export const P = (gx, gy, z = 0) => {
    const [vx, vy] = turn(gx, gy);
    return V(vx, vy, z);
};

/** Quão à frente está, na vista, um ponto da grelha da peça: para pintar de trás para a frente. */
export function depth(gx, gy) {
    const [vx, vy] = turn(gx, gy);
    return vx + vy;
}

/**
 * A face da peça virada para (nx, ny) — (0, 1) é a face +y, a 'left' da vista
 * sem rodar — como aparece agora: 'left', 'right', ou null se ficou de costas.
 */
export function faceOf(nx, ny) {
    const [vx, vy] = turn(nx, ny);
    if (vy > 0) return 'left';
    if (vx > 0) return 'right';
    return null;
}

/** Pinta de trás para a frente, na vista, as partes [gx, gy, desenho] de uma peça. */
export function layered(parts) {
    const order = parts.map((p) => ({ d: depth(p[0], p[1]), draw: p[2] }));
    order.sort((a, b) => a.d - b.d);
    for (const p of order) p.draw();
}

/**
 * Desenha sem rodar com a vista: para peças que se veem sempre do mesmo lado
 * (a mina, um monte de rocha com a entrada virada para quem olha).
 */
export function unturned(draw) {
    fixed++;
    try {
        draw();
    } finally {
        fixed--;
    }
}

/** Uma planta a x b centrada em (ox, oy) da peça -> a mesma planta na grelha da vista. */
function viewRect(a, b, ox, oy) {
    const [vx, vy] = turn(ox, oy);
    const odd = !fixed && camera.rot % 2 === 1;
    return { a: odd ? b : a, b: odd ? a : b, ox: vx, oy: vy, odd };
}

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
    const r = viewRect(a, b, ox, oy);
    boxView(ctx, r.a, r.b, h, color, { ox: r.ox, oy: r.oy, z, top });
}

/** A caixa já na grelha da vista: pinta as duas faces da frente e o tampo. */
function boxView(ctx, a, b, h, color, { ox = 0, oy = 0, z = 0, top = null } = {}) {
    const x0 = ox - a / 2;
    const x1 = ox + a / 2;
    const y0 = oy - b / 2;
    const y1 = oy + b / 2;
    poly(ctx, [V(x0, y1, z), V(x1, y1, z), V(x1, y1, z + h), V(x0, y1, z + h)], shade(color, -0.08));
    poly(ctx, [V(x1, y1, z), V(x1, y0, z), V(x1, y0, z + h), V(x1, y1, z + h)], shade(color, -0.3));
    poly(ctx, [V(x0, y0, z + h), V(x1, y0, z + h), V(x1, y1, z + h), V(x0, y1, z + h)], top || shade(color, 0.12));
}

/**
 * Buraco: planta a x b casas centrada em (ox, oy), aberto à altura z e com o
 * fundo à z - d. Pinta o fundo e as duas paredes de dentro que ficam de frente
 * para quem olha (as do lado de trás, na vista), recortados pela boca do
 * buraco; `strata` risca-as de camadas de rocha a cada tantos píxeis.
 */
export function hole(ctx, a, b, d, color, { ox = 0, oy = 0, z = 0, floor = null, strata = 0 } = {}) {
    ({ a, b, ox, oy } = viewRect(a, b, ox, oy));
    const x0 = ox - a / 2;
    const x1 = ox + a / 2;
    const y0 = oy - b / 2;
    const y1 = oy + b / 2;
    const zb = z - d;
    // Só se vê o que cabe na boca: o resto do fundo fica escondido pela borda da frente.
    ctx.save();
    ctx.beginPath();
    for (const p of [V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z)]) ctx.lineTo(...p);
    ctx.closePath();
    ctx.clip();
    poly(ctx, [V(x0, y0, zb), V(x1, y0, zb), V(x1, y1, zb), V(x0, y1, zb)], floor || shade(color, 0.06));
    // A parede do fundo vira-se para +y (meia-luz); a da esquerda para +x (sombra).
    poly(ctx, [V(x0, y0, z), V(x1, y0, z), V(x1, y0, zb), V(x0, y0, zb)], shade(color, -0.12));
    poly(ctx, [V(x0, y0, z), V(x0, y1, z), V(x0, y1, zb), V(x0, y0, zb)], shade(color, -0.34));
    if (strata) {
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = shade(color, -0.3);
    ctx.beginPath();
    for (let zz = z - strata; zz > zb + 0.5; zz -= strata) {
        ctx.moveTo(...V(x1, y0, zz));
        ctx.lineTo(...V(x0, y0, zz));
        ctx.lineTo(...V(x0, y1, zz));
    }
    ctx.stroke();
    }
    ctx.restore();
}

/**
 * Telhado de duas águas por cima de uma caixa a x b, com a cumeeira ao longo
 * de x (`alongX`) ou de y. `wall` pinta a empena (o triângulo da parede).
 */
export function gable(ctx, a, b, z, rise, roof, wall, { ox = 0, oy = 0, alongX = true, over = 0.07 } = {}) {
    // Na vista, a cumeeira de um quarto de volta ímpar passa para o outro eixo.
    const r = viewRect(a, b, ox, oy);
    ({ a, b, ox, oy } = r);
    if (r.odd) alongX = !alongX;
    if (alongX) {
        const x0 = ox - a / 2 - over;
        const x1 = ox + a / 2 + over;
        const y0 = oy - b / 2 - over;
        const y1 = oy + b / 2 + over;
        poly(ctx, [V(x0, y0, z), V(x1, y0, z), V(x1, oy, z + rise), V(x0, oy, z + rise)], shade(roof, 0.05));
        poly(ctx, [V(ox + a / 2, oy - b / 2, z), V(ox + a / 2, oy + b / 2, z), V(ox + a / 2, oy, z + rise)], shade(wall, -0.3));
        poly(ctx, [V(x0, y1, z), V(x1, y1, z), V(x1, oy, z + rise), V(x0, oy, z + rise)], roof);
        ctx.strokeStyle = shade(roof, -0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(...V(x0, oy, z + rise));
        ctx.lineTo(...V(x1, oy, z + rise));
        ctx.stroke();
    } else {
        const x0 = ox - a / 2 - over;
        const x1 = ox + a / 2 + over;
        const y0 = oy - b / 2 - over;
        const y1 = oy + b / 2 + over;
        poly(ctx, [V(x0, y0, z), V(x0, y1, z), V(ox, y1, z + rise), V(ox, y0, z + rise)], shade(roof, 0.1));
        poly(ctx, [V(ox - a / 2, oy + b / 2, z), V(ox + a / 2, oy + b / 2, z), V(ox, oy + b / 2, z + rise)], shade(wall, -0.08));
        poly(ctx, [V(x1, y0, z), V(x1, y1, z), V(ox, y1, z + rise), V(ox, y0, z + rise)], shade(roof, -0.22));
        ctx.strokeStyle = shade(roof, -0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(...V(ox, y0, z + rise));
        ctx.lineTo(...V(ox, y1, z + rise));
        ctx.stroke();
    }
}

/** Telhado de quatro águas (pirâmide) por cima de uma caixa a x b. */
export function pyramid(ctx, a, b, z, rise, roof, { ox = 0, oy = 0, over = 0.06 } = {}) {
    ({ a, b, ox, oy } = viewRect(a, b, ox, oy));
    const x0 = ox - a / 2 - over;
    const x1 = ox + a / 2 + over;
    const y0 = oy - b / 2 - over;
    const y1 = oy + b / 2 + over;
    const apex = V(ox, oy, z + rise);
    poly(ctx, [V(x0, y1, z), V(x1, y1, z), apex], roof);
    poly(ctx, [V(x1, y1, z), V(x1, y0, z), apex], shade(roof, -0.25));
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
    // Nas arestas da frente da vista, sejam elas quais forem na peça.
    ({ a, b, ox, oy } = viewRect(a, b, ox, oy));
    const size = 3.5;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const gx = ox - a / 2 + a * t;
        boxView(ctx, 0.09, 0.09, size, color, { ox: gx, oy: oy + b / 2 - 0.045, z });
        const gy = oy - b / 2 + b * t;
        boxView(ctx, 0.09, 0.09, size, color, { ox: ox + a / 2 - 0.045, oy: gy, z });
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
    // side 'left' = face +y (ao longo de x); 'right' = face +x (ao longo de y),
    // na peça. Se a vista rodada deixou essa face de costas, não se pinta.
    if (!faceOf(side === 'left' ? 0 : 1, side === 'left' ? 1 : 0)) return;
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
