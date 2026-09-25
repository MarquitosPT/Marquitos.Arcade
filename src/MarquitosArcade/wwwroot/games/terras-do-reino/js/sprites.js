// Os desenhos do reino: árvores, rochas, montes, campos, casas, oficinas e castelos.
//
// Não há imagens: cada peça é desenhada com as primitivas de draw.js, à volta
// do ponto de chão da sua casa. Cada desenho tem duas partes:
//
//   - a estática (`STATIC`), que não muda de frame para frame e por isso é
//     guardada numa cache de imagens (ver spriteCache.js);
//   - a viva (`LIVE`), desenhada a cada frame por cima: as pás do moinho, o
//     fumo da padaria, as vacas, a bandeira do castelo, o brilho do ouro.
//
// Um edifício novo precisa de uma entrada em `STATIC` (e, se mexer, em `LIVE`)
// e de uma caixa em `BOUNDS` que lhe chegue.
//
// As peças rodam com a vista (ver draw.js). Uma peça feita de várias partes
// soltas — a oficina e a pilha de lenha, as torres do castelo — pinta-as com
// `layered`, que as põe por ordem de trás para a frente na vista de agora; o
// que só se vê de um lado (uma porta, uma tabuleta) pergunta a `faceOf` se
// esse lado está virado para quem olha.

import {
    P, box, cone, crenels, cylinder, depth, diamond, faceOf, groundShadow, layered, poly, shade,
    unturned, wallPatch
} from './draw.js';
import { hash2 } from './rng.js';

export const PLAYER_ROOF = '#c8553d';
const CASTLE_ROOF = '#3f63b8';
const KEEP_ROOF = '#d0703a';
const STONE = '#cfc6b3';
const WALL = '#efe2c4';
const TIMBER = '#7a5234';
const WOOD = '#9a6a3f';
const DOOR = '#4a3020';
const WINDOW = '#3a4a5c';

/** Caixa de desenho de cada peça, relativa ao ponto de chão: [x0, y0, largura, altura]. */
export const BOUNDS = {
    default: [-40, -96, 80, 122],
    tree: [-28, -78, 56, 96],
    rock: [-30, -34, 60, 52],
    ore: [-30, -34, 60, 52],
    mountain: [-44, -66, 88, 84],
    field: [-34, -30, 68, 50],
    castle: [-86, -196, 172, 250],
    keep: [-40, -126, 80, 152],
    mill: [-40, -110, 80, 136],
    // O cais pode sair até três casas para fora do bloco.
    fishery: [-66, -96, 132, 138],
    vineyard: [-34, -42, 68, 62],
    cottonfield: [-34, -34, 68, 54],
    canefield: [-34, -48, 68, 68],
    paddy: [-34, -32, 68, 52]
};

// ---------- Natureza ----------

const TREE_GREENS = ['#3f8f3a', '#4c9a3c', '#357f36', '#5aa54a'];

function tree(ctx, { variant = 0, tint = 0.5 }) {
    const green = TREE_GREENS[variant % TREE_GREENS.length];
    const lift = (tint - 0.5) * 0.18;
    groundShadow(ctx, 16, 7, 0.24, 5, 3);

    if (variant % 2 === 1) {
        // Pinheiro: três andares de copa.
        ctx.fillStyle = '#6b4a2b';
        ctx.fillRect(-2, -10, 4, 12);
        const dark = shade('#2f6e3a', lift);
        const light = shade('#3f8a45', lift);
        for (let i = 0; i < 3; i++) {
            const y = -8 - i * 13;
            const w = 16 - i * 3.5;
            poly(ctx, [[-w, y], [0, y - 22], [0, y]], light);
            poly(ctx, [[0, y], [0, y - 22], [w, y]], dark);
        }
        return;
    }

    // Árvore de copa redonda.
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-2.5, -14, 5, 16);
    const base = shade(green, lift);
    const blobs = [[-7, -22, 11], [7, -24, 11], [0, -33, 12], [0, -21, 12]];
    for (const [x, y, r] of blobs) {
        ctx.fillStyle = shade(base, -0.12);
        ctx.beginPath();
        ctx.arc(x + 1.5, y + 1.5, r, 0, Math.PI * 2);
        ctx.fill();
    }
    for (const [x, y, r] of blobs) {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(x, y, r - 1, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = shade(base, 0.2);
    ctx.beginPath();
    ctx.arc(-5, -34, 5, 0, Math.PI * 2);
    ctx.fill();
}

function boulder(ctx, x, y, s, color) {
    poly(ctx, [[x - 10 * s, y], [x - 7 * s, y - 9 * s], [x + 1 * s, y - 13 * s], [x + 9 * s, y - 7 * s], [x + 11 * s, y], [x, y + 3 * s]], shade(color, -0.2));
    poly(ctx, [[x - 7 * s, y - 9 * s], [x + 1 * s, y - 13 * s], [x + 9 * s, y - 7 * s], [x + 1 * s, y - 5 * s]], shade(color, 0.18));
    poly(ctx, [[x - 10 * s, y], [x - 7 * s, y - 9 * s], [x + 1 * s, y - 5 * s], [x, y + 3 * s]], color);
}

function rock(ctx, { variant = 0 }) {
    groundShadow(ctx, 20, 8, 0.2, 3, 2);
    const grey = ['#9a968c', '#8d8a82', '#a5a097'][variant % 3];
    boulder(ctx, -8, 2, 1.05, grey);
    boulder(ctx, 9, 4, 0.8, shade(grey, -0.05));
    if (variant % 2 === 0) boulder(ctx, 2, -4, 0.6, shade(grey, 0.06));
}

function ore(ctx) {
    groundShadow(ctx, 20, 8, 0.2, 3, 2);
    boulder(ctx, -6, 3, 1.1, '#8a7f6a');
    boulder(ctx, 9, 5, 0.75, '#7d7361');
    // Veios dourados.
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -2); ctx.lineTo(-7, -6); ctx.lineTo(-3, -4);
    ctx.moveTo(6, 0); ctx.lineTo(10, -3);
    ctx.stroke();
    ctx.fillStyle = '#ffe07a';
    for (const [x, y] of [[-7, -7], [2, -3], [10, -4]]) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- Montes ----------
//
// As casas de colina sem nada em cima levam dois montes, escolhidos entre três
// feitios: o baixo (um cabeço redondo e verde), o médio (um monte de rocha) e
// o alto (um monte com neve no cimo). Cada casa junta dois deles, um atrás e
// outro à frente; como são postos na grelha da peça, rodam com a vista e
// pintam-se de trás para a frente com `layered`. Casas de colina vizinhas
// fazem assim uma serra. As casas de colina com rochas ou ouro levam só o
// monte de trás, e o rochedo pinta-se à frente dele.

/** Os três feitios: meia largura, altura, cor e se tem neve. */
const MOUNTAIN_KINDS = {
    low: { w: 18, h: 12, color: '#7d9650' },
    mid: { w: 20, h: 17, color: '#9a8b73' },
    high: { w: 22, h: 24, color: '#8c8883', snow: true }
};

/** Os pares de feitios: [o de trás, o da frente]. Quase todos têm um monte verde. */
const MOUNTAIN_PAIRS = [
    ['mid', 'low'], ['high', 'low'], ['low', 'low'],
    ['low', 'mid'], ['high', 'mid'], ['low', 'high']
];

/** Pinta um caminho fechado pelos pontos, ou só o traça (para recortar). */
function outline(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.closePath();
}

/** As pedrinhas soltas no sopé de um monte, à frente dele. */
function footStones(ctx, x, y, w, rnd) {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
        const u = -0.85 + (1.7 * (i + 0.2 + rnd() * 0.6)) / n;
        const sx = x + u * w;
        const sy = y + (1 - Math.abs(u)) * w * 0.2 + rnd() * 1.5;
        const grey = ['#9a968c', '#8d8a82', '#a8a296'][Math.floor(rnd() * 3)];
        boulder(ctx, sx, sy, 0.22 + rnd() * 0.2, grey);
    }
}

/**
 * Um monte com a base no ponto (x, y): a face da esquerda ao sol, a da direita
 * na sombra. O contorno é quebrado — ressaltos, ombros e às vezes um cabeço ao
 * lado do cimo — e muda com `seed`, para dois montes do mesmo feitio não serem
 * iguais.
 */
function mountainPeak(ctx, x, y, kindId, s, flip, seed) {
    const kind = MOUNTAIN_KINDS[kindId];
    const w = kind.w * s;
    const h = kind.h * s;
    let n = 0;
    const rnd = () => hash2(seed, n++, 41);
    const jit = (amount) => (rnd() - 0.5) * amount;
    const lit = shade(kind.color, 0.16);
    const dark = shade(kind.color, -0.22);
    const dir = flip ? -1 : 1;
    const top = [x + dir * w * 0.12 + jit(w * 0.1), y - h];
    const foot = [x + w * 0.12, y + w * 0.22];
    const left = [x - w, y];
    const right = [x + w, y];

    if (kindId === 'low') {
        // Um cabeço redondo, mas com lombas: curvas por vários pontos.
        const bl = [x - w * 0.55 + jit(w * 0.1), y - h * (0.6 + rnd() * 0.2)];
        const br = [x + w * 0.5 + jit(w * 0.1), y - h * (0.55 + rnd() * 0.2)];
        const mid = [x + w * 0.03, y - h * 0.45];
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.moveTo(...left);
        ctx.quadraticCurveTo(x - w * 0.85, y - h * 0.5, ...bl);
        ctx.quadraticCurveTo(bl[0] + w * 0.12, top[1] - h * 0.05, ...top);
        ctx.quadraticCurveTo(x + w * 0.05, y - h * 0.7, ...mid);
        ctx.lineTo(...foot);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(...top);
        ctx.quadraticCurveTo(br[0] - w * 0.12, top[1] + h * 0.02, ...br);
        ctx.quadraticCurveTo(x + w * 0.85, y - h * 0.45, ...right);
        ctx.lineTo(...foot);
        ctx.lineTo(...mid);
        ctx.quadraticCurveTo(x + w * 0.05, y - h * 0.7, ...top);
        ctx.closePath();
        ctx.fill();
        // Uns tufos mais claros.
        ctx.fillStyle = shade(kind.color, 0.32);
        for (const [dx, dy, r] of [[-0.5, 0.4, 0.12], [-0.18, 0.72, 0.09], [-0.7, 0.18, 0.08]]) {
            ctx.beginPath();
            ctx.ellipse(x + (dx + jit(0.08)) * w, y - dy * h, r * w, r * w * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (rnd() < 0.6) footStones(ctx, x, y, w, rnd);
        return;
    }

    // Um monte de rocha: o contorno sobe aos ressaltos até ao cimo rombo e
    // desce do outro lado; às vezes com um cabeço mais baixo ao lado do cimo.
    const bump = rnd() < 0.55 ? (rnd() < 0.5 ? -1 : 1) : 0;
    const leftSide = [
        left,
        [x - w * 0.8, y - h * (0.2 + rnd() * 0.08)],
        [x - w * (0.66 + rnd() * 0.06), y - h * (0.3 + rnd() * 0.06)],
        [x - w * 0.52, y - h * (0.5 + rnd() * 0.1)],
        [x - w * 0.36, y - h * (bump < 0 ? 0.74 + rnd() * 0.08 : 0.6 + rnd() * 0.08)],
        [x - w * 0.26, y - h * (bump < 0 ? 0.64 : 0.7 + rnd() * 0.06)],
        [top[0] - w * 0.14, top[1] + h * (0.08 + rnd() * 0.05)],
        top
    ];
    const rightSide = [
        top,
        [top[0] + w * 0.14, top[1] + h * (0.07 + rnd() * 0.05)],
        [x + w * 0.32, y - h * (bump > 0 ? 0.62 : 0.66 + rnd() * 0.06)],
        [x + w * 0.42, y - h * (bump > 0 ? 0.72 + rnd() * 0.08 : 0.54 + rnd() * 0.08)],
        [x + w * 0.56, y - h * (0.42 + rnd() * 0.08)],
        [x + w * (0.7 + rnd() * 0.06), y - h * (0.3 + rnd() * 0.06)],
        [x + w * 0.82, y - h * (0.16 + rnd() * 0.06)],
        right
    ];
    // A crista que separa a luz da sombra desce aos zigue-zagues até à base.
    const crest = [
        [top[0] + w * 0.02 + jit(w * 0.05), y - h * 0.72],
        [x + w * 0.1 + jit(w * 0.06), y - h * 0.5],
        [x - w * 0.02 + jit(w * 0.06), y - h * 0.28],
        foot
    ];
    const litFace = [...leftSide, ...crest];
    const darkFace = [...rightSide, ...crest.slice().reverse()];
    outline(ctx, litFace);
    ctx.fillStyle = lit;
    ctx.fill();
    outline(ctx, darkFace);
    ctx.fillStyle = dark;
    ctx.fill();

    // Fendas na rocha: na face ao sol e na da sombra.
    ctx.strokeStyle = shade(kind.color, -0.08);
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.55, y - h * 0.28); ctx.lineTo(x - w * 0.42, y - h * 0.4); ctx.lineTo(x - w * 0.3, y - h * 0.52);
    ctx.moveTo(x - w * 0.24, y - h * 0.12); ctx.lineTo(x - w * 0.12, y - h * 0.3);
    ctx.stroke();
    ctx.strokeStyle = shade(kind.color, -0.34);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y - h * 0.2); ctx.lineTo(x + w * 0.42, y - h * 0.36);
    ctx.moveTo(x + w * 0.58, y - h * 0.1); ctx.lineTo(x + w * 0.64, y - h * 0.22);
    ctx.stroke();

    if (kind.snow) {
        // A neve do cimo, recortada pelo contorno do monte, com a orla aos bicos.
        const line = y - h * 0.62;
        const snow = [[x - w, y - h * 1.2]];
        for (let i = 0; i <= 8; i++) {
            snow.push([x - w * 0.6 + (w * 1.2 * i) / 8, line + (i % 2 ? h * 0.1 : -h * 0.02) + jit(h * 0.06)]);
        }
        snow.push([x + w, y - h * 1.2]);
        for (const [face, color] of [[litFace, '#f4f6f8'], [darkFace, '#c9d3dd']]) {
            ctx.save();
            outline(ctx, face);
            ctx.clip();
            outline(ctx, snow);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
        }
    }

    footStones(ctx, x, y, w, rnd);
}

/** Os montes de uma casa; com `backOnly`, só o de trás (fica atrás de um rochedo ou de um veio de ouro). */
function mountain(ctx, { variant = 0, backOnly = false }) {
    const [back, front] = MOUNTAIN_PAIRS[variant % MOUNTAIN_PAIRS.length];
    const flip = Math.floor(variant / MOUNTAIN_PAIRS.length) % 2 === 1;
    const side = flip ? -1 : 1;
    if (backOnly) {
        // Atrás na vista, rode ela para onde rodar: o rochedo fica à frente.
        const [x, y] = P(0, 0);
        mountainPeak(ctx, x, y - 7, back, 1, flip, variant * 2);
        return;
    }
    layered([
        [-0.1 * side, -0.14, () => {
            const [x, y] = P(-0.1 * side, -0.14);
            mountainPeak(ctx, x, y, back, 1, flip, variant * 2);
        }],
        [0.12 * side, 0.1, () => {
            const [x, y] = P(0.12 * side, 0.1);
            mountainPeak(ctx, x, y, front, 0.82, !flip, variant * 2 + 1);
        }]
    ]);
}

/** Quantas variantes tem o desenho dos montes: cada par, virado para cada lado, com três contornos (ver `mountain`). */
export const MOUNTAIN_VARIANTS = MOUNTAIN_PAIRS.length * 2 * 3;

// ---------- Campo ----------

function field(ctx, { stage = 'empty', growth = 0 }) {
    // Terra lavrada, com os regos ao longo de x.
    diamond(ctx, 0.92, 0.92, 0, '#8b5a32');
    diamond(ctx, 0.84, 0.84, 0.5, '#9a6639');
    ctx.strokeStyle = 'rgba(60, 35, 15, 0.45)';
    ctx.lineWidth = 1.2;
    for (let i = 1; i < 6; i++) {
        const gy = -0.42 + (0.84 * i) / 6;
        ctx.beginPath();
        ctx.moveTo(...P(-0.42, gy, 0.5));
        ctx.lineTo(...P(0.42, gy, 0.5));
        ctx.stroke();
    }
    if (stage === 'empty') return;

    const ripe = stage === 'ripe';
    const g = ripe ? 1 : Math.max(0.08, growth);
    const height = 3 + g * 10;
    const color = ripe ? '#e7bd45' : g < 0.5 ? '#72b041' : '#a9c14a';
    const tip = ripe ? '#f7dc7a' : shade(color, 0.2);
    // Os pés de trigo, de trás para a frente na vista.
    const stalks = [];
    for (let row = 1; row < 6; row++) {
        const gy = -0.42 + (0.84 * row) / 6;
        for (let k = 0; k < 6; k++) {
            const gx = -0.36 + (0.72 * k) / 5;
            const [x, y] = P(gx, gy, 0.5);
            stalks.push({ x, y });
        }
    }
    stalks.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const { x, y } of stalks) {
        ctx.strokeStyle = shade(color, -0.15);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 1, y - height);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 2, y - height * 0.8);
        ctx.stroke();
        if (ripe || g > 0.6) {
            ctx.fillStyle = tip;
            ctx.beginPath();
            ctx.ellipse(x - 1, y - height, 1.6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/** Terra lavrada de uma cultura, com os regos ao longo de x (`rows` regos). */
function tilled(ctx, rows = 6, soil = '#8b5a32') {
    diamond(ctx, 0.92, 0.92, 0, soil);
    diamond(ctx, 0.84, 0.84, 0.5, shade(soil, 0.1));
    ctx.strokeStyle = 'rgba(60, 35, 15, 0.45)';
    ctx.lineWidth = 1.2;
    for (let i = 1; i < rows; i++) {
        const gy = -0.42 + (0.84 * i) / rows;
        ctx.beginPath();
        ctx.moveTo(...P(-0.42, gy, 0.5));
        ctx.lineTo(...P(0.42, gy, 0.5));
        ctx.stroke();
    }
}

/** Os pés de uma cultura em grelha (`rows` x `cols`), de trás para a frente na vista. */
function cropSpots(rows, cols, inset = 0.36) {
    const spots = [];
    for (let row = 1; row < rows; row++) {
        const gy = -0.42 + (0.84 * row) / rows;
        for (let k = 0; k < cols; k++) {
            const gx = -inset + (2 * inset * k) / (cols - 1);
            const [x, y] = P(gx, gy, 0.5);
            spots.push({ x, y, row, k });
        }
    }
    return spots.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Vinha: quatro bardos de estacas com o arame, e as cepas a subir por eles.
 * Madura, cheia de cachos roxos.
 */
function vineyard(ctx, { stage = 'empty', growth = 0 }) {
    tilled(ctx, 5, '#9a6a3c');
    const rows = [];
    for (let row = 1; row < 5; row++) rows.push(-0.42 + (0.84 * row) / 5);
    // Estacas e arame: estão lá sempre, mesmo com a vinha podada.
    const posts = [];
    for (const gy of rows) {
        for (const gx of [-0.38, 0, 0.38]) {
            const [x, y] = P(gx, gy, 0.5);
            posts.push({ x, y });
        }
    }
    posts.sort((a, b) => a.y - b.y || a.x - b.x);
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1.6;
    for (const { x, y } of posts) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 15);
        ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70, 60, 50, 0.6)';
    ctx.lineWidth = 0.7;
    for (const gy of rows) {
        for (const h of [9, 14]) {
            ctx.beginPath();
            ctx.moveTo(...P(-0.38, gy, h));
            ctx.lineTo(...P(0.38, gy, h));
            ctx.stroke();
        }
    }
    if (stage === 'empty') return;

    const ripe = stage === 'ripe';
    const g = ripe ? 1 : Math.max(0.1, growth);
    const leaf = g < 0.5 ? '#79b447' : '#4f8f36';
    const plants = [];
    for (const gy of rows) {
        for (let k = 0; k < 6; k++) {
            const gx = -0.34 + (0.68 * k) / 5;
            const [x, y] = P(gx, gy, 0.5);
            plants.push({ x, y, k });
        }
    }
    plants.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const { x, y, k } of plants) {
        const h = 4 + g * 10;
        ctx.strokeStyle = '#6b4a2b';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - h);
        ctx.stroke();
        ctx.fillStyle = shade(leaf, k % 2 ? -0.08 : 0.06);
        ctx.beginPath();
        ctx.ellipse(x, y - h, 2.5 + g * 3, 1.8 + g * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (ripe || g > 0.75) {
            const color = ripe ? '#6a2c7a' : '#9ab04a';
            ctx.fillStyle = color;
            for (const [dx, dy] of [[-1.4, 0], [1.4, 0], [0, 1.6], [0, 3]]) {
                ctx.beginPath();
                ctx.arc(x + 1.5 + dx, y - h + 3 + dy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

/** Algodão: arbustos baixos que, maduros, abrem em cápsulas brancas. */
function cottonfield(ctx, { stage = 'empty', growth = 0 }) {
    tilled(ctx, 6, '#8e6038');
    if (stage === 'empty') return;
    const ripe = stage === 'ripe';
    const g = ripe ? 1 : Math.max(0.08, growth);
    const leaf = g < 0.5 ? '#86b84e' : '#5f9440';
    for (const { x, y, k, row } of cropSpots(6, 5)) {
        const h = 2 + g * 7;
        const r = 2 + g * 3.2;
        ctx.fillStyle = shade(leaf, -0.2);
        ctx.fillRect(x - 0.6, y - h, 1.2, h);
        ctx.fillStyle = shade(leaf, (k + row) % 2 ? -0.06 : 0.06);
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y - h, r * 0.8, 0, Math.PI * 2);
        ctx.arc(x + r * 0.4, y - h - 0.6, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        if (ripe || g > 0.7) {
            ctx.fillStyle = ripe ? '#fbfaf5' : '#dfe8c8';
            for (const [dx, dy] of [[-1.8, -1.6], [1.6, -2.4], [0, 0.2]]) {
                ctx.beginPath();
                ctx.arc(x + dx, y - h + dy, ripe ? 1.7 : 1.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

/** Canavial: touceiras de cana alta, verde a crescer e amarelada quando está pronta. */
function canefield(ctx, { stage = 'empty', growth = 0 }) {
    tilled(ctx, 5, '#8b5a32');
    if (stage === 'empty') return;
    const ripe = stage === 'ripe';
    const g = ripe ? 1 : Math.max(0.08, growth);
    const stalk = ripe ? '#c9b24a' : g < 0.5 ? '#7cb84a' : '#5f9e3c';
    for (const { x, y, k, row } of cropSpots(5, 5)) {
        const h = 4 + g * 20;
        for (const dx of [-1.6, 0, 1.6]) {
            ctx.strokeStyle = shade(stalk, (k + row) % 2 ? -0.1 : 0.05);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(x + dx, y);
            ctx.lineTo(x + dx * 1.6, y - h + Math.abs(dx));
            ctx.stroke();
        }
        // As folhas compridas a cair para os lados.
        ctx.strokeStyle = ripe ? '#9fb04a' : shade(stalk, 0.15);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.quadraticCurveTo(x - 5, y - h - 2, x - 7, y - h + 4);
        ctx.moveTo(x, y - h);
        ctx.quadraticCurveTo(x + 5, y - h - 3, x + 7, y - h + 3);
        ctx.stroke();
    }
}

/** Arrozal: um canteiro alagado, com as muretas de terra e os pés de arroz a sair da água. */
function paddy(ctx, { stage = 'empty', growth = 0 }) {
    diamond(ctx, 0.92, 0.92, 0, '#8b6a3e');
    diamond(ctx, 0.82, 0.82, 1, '#6fa4bf');
    // Os reflexos na água e a mureta do meio.
    diamond(ctx, 0.5, 0.3, 1.2, 'rgba(255, 255, 255, 0.12)', null, -0.1, -0.12);
    ctx.strokeStyle = '#8b6a3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...P(-0.41, 0, 1.4));
    ctx.lineTo(...P(0.41, 0, 1.4));
    ctx.stroke();
    if (stage === 'empty') return;
    const ripe = stage === 'ripe';
    const g = ripe ? 1 : Math.max(0.1, growth);
    const color = ripe ? '#d8bb52' : g < 0.5 ? '#86c34e' : '#6aae44';
    for (const { x, y } of cropSpots(6, 6)) {
        const h = 2 + g * 8;
        ctx.strokeStyle = shade(color, -0.1);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y - 1);
        ctx.lineTo(x - 1.6, y - 1 - h);
        ctx.moveTo(x, y - 1);
        ctx.lineTo(x + 1.6, y - 1 - h);
        ctx.moveTo(x, y - 1);
        ctx.lineTo(x, y - 1 - h * 1.1);
        ctx.stroke();
        if (ripe || g > 0.7) {
            ctx.fillStyle = ripe ? '#f0d77a' : '#b9d27a';
            ctx.beginPath();
            ctx.ellipse(x + 1.8, y - h, 1, 2, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ---------- Casas e oficinas ----------

// ---------- Casas ----------
//
// Seis estilos de casa, cada um em duas orientações (a fachada comprida ao
// longo de x ou de y): 12 variantes. As casas têm textura: telhas soltas,
// pedras uma a uma, reboco salpicado, vigas com espessura, janelas de quatro
// vidros e portas de tábuas. Os pormenores pintam-se nas quatro faces, porque
// ao rodar a vista qualquer uma pode ficar à frente; `houseFace` diz se a face
// se vê e dá os pontos dela. O acaso das texturas vem de `seeded`, e é sempre
// o mesmo na mesma variante: a imagem vai para a cache (ver sprite-cache.js).

/** Quantas variantes tem o desenho das casas (ver `house`). */
export const HOUSE_VARIANTS = 12;

const PLASTER = '#efe2c4';
const STONE_WALL = '#c9bfae';
const PLINTH = '#a39a8a';
const FRAME = '#f5efe2';
const GLASS = '#34506e';
const STEP = '#b3ab9b';

/** Um gerador de acaso que dá sempre a mesma sequência para a mesma semente. */
function seeded(seed) {
    let n = 0;
    return () => hash2(seed, n++, 131);
}

/** Um desvio de tom ao acaso, em cinco degraus: poucos tons, para as texturas se pintarem aos lotes. */
function tone(rnd, amp) {
    return Math.round((rnd() - 0.5) * 4) / 4 * amp;
}

/**
 * Formas pintadas aos lotes, um caminho por cor: uma textura de centenas de
 * pedras ou telhas pinta-se com meia dúzia de chamadas em vez de centenas.
 */
function batch() {
    const paths = new Map();
    return {
        path(color) {
            let p = paths.get(color);
            if (!p) {
                p = new Path2D();
                paths.set(color, p);
            }
            return p;
        },
        fill(ctx) {
            for (const [color, p] of paths) {
                ctx.fillStyle = color;
                ctx.fill(p);
            }
            paths.clear();
        },
        stroke(ctx, width) {
            ctx.lineWidth = width;
            for (const [color, p] of paths) {
                ctx.strokeStyle = color;
                ctx.stroke(p);
            }
            paths.clear();
        }
    };
}

/** Acrescenta um polígono a um caminho. */
function addPoly(path, pts) {
    path.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) path.lineTo(...pts[i]);
    path.closePath();
}

/**
 * Uma face da casa: a de normal (nx, ny) de uma caixa a x b centrada em
 * (ox, oy). Devolve null se estiver de costas; senão, `at(u, z)` dá o ponto
 * de ecrã à fração u da largura e à altura z, `grid(u, out)` o ponto da grelha
 * da peça a `out` para fora da face, e `tone` o sombreado dessa face.
 */
function houseFace(nx, ny, a, b, ox = 0, oy = 0) {
    const side = faceOf(nx, ny);
    if (!side) return null;
    const w = ny ? a : b;
    const grid = ny
        ? (u, out = 0.006) => [ox + (u - 0.5) * a * ny, oy + ny * (b / 2 + out)]
        : (u, out = 0.006) => [ox + nx * (a / 2 + out), oy - (u - 0.5) * b * nx];
    const at = (u, z) => P(...grid(u), z);
    return { side, w, nx, ny, at, grid, tone: side === 'right' ? -0.28 : -0.06 };
}

function facePath(ctx, f, u0, u1, z0, z1) {
    ctx.beginPath();
    ctx.moveTo(...f.at(u0, z0));
    ctx.lineTo(...f.at(u1, z0));
    ctx.lineTo(...f.at(u1, z1));
    ctx.lineTo(...f.at(u0, z1));
    ctx.closePath();
}

function faceQuad(ctx, f, u0, u1, z0, z1, color, raw = false) {
    facePath(ctx, f, u0, u1, z0, z1);
    ctx.fillStyle = raw ? color : shade(color, f.tone);
    ctx.fill();
}

function faceLine(ctx, f, u0, z0, u1, z1, color, width = 1, raw = false) {
    ctx.strokeStyle = raw ? color : shade(color, f.tone);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(...f.at(u0, z0));
    ctx.lineTo(...f.at(u1, z1));
    ctx.stroke();
}

/** Sombra suave numa faixa da face: junto ao chão, ou debaixo do beiral. */
function faceShade(ctx, f, z0, z1, alpha) {
    const steps = 4;
    for (let k = 0; k < steps; k++) {
        const a = alpha * (1 - k / steps);
        const za = z0 + ((z1 - z0) * k) / steps;
        const zb = z0 + ((z1 - z0) * (k + 1)) / steps;
        faceQuad(ctx, f, 0, 1, Math.min(za, zb), Math.max(za, zb), `rgba(40, 28, 18, ${a})`, true);
    }
}

/** Reboco: salpicos de cor, sombra junto ao chão e debaixo do beiral. */
function plaster(ctx, f, z0, z1, color, rnd) {
    if (!f) return;
    ctx.save();
    facePath(ctx, f, 0, 1, z0, z1);
    ctx.clip();
    const n = Math.round(f.w * (z1 - z0) * 5);
    const specks = batch();
    for (let i = 0; i < n; i++) {
        const [x, y] = f.at(rnd(), z0 + rnd() * (z1 - z0));
        specks.path(shade(color, f.tone + tone(rnd, 0.14))).rect(x, y, 0.9, 0.55);
    }
    specks.fill(ctx);
    faceShade(ctx, f, z0, z0 + 5, 0.2);
    faceShade(ctx, f, z1, z1 - 2.5, 0.16);
    ctx.restore();
}

/** Parede de pedra: pedras soltas, desencontradas, de tamanho e cor ao acaso, com a argamassa entre elas. */
function stoneWall(ctx, f, z0, z1, base, rnd, { h = 3, w = 0.1 } = {}) {
    if (!f) return;
    ctx.save();
    facePath(ctx, f, 0, 1, z0, z1);
    ctx.clip();
    faceQuad(ctx, f, 0, 1, z0, z1, shade(base, -0.3));
    const du = w / f.w;
    const gap = 0.007 / f.w;
    const stones = batch();
    const lights = batch();
    for (let z = z0, row = 0; z < z1 - 0.2; row++) {
        const zb = Math.min(z1, z + h * (0.85 + rnd() * 0.3));
        let u = -((row % 2) * 0.5 + rnd() * 0.3) * du;
        while (u < 1) {
            const ww = du * (0.65 + rnd() * 0.7);
            const t = tone(rnd, 0.18);
            const j = () => (rnd() - 0.5) * 0.35;
            const u0 = u + gap;
            const u1 = u + ww - gap;
            addPoly(stones.path(shade(base, f.tone + t)), [f.at(u0, z + 0.35 + j()), f.at(u1, z + 0.35 + j()), f.at(u1, zb - 0.35 + j()), f.at(u0, zb - 0.35 + j())]);
            // Um fio de luz no cimo de cada pedra.
            const lp = lights.path(shade(base, f.tone + t + 0.14));
            lp.moveTo(...f.at(u0, zb - 0.55));
            lp.lineTo(...f.at(u1, zb - 0.55));
            u += ww;
        }
        z = zb;
    }
    stones.fill(ctx);
    lights.stroke(ctx, 0.5);
    ctx.restore();
}

/** Cunhais: pedras grandes, alternadas, nas esquinas de uma parede rebocada. */
function quoins(ctx, f, z0, z1, color, rnd) {
    if (!f) return;
    const big = 0.075 / f.w;
    const small = 0.045 / f.w;
    for (let z = z0, k = 0; z < z1 - 0.5; k++) {
        const zb = Math.min(z1, z + 2.6);
        const c = shade(color, f.tone + (rnd() - 0.5) * 0.1);
        const w0 = k % 2 ? big : small;
        const w1 = k % 2 ? small : big;
        faceQuad(ctx, f, 0, w0, z + 0.25, zb - 0.25, c, true);
        faceQuad(ctx, f, 1 - w1, 1, z + 0.25, zb - 0.25, c, true);
        z = zb;
    }
}

/** Uma viga do enxaimel: um traço grosso com a aresta mais escura. */
function beam(ctx, f, u0, z0, u1, z1, color, width = 1.5) {
    faceLine(ctx, f, u0, z0, u1, z1, shade(color, -0.3), width + 0.5);
    faceLine(ctx, f, u0, z0, u1, z1, color, width);
}

/** Enxaimel numa face: esteios nos cantos e a meio, frechal, travessas e escoras em diagonal. */
function halfTimber(ctx, f, z0, z1, { color = TIMBER, braces = true } = {}) {
    if (!f) return;
    const mid = (z0 + z1) / 2;
    const e = 0.02;
    beam(ctx, f, 0, z0 + 0.6, 1, z0 + 0.6, color, 1.2);
    beam(ctx, f, 0, mid, 1, mid, color, 0.9);
    if (braces) {
        beam(ctx, f, e, z0 + 0.6, 0.18, mid, color, 0.9);
        beam(ctx, f, 1 - e, z0 + 0.6, 0.82, mid, color, 0.9);
        beam(ctx, f, 0.5, mid, 0.36, z1 - 0.6, color, 0.9);
        beam(ctx, f, 0.5, mid, 0.64, z1 - 0.6, color, 0.9);
        beam(ctx, f, 0.5, z0 + 0.6, 0.5, z1 - 0.6, color, 0.9);
    }
    beam(ctx, f, e, z0, e, z1, color, 1.4);
    beam(ctx, f, 1 - e, z0, 1 - e, z1, color, 1.4);
    beam(ctx, f, 0, z1 - 0.6, 1, z1 - 0.6, color, 1.3);
}

/** Tábuas numa face (o barracão): juntas escuras e veios. */
function planks(ctx, f, z0, z1, color, rnd, n = 6) {
    if (!f) return;
    for (let k = 0; k < n; k++) {
        faceQuad(ctx, f, k / n, (k + 1) / n, z0, z1, shade(color, (rnd() - 0.5) * 0.14));
        if (k) faceLine(ctx, f, k / n, z0, k / n, z1, shade(color, -0.4), 0.6);
        const u = (k + 0.3 + rnd() * 0.4) / n;
        faceLine(ctx, f, u, z0 + 1 + rnd() * 2, u, z1 - 1 - rnd() * 2, shade(color, -0.15), 0.4);
    }
    faceShade(ctx, f, z0, z0 + 3, 0.2);
}

/** Um vaso de flores debaixo de uma janela: a caixa, as folhas e as flores. */
function flowerBox(ctx, f, u, hw, z, colors, rnd) {
    faceQuad(ctx, f, u - hw * 1.1, u + hw * 1.1, z - 2.6, z - 0.9, '#7a5234');
    faceLine(ctx, f, u - hw * 1.1, z - 0.9, u + hw * 1.1, z - 0.9, '#9a6a3f', 0.5);
    for (let k = 0; k < 7; k++) {
        const [x, y] = f.at(u - hw + (k / 6) * hw * 2, z - 0.4 + rnd() * 0.6);
        ctx.fillStyle = k % 2 ? '#3f7d34' : '#56983f';
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let k = 0; k < 4; k++) {
        const [x, y] = f.at(u - hw * 0.75 + (k / 3) * hw * 1.5, z + 0.3 + rnd() * 0.8);
        ctx.fillStyle = colors[k % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 1.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(x - 0.25, y - 0.25, 0.5, 0.5);
    }
}

/**
 * Janela de quatro vidros com aro claro, reflexo e parapeito; `shutter` põe-lhe
 * portadas de ripas abertas, `lintel` uma verga de pedra, `flowers` um vaso.
 * w em frações do bloco.
 */
function houseWindow(ctx, f, u, z0, z1, w, { shutter = null, frame = FRAME, lintel = null, flowers = null, glass = GLASS, rnd = Math.random } = {}) {
    if (!f) return;
    const hw = w / f.w / 2;
    const e = 0.014 / f.w;
    if (shutter) {
        for (const s of [-1, 1]) {
            const ua = s < 0 ? u - hw - e - hw * 1.05 : u + hw + e;
            const ub = ua + hw * 1.05;
            faceQuad(ctx, f, ua, ub, z0, z1, shutter);
            for (let k = 1; k < 4; k++) {
                const z = z0 + ((z1 - z0) * k) / 4;
                faceLine(ctx, f, ua, z, ub, z, shade(shutter, -0.25), 0.45);
            }
            facePath(ctx, f, ua, ub, z0, z1);
            ctx.strokeStyle = shade(shutter, f.tone - 0.3);
            ctx.lineWidth = 0.45;
            ctx.stroke();
        }
    }
    if (lintel) faceQuad(ctx, f, u - hw - e * 2, u + hw + e * 2, z1 + 0.8, z1 + 2.2, lintel);
    faceQuad(ctx, f, u - hw - e, u + hw + e, z0 - 0.8, z1 + 0.8, frame);
    // Os quatro vidros, mais claros em baixo, com um risco de reflexo.
    const zm = (z0 + z1) / 2;
    const mh = 0.004 / f.w;
    for (const [ua, ub] of [[u - hw, u - mh], [u + mh, u + hw]]) {
        for (const [za, zb] of [[z0, zm - 0.3], [zm + 0.3, z1]]) {
            faceQuad(ctx, f, ua, ub, za, zb, shade(glass, 0.12));
            faceQuad(ctx, f, ua, ub, (za + zb) / 2, zb, glass);
            faceLine(ctx, f, ua + (ub - ua) * 0.25, za + 0.6, ua + (ub - ua) * 0.7, zb - 0.5, 'rgba(255, 255, 255, 0.45)', 0.45, true);
        }
    }
    faceLine(ctx, f, u, z0, u, z1, frame, 0.7);
    faceLine(ctx, f, u - hw, zm, u + hw, zm, frame, 0.7);
    facePath(ctx, f, u - hw - e, u + hw + e, z0 - 0.8, z1 + 0.8);
    ctx.strokeStyle = shade(frame, f.tone - 0.35);
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // O parapeito, com a sombra por baixo.
    faceQuad(ctx, f, u - hw - e * 2, u + hw + e * 2, z0 - 1.9, z0 - 0.8, '#d8d0c0');
    faceLine(ctx, f, u - hw - e * 2, z0 - 2.1, u + hw + e * 2, z0 - 2.1, 'rgba(40, 28, 18, 0.35)', 0.6, true);
    if (flowers) flowerBox(ctx, f, u, hw, z0 - 2.1, flowers, rnd);
}

/**
 * Porta de tábuas com aro, travessas, dobradiças, puxador e um degrau de pedra
 * à frente; `arch` arredonda-lhe o cimo.
 */
function houseDoor(ctx, f, u, w, h, color = DOOR, { arch = false, frame = '#5a3d26', rnd = Math.random } = {}) {
    if (!f) return;
    const hw = w / f.w / 2;
    const e = 0.014 / f.w;
    const top = (ua, ub, zz, lift) => {
        // O contorno da porta, com o cimo em arco se for o caso.
        ctx.beginPath();
        ctx.moveTo(...f.at(ua, 0));
        ctx.lineTo(...f.at(ub, 0));
        ctx.lineTo(...f.at(ub, zz));
        if (lift) {
            const [x0, y0] = f.at(ub, zz);
            const [x1, y1] = f.at(ua, zz);
            ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - lift, x1, y1);
        } else {
            ctx.lineTo(...f.at(ua, zz));
        }
        ctx.closePath();
    };
    top(u - hw - e, u + hw + e, h + 0.9, arch ? 5.5 : 0);
    ctx.fillStyle = shade(frame, f.tone);
    ctx.fill();
    ctx.save();
    top(u - hw, u + hw, h, arch ? 4.6 : 0);
    ctx.clip();
    const n = 3;
    for (let k = 0; k < n; k++) {
        const ua = u - hw + (k / n) * hw * 2;
        faceQuad(ctx, f, ua, ua + (hw * 2) / n, 0, h + 5, shade(color, (rnd() - 0.5) * 0.14));
        if (k) faceLine(ctx, f, ua, 0, ua, h + 5, shade(color, -0.4), 0.45);
    }
    for (const z of [h * 0.25, h * 0.72]) {
        faceLine(ctx, f, u - hw, z, u + hw, z, shade(color, -0.25), 0.9);
        faceLine(ctx, f, u - hw, z, u - hw * 0.35, z, '#2a2420', 0.7);
    }
    ctx.restore();
    const [kx, ky] = f.at(u + hw * 0.55, h * 0.45);
    ctx.fillStyle = '#e0b43c';
    ctx.beginPath();
    ctx.arc(kx, ky, 0.75, 0, Math.PI * 2);
    ctx.fill();
    // O degrau: uma lajinha de pedra à frente da porta.
    const [sx, sy] = f.grid(u, 0.035);
    const along = f.ny ? w + 0.04 : 0.06;
    const across = f.ny ? 0.06 : w + 0.04;
    box(ctx, along, across, 1.2, STEP, { ox: sx, oy: sy });
}

/**
 * Telhado de duas águas com telhas soltas. É o `gable` de draw.js pintado à
 * mão: as telhas assentam em fiadas do beiral para a cumeeira, cada fiada a
 * cobrir o cimo da de baixo, com a ponta arredondada e cor ao acaso; a
 * cumeeira leva um capeamento e o beiral mostra a grossura do telhado.
 *
 * O telhado é um pouco mais largo do que a casa: sai `over` para lá das
 * empenas e `eave` nas fachadas, quase rente (um beiral largo, a descer com a
 * inclinação, tapava o cimo das portas e janelas). A empena vai até ao
 * contorno do telhado e pinta-se depois das águas: o triângulo acaba certo
 * nos cantos do beiral, sem se ver o corte da água de trás.
 */
function tiledRoof(ctx, a, b, z, rise, color, wall, {
    ox = 0, oy = 0, alongX = true, over = 0.02, eave = 0.012, round = false, seed = 1, tile = 0.06
} = {}) {
    const rnd = seeded(seed);
    const L = (alongX ? a : b) / 2 + over;
    const half = (alongX ? b : a) / 2;
    const W = half + eave;
    // Um ponto da água do lado s: u ao longo da cumeeira, t do beiral (0) à
    // cumeeira (1). A água passa pelo topo da parede e o beiral continua a
    // descer com a mesma inclinação: não fica a direito, no ar.
    const zAt = (t) => z + rise * (1 - (W * (1 - t)) / half);
    const pt = (s, u, t) => alongX
        ? P(ox + u, oy + s * W * (1 - t), zAt(t))
        : P(ox + s * W * (1 - t), oy + u, zAt(t));
    const n = (s) => (alongX ? [0, s] : [s, 0]);
    const planes = [-1, 1].map((s) => ({ s, side: faceOf(...n(s)) }));
    planes.sort((p, q) => (p.side ? 1 : 0) - (q.side ? 1 : 0));
    const rows = Math.max(3, Math.round(rise / 3));
    const plane = ({ s, side }) => {
        const c = side === null ? shade(color, 0.08) : side === 'left' ? color : shade(color, -0.22);
        const pts = [pt(s, -L, 0), pt(s, L, 0), pt(s, L, 1), pt(s, -L, 1)];
        poly(ctx, pts, shade(c, -0.35));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        for (const q of pts.slice(1)) ctx.lineTo(...q);
        ctx.closePath();
        ctx.clip();
        // Fiada a fiada, do beiral para a cumeeira: cada uma cobre o cimo da
        // de baixo. Dentro da fiada as telhas pintam-se aos lotes, por tom.
        const dt = 1 / rows;
        const fills = batch();
        const edges = batch();
        const lights = batch();
        for (let r = 0; r < rows; r++) {
            const t0 = r * dt - dt * 0.3;
            const t1 = (r + 1) * dt;
            for (let u = -L - (r % 2) * tile * 0.5; u < L; u += tile) {
                const ua = u + 0.004;
                const ub = u + tile - 0.004;
                const um = (ua + ub) / 2;
                const t = tone(rnd, 0.14);
                const p = fills.path(shade(c, t));
                p.moveTo(...pt(s, ua, t1));
                p.lineTo(...pt(s, ub, t1));
                p.lineTo(...pt(s, ub, t0 + dt * 0.15));
                p.quadraticCurveTo(...pt(s, um, t0 - dt * 0.18), ...pt(s, ua, t0 + dt * 0.15));
                p.closePath();
                // A ponta da telha, mais escura, e um brilho no dorso.
                const e = edges.path(shade(c, t - 0.32));
                e.moveTo(...pt(s, ub, t0 + dt * 0.15));
                e.quadraticCurveTo(...pt(s, um, t0 - dt * 0.18), ...pt(s, ua, t0 + dt * 0.15));
                const l = lights.path(shade(c, t + 0.18));
                l.moveTo(...pt(s, um - tile * 0.12, t0 + dt * 0.35));
                l.lineTo(...pt(s, um - tile * 0.12, t1 - dt * 0.1));
            }
            fills.fill(ctx);
            edges.stroke(ctx, 0.5);
            lights.stroke(ctx, 0.45);
        }
        ctx.restore();
        // A grossura do telhado no beiral, na água que se vê de frente.
        if (side) {
            const [p0, p1] = pts;
            poly(ctx, [p0, p1, [p1[0], p1[1] + 1.3], [p0[0], p0[1] + 1.3]], shade(c, -0.45));
        }
    };
    const gableEnd = (e) => {
        const nrm = alongX ? [e, 0] : [0, e];
        const side = faceOf(...nrm);
        if (!side) return;
        const q = (u, zz) => (alongX ? P(ox + e * L, oy + u, zz) : P(ox + u, oy + e * L, zz));
        const corners = [q(-W, zAt(0)), q(W, zAt(0)), q(0, z + rise)];
        const wc = shade(wall, side === 'right' ? -0.3 : -0.08);
        poly(ctx, corners, wc);
        // Sombra debaixo do telhado, ao longo das duas bordas da empena.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(...corners[0]);
        ctx.lineTo(...corners[1]);
        ctx.lineTo(...corners[2]);
        ctx.closePath();
        ctx.clip();
        ctx.strokeStyle = 'rgba(40, 28, 18, 0.22)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(...corners[0]);
        ctx.lineTo(...corners[2]);
        ctx.lineTo(...corners[1]);
        ctx.stroke();
        ctx.restore();
        if (round) {
            // Um óculo redondo na empena.
            const [x, y] = q(0, z + rise * 0.36);
            ctx.fillStyle = shade(FRAME, side === 'right' ? -0.28 : -0.06);
            ctx.beginPath();
            ctx.ellipse(x, y, 2.5, 2.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = GLASS;
            ctx.beginPath();
            ctx.ellipse(x, y, 1.7, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(x - 0.9, y - 0.8, 0.8, 0.5);
        }
        // A borda do telhado ao longo da empena, com grossura.
        ctx.strokeStyle = shade(color, -0.4);
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.moveTo(...corners[0]);
        ctx.lineTo(...corners[2]);
        ctx.lineTo(...corners[1]);
        ctx.stroke();
        ctx.strokeStyle = shade(color, -0.05);
        ctx.lineWidth = 0.7;
        ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    plane(planes[0]);
    plane(planes[1]);
    gableEnd(-1);
    gableEnd(1);
    // O capeamento da cumeeira: telhas de meia-cana ao longo dela.
    const r0 = pt(1, -L, 1);
    const r1 = pt(1, L, 1);
    ctx.strokeStyle = shade(color, -0.4);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(...r0);
    ctx.lineTo(...r1);
    ctx.stroke();
    ctx.strokeStyle = shade(color, 0.04);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.strokeStyle = shade(color, -0.4);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let u = -L + tile; u < L; u += tile * 1.4) {
        const [x, y] = pt(1, u, 1);
        ctx.moveTo(x - 0.4, y - 1.1);
        ctx.lineTo(x + 0.4, y + 1.1);
    }
    ctx.stroke();
    ctx.restore();
}

/** Chaminé de pedra, com o capelo mais largo em cima e a boca escura. */
function chimney(ctx, ox, oy, z, h, rnd) {
    const s = 0.1;
    box(ctx, s, s, h, '#9a9186', { ox, oy, z });
    for (const n of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        stoneWall(ctx, houseFace(...n, s, s, ox, oy), z, z + h, '#a39a8d', rnd, { h: 2.4, w: 0.05 });
    }
    box(ctx, s + 0.025, s + 0.025, 1.8, '#857d71', { ox, oy, z: z + h });
    diamond(ctx, s * 0.55, s * 0.55, z + h + 1.8, '#2a2622', null, ox, oy);
}

/** Barril de madeira com aros de ferro. */
function barrel(ctx, ox, oy, rnd) {
    const top = cylinder(ctx, 2.8, 5.5, '#8a5a30', { ox, oy });
    const [x, y] = P(ox, oy);
    ctx.strokeStyle = '#3a3430';
    ctx.lineWidth = 0.6;
    for (const z of [1.2, 4.3]) {
        ctx.beginPath();
        ctx.ellipse(x, y - z, 2.8, 1.4, 0, 0, Math.PI);
        ctx.stroke();
    }
    ctx.fillStyle = shade('#8a5a30', -0.3 + rnd() * 0.05);
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, 2.1, 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * A orientação de uma casa: `L` e `W` são o comprido e o largo, e `dims`,
 * `at` e as faces trocam x por y quando a fachada comprida vai ao longo de y.
 */
function houseFrame(along) {
    return {
        along,
        dims: (L, W) => (along ? [L, W] : [W, L]),
        off: (u, v) => (along ? [u, v] : [v, u]),
        front: along ? [0, 1] : [1, 0],
        back: along ? [0, -1] : [-1, 0],
        ends: along ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]]
    };
}

/**
 * A chaminé de cada estilo, no referencial da casa (u ao longo da fachada
 * comprida): da base, à altura do telhado nesse ponto, ao topo. A da casa de
 * pedra sobe do chão, encostada à empena. `houseLive` põe lá o fumo.
 */
const HOUSE_CHIMNEY = [
    { u: 0.15, v: -0.1, base: 28, top: 39 },
    { u: 0.325, v: 0, base: 0, top: 31 },
    { u: -0.14, v: -0.08, base: 36.5, top: 44 },
    null,
    { u: 0.08, v: -0.08, base: 28.5, top: 38.5 },
    { u: -0.16, v: 0.09, base: 29, top: 39 }
];

const FLOWERS = ['#e3372f', '#f2c94c', '#d9577a', '#ef7d2f'];

function house(ctx, { roof = PLAYER_ROOF, variant = 0 }) {
    const rnd = seeded(variant * 17 + 3);
    const style = variant % 6;
    const F = houseFrame(Math.floor(variant / 6) % 2 === 0);
    const faces = (a, b, ox = 0, oy = 0) => ({
        front: houseFace(...F.front, a, b, ox, oy),
        back: houseFace(...F.back, a, b, ox, oy),
        ends: F.ends.map((n) => houseFace(...n, a, b, ox, oy))
    });
    const all = (f) => [f.front, f.back, ...f.ends].filter(Boolean);
    const chim = HOUSE_CHIMNEY[style];
    const at = chim ? F.off(chim.u, chim.v) : null;
    const behind = at && depth(...at) < 0;
    const putChimney = () => chimney(ctx, at[0], at[1], chim.base, chim.top - chim.base, rnd);
    /**
     * O telhado e a chaminé: a chaminé que fica atrás na vista pinta-se antes
     * do telhado, que lhe tapa o pé; a da frente pinta-se depois, por cima.
     */
    const roofAndChimney = (drawRoof) => {
        if (behind) putChimney();
        drawRoof();
        if (at && !behind) putChimney();
    };
    const win = (f, u, z0, z1, w, opts = {}) => houseWindow(ctx, f, u, z0, z1, w, { rnd, ...opts });
    const door = (f, u, w, h, color, opts = {}) => houseDoor(ctx, f, u, w, h, color, { rnd, ...opts });
    const plinth = (f, h) => { for (const face of all(f)) stoneWall(ctx, face, 0, h, PLINTH, rnd, { h: 1.6, w: 0.06 }); };
    const seed = variant * 5 + 1;

    if (style === 0) {
        // Casa de enxaimel: soco de pedra, paredes caiadas com vigas escuras.
        const [a, b] = F.dims(0.6, 0.46);
        const f = faces(a, b);
        box(ctx, a, b, 3, PLINTH);
        plinth(f, 3);
        box(ctx, a, b, 17, PLASTER, { z: 3 });
        for (const face of all(f)) {
            plaster(ctx, face, 3, 20, PLASTER, rnd);
            halfTimber(ctx, face, 3, 20);
        }
        door(f.front, 0.3, 0.1, 11);
        win(f.front, 0.72, 9, 15, 0.08, { shutter: '#3f5a78' });
        win(f.back, 0.3, 9, 15, 0.08, { shutter: '#3f5a78' });
        win(f.back, 0.72, 9, 15, 0.08, { shutter: '#3f5a78' });
        for (const e of f.ends) win(e, 0.5, 9, 15, 0.08, { shutter: '#3f5a78' });
        roofAndChimney(() => tiledRoof(ctx, a, b, 20, 15, roof, PLASTER, { alongX: F.along, seed }));
    } else if (style === 1) {
        // Casa de pedra, baixa, com portadas verdes e chaminé na empena.
        const [a, b] = F.dims(0.58, 0.44);
        const f = faces(a, b);
        // A chaminé sobe do chão: se fica atrás, as paredes tapam-lhe o pé.
        if (behind) putChimney();
        box(ctx, a, b, 16, STONE_WALL);
        for (const face of all(f)) stoneWall(ctx, face, 0, 16, STONE_WALL, rnd);
        door(f.front, 0.5, 0.1, 10.5, '#5d4028', { arch: true, frame: '#b9b0a0' });
        for (const u of [0.2, 0.8]) win(f.front, u, 7, 12, 0.07, { shutter: '#4f6b3a', lintel: '#d9d1c1' });
        win(f.back, 0.5, 7, 12, 0.07, { shutter: '#4f6b3a', lintel: '#d9d1c1' });
        for (const e of f.ends) win(e, 0.5, 7, 12, 0.06, { lintel: '#d9d1c1' });
        tiledRoof(ctx, a, b, 16, 13, roof, STONE_WALL, { alongX: F.along, seed });
        if (!behind) putChimney();
    } else if (style === 2) {
        // Casa de dois pisos: rés-do-chão de pedra, andar de enxaimel a sair para fora.
        const [a, b] = F.dims(0.54, 0.44);
        const [a2, b2] = F.dims(0.6, 0.5);
        const f = faces(a, b);
        const g = faces(a2, b2);
        box(ctx, a, b, 12, STONE_WALL);
        for (const face of all(f)) stoneWall(ctx, face, 0, 12, STONE_WALL, rnd);
        door(f.front, 0.3, 0.1, 9.5, '#5d4028');
        win(f.front, 0.72, 4.5, 9.5, 0.08, { shutter: '#8a2f2a' });
        win(f.back, 0.5, 4.5, 9.5, 0.08, { shutter: '#8a2f2a' });
        box(ctx, a2, b2, 13, PLASTER, { z: 12 });
        // A sombra do andar sobre a parede de baixo.
        for (const face of all(f)) faceShade(ctx, face, 12, 10, 0.3);
        for (const face of all(g)) {
            plaster(ctx, face, 12, 25, PLASTER, rnd);
            halfTimber(ctx, face, 12, 25, { braces: false });
        }
        for (const u of [0.28, 0.72]) {
            win(g.front, u, 16.5, 22, 0.08, { flowers: FLOWERS });
            win(g.back, u, 16.5, 22, 0.08);
        }
        for (const e of g.ends) win(e, 0.5, 16.5, 22, 0.08);
        roofAndChimney(() => tiledRoof(ctx, a2, b2, 25, 17, roof, PLASTER, { alongX: F.along, seed }));
    } else if (style === 3) {
        // Casa comprida e ocre, com portadas azuis, vasos de flores e um alpendre na porta.
        const wall = '#e8c98f';
        const [a, b] = F.dims(0.7, 0.42);
        const f = faces(a, b);
        box(ctx, a, b, 2.5, PLINTH);
        plinth(f, 2.5);
        box(ctx, a, b, 15.5, wall, { z: 2.5 });
        for (const face of all(f)) {
            plaster(ctx, face, 2.5, 18, wall, rnd);
            quoins(ctx, face, 2.5, 18, '#d8cdb8', rnd);
        }
        door(f.front, 0.5, 0.1, 11, '#3f5f82');
        for (const u of [0.18, 0.82]) win(f.front, u, 8, 14, 0.08, { shutter: '#3f7cc0', flowers: FLOWERS });
        for (const u of [0.25, 0.5, 0.75]) win(f.back, u, 8, 14, 0.08, { shutter: '#3f7cc0' });
        for (const e of f.ends) win(e, 0.5, 8, 14, 0.08, { shutter: '#3f7cc0', flowers: FLOWERS });
        tiledRoof(ctx, a, b, 18, 12, roof, wall, { alongX: F.along, seed });
        // O alpendre: um telhadinho por cima da porta.
        if (f.front) {
            const [n0, n1] = F.front;
            const d = (F.along ? b : a) / 2;
            tiledRoof(ctx, F.along ? 0.18 : 0.08, F.along ? 0.08 : 0.18, 12.5, 3, roof, wall, {
                ox: n0 * (d + 0.04), oy: n1 * (d + 0.04), alongX: F.along, over: 0.02, seed: seed + 7, tile: 0.036
            });
        }
    } else if (style === 4) {
        // Casa com anexo: o corpo principal e um barracão de tábuas encostado, com a lenha.
        const [a, b] = F.dims(0.44, 0.44);
        const [sa, sb] = F.dims(0.22, 0.34);
        const [sx, sy] = F.off(0.33, 0.05);
        const f = faces(a, b);
        const main = () => {
            box(ctx, a, b, 3, PLINTH);
            plinth(f, 3);
            box(ctx, a, b, 17, PLASTER, { z: 3 });
            for (const face of all(f)) {
                plaster(ctx, face, 3, 20, PLASTER, rnd);
                halfTimber(ctx, face, 3, 20);
            }
            door(f.front, 0.4, 0.1, 11);
            win(f.back, 0.5, 9, 15, 0.08, { shutter: '#6b4a2b' });
            for (const e of f.ends) win(e, 0.5, 9, 15, 0.08, { shutter: '#6b4a2b' });
            roofAndChimney(() => tiledRoof(ctx, a, b, 20, 14, roof, PLASTER, { alongX: !F.along, seed }));
        };
        const shed = () => {
            const sf = faces(sa, sb, sx, sy);
            box(ctx, sa, sb, 11, WOOD, { ox: sx, oy: sy });
            for (const face of all(sf)) planks(ctx, face, 0, 11, WOOD, rnd);
            door(sf.front, 0.5, 0.1, 8, '#6b4a2b', { frame: '#4a3020' });
            tiledRoof(ctx, sa, sb, 11, 6, shade(roof, -0.1), WOOD, { ox: sx, oy: sy, alongX: F.along, seed: seed + 3, tile: 0.045 });
        };
        const [lx, ly] = F.off(-0.3, 0.2);
        layered([
            [0, 0, main],
            [sx, sy, shed],
            [lx, ly, () => logPile(ctx, lx, ly)]
        ]);
    } else {
        // Casa rebocada a cor-de-rosa, com cunhais de pedra, óculo na empena, candeeiro e um barril à porta.
        const wall = '#ecd3c6';
        const [a, b] = F.dims(0.56, 0.48);
        const f = faces(a, b);
        // O barril à porta: se a vista o deixou atrás da casa, pinta-se primeiro.
        const [bx, by] = F.off(-0.34, 0.3);
        const barrelBehind = depth(bx, by) < 0;
        if (barrelBehind) barrel(ctx, bx, by, rnd);
        box(ctx, a, b, 3, PLINTH);
        plinth(f, 3);
        box(ctx, a, b, 17, wall, { z: 3 });
        for (const face of all(f)) {
            plaster(ctx, face, 3, 20, wall, rnd);
            quoins(ctx, face, 3, 20, '#d8d0c2', rnd);
        }
        door(f.front, 0.5, 0.11, 11.5, '#7a3b2e', { arch: true, frame: '#cfc6b6' });
        for (const u of [0.2, 0.8]) win(f.front, u, 9, 15, 0.07, { flowers: FLOWERS, lintel: '#d8d0c2' });
        for (const u of [0.3, 0.7]) win(f.back, u, 9, 15, 0.07, { lintel: '#d8d0c2' });
        for (const e of f.ends) win(e, 0.5, 9, 15, 0.07, { lintel: '#d8d0c2' });
        if (f.front) {
            // O candeeiro ao lado da porta.
            const [lx, ly] = f.front.at(0.66, 12.5);
            ctx.fillStyle = '#2f2b28';
            ctx.fillRect(lx - 1.1, ly - 2.4, 2.2, 3.4);
            ctx.fillStyle = '#ffd36b';
            ctx.fillRect(lx - 0.6, ly - 1.9, 1.2, 2.2);
        }
        roofAndChimney(() => tiledRoof(ctx, a, b, 20, 15, roof, wall, { alongX: F.along, round: true, seed }));
        if (!barrelBehind) barrel(ctx, bx, by, rnd);
    }
}

// ---------- Texturas dos edifícios ----------
//
// Os edifícios usam as mesmas texturas das casas: `walls` pinta a caixa e,
// em cada face à vista, o reboco, a pedra ou as tábuas; `door` e `windows`
// põem as portas e janelas das casas numa face 'left' (+y) ou 'right' (+x),
// como o `wallPatch` de draw.js — as janelas também na face oposta, para
// se verem de qualquer lado da vista. Os telhados de duas águas são o
// `tiledRoof` das casas; os de quatro águas e os cónicos também levam telhas.

const SIDE_NORMAL = { left: [0, 1], right: [1, 0] };

/** Paredes com textura: 'plaster', 'timber' (reboco com enxaimel), 'stone', 'bigstone' ou 'planks'. */
function walls(ctx, a, b, h, color, { ox = 0, oy = 0, z = 0, tex = 'plaster', top = null, seed = null } = {}) {
    box(ctx, a, b, h, color, { ox, oy, z, top });
    const rnd = seeded(seed ?? Math.round(a * 997 + b * 331 + h * 17 + z));
    for (const n of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const f = houseFace(...n, a, b, ox, oy);
        if (!f) continue;
        if (tex === 'stone') stoneWall(ctx, f, z, z + h, color, rnd);
        else if (tex === 'bigstone') stoneWall(ctx, f, z, z + h, color, rnd, { h: 4, w: 0.15 });
        else if (tex === 'planks') planks(ctx, f, z, z + h, color, rnd, Math.max(3, Math.round(f.w / 0.07)));
        else {
            plaster(ctx, f, z, z + h, color, rnd);
            if (tex === 'timber') halfTimber(ctx, f, z, z + h, { braces: false });
        }
    }
}

/** Uma porta das casas numa face 'left' ou 'right' de uma caixa a x b. */
function door(ctx, side, a, b, u, w, h, color = DOOR, { ox = 0, oy = 0, arch = false, frame = '#5a3d26' } = {}) {
    houseDoor(ctx, houseFace(...SIDE_NORMAL[side], a, b, ox, oy), u, w, h, color, { arch, frame, rnd: seeded(Math.round(u * 100 + h * 7)) });
}

/**
 * Uma janela das casas numa face 'left' ou 'right', e outra igual na face
 * oposta (a menos que `both` seja false). `glass` pinta uma montra ou uma
 * janela acesa.
 */
function windows(ctx, side, a, b, u, w, z0, z1, { ox = 0, oy = 0, both = true, ...opts } = {}) {
    const [nx, ny] = SIDE_NORMAL[side];
    const rnd = seeded(Math.round(u * 100 + z0 * 13));
    houseWindow(ctx, houseFace(nx, ny, a, b, ox, oy), u, z0, z1, w, { rnd, ...opts });
    if (both) houseWindow(ctx, houseFace(-nx, -ny, a, b, ox, oy), 1 - u, z0, z1, w, { rnd, ...opts, flowers: null });
}

/**
 * Telhas numa água triangular, em coordenadas de ecrã: fiadas do beiral (a, b)
 * até ao cimo, cada uma a cobrir a de baixo, com a ponta arredondada.
 */
function tileTriangle(ctx, a, b, apex, c, rnd, rows = 5) {
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const dt = 1 / rows;
    const fills = batch();
    const edges = batch();
    for (let r = 0; r < rows; r++) {
        const t0 = r * dt;
        const t1 = (r + 1) * dt;
        const l0 = lerp(a, apex, t0);
        const r0 = lerp(b, apex, t0);
        const l1 = lerp(a, apex, t1);
        const r1 = lerp(b, apex, t1);
        const n = Math.max(1, Math.round(Math.hypot(r0[0] - l0[0], r0[1] - l0[1]) / 4.5));
        for (let k = 0; k < n; k++) {
            const s0 = k / n + 0.01;
            const s1 = (k + 1) / n - 0.01;
            const t = tone(rnd, 0.14);
            const bl = lerp(l0, r0, s0);
            const br = lerp(l0, r0, s1);
            const tl = lerp(l1, r1, s0);
            const tr = lerp(l1, r1, s1);
            const mid = lerp(l0, r0, (s0 + s1) / 2);
            const drop = [mid[0], mid[1] + 1.2];
            const p = fills.path(shade(c, t));
            p.moveTo(...tl);
            p.lineTo(...tr);
            p.lineTo(...br);
            p.quadraticCurveTo(...drop, ...bl);
            p.closePath();
            const e = edges.path(shade(c, t - 0.32));
            e.moveTo(...br);
            e.quadraticCurveTo(...drop, ...bl);
        }
        fills.fill(ctx);
        edges.stroke(ctx, 0.5);
    }
}

/** Telhado de quatro águas (pirâmide) com telhas: as duas águas da frente, na vista. */
function tiledPyramid(ctx, a, b, z, rise, roof, { ox = 0, oy = 0, over = 0.04, seed = 3 } = {}) {
    const rnd = seeded(seed);
    const base = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => P(ox + sx * (a / 2 + over), oy + sy * (b / 2 + over), z));
    const apex = P(ox, oy, z + rise);
    // O canto mais à frente na vista (o mais baixo no ecrã) e as duas águas que lá se juntam.
    let k = 0;
    for (let i = 1; i < 4; i++) if (base[i][1] > base[k][1]) k = i;
    const prev = base[(k + 3) % 4];
    const next = base[(k + 1) % 4];
    const [leftCorner, rightCorner] = prev[0] < next[0] ? [prev, next] : [next, prev];
    for (const [corner, c] of [[leftCorner, roof], [rightCorner, shade(roof, -0.25)]]) {
        const [p, q] = corner[0] < base[k][0] ? [corner, base[k]] : [base[k], corner];
        poly(ctx, [p, q, apex], shade(c, -0.35));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(...p);
        ctx.lineTo(...q);
        ctx.lineTo(...apex);
        ctx.closePath();
        ctx.clip();
        tileTriangle(ctx, p, q, apex, c, rnd, Math.max(4, Math.round(rise / 3)));
        ctx.restore();
        ctx.strokeStyle = shade(c, -0.45);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(...p);
        ctx.lineTo(...q);
        ctx.stroke();
    }
    // Os rincões: as arestas entre as águas.
    ctx.strokeStyle = shade(roof, -0.4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(...base[k]);
    ctx.lineTo(...apex);
    ctx.stroke();
}

/** Telhado cónico com telhas: fiadas em arco, desencontradas, e a ponta. */
function tiledCone(ctx, x, y, r, rise, color) {
    cone(ctx, x, y, r, rise, color);
    const rows = Math.max(4, Math.round(rise / 3.5));
    ctx.save();
    ctx.lineWidth = 0.6;
    for (let k = 0; k < rows; k++) {
        const t = k / rows;
        const cy = y - rise * t;
        const rr = r * (1 - t);
        // A orla de cada fiada: um arco da frente do cone.
        ctx.strokeStyle = 'rgba(40, 20, 10, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x, cy, rr, rr * 0.5, 0, 0.05, Math.PI - 0.05);
        ctx.stroke();
        // As juntas entre as telhas da fiada.
        const n = Math.max(3, Math.round(rr / 2.2));
        ctx.strokeStyle = 'rgba(40, 20, 10, 0.25)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const ang = ((i + (k % 2) * 0.5 + 0.5) / n) * Math.PI;
            const h = rise / rows;
            const bx = x + Math.cos(ang) * rr;
            const by = cy + Math.sin(ang) * rr * 0.5;
            const r2 = r * (1 - t - h / rise);
            const tx = x + Math.cos(ang) * r2;
            const ty = cy - h + Math.sin(ang) * r2 * 0.5;
            ctx.moveTo(bx, by);
            ctx.lineTo(tx, ty);
        }
        ctx.stroke();
    }
    ctx.restore();
    // O pináculo.
    ctx.fillStyle = shade(color, -0.35);
    ctx.fillRect(x - 0.6, y - rise - 3, 1.2, 3.5);
}

/** Torre redonda de pedra: o cilindro com as fiadas e as juntas desencontradas. */
function stoneTower(ctx, r, h, color, { ox = 0, oy = 0, z = 0 } = {}) {
    const top = cylinder(ctx, r, h, color, { ox, oy, z });
    const [cx, cy] = P(ox, oy, z);
    const step = 3.2;
    ctx.save();
    ctx.lineWidth = 0.55;
    for (let zz = step, row = 0; zz < h - 0.5; zz += step, row++) {
        ctx.strokeStyle = 'rgba(60, 50, 40, 0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, cy - zz, r, r * 0.5, 0, 0.02, Math.PI - 0.02);
        ctx.stroke();
        const n = Math.max(4, Math.round(r / 2.4));
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const ang = ((i + (row % 2) * 0.5 + 0.25) / n) * Math.PI;
            const x = cx + Math.cos(ang) * r;
            const y = cy - zz + Math.sin(ang) * r * 0.5;
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + step);
        }
        ctx.stroke();
    }
    ctx.restore();
    return top;
}

function market(ctx, { roof = PLAYER_ROOF }) {
    diamond(ctx, 0.94, 0.94, 0, '#c9b99a');
    diamond(ctx, 0.86, 0.86, 0.5, '#d8c9a8');
    const stall = (s) => {
        box(ctx, 0.3, 0.22, 7, WOOD, { ox: s.ox, oy: s.oy });
        for (const [px, py] of [[-0.14, -0.1], [0.14, -0.1], [0.14, 0.1], [-0.14, 0.1]]) {
            box(ctx, 0.025, 0.025, 15, TIMBER, { ox: s.ox + px, oy: s.oy + py, z: 7 });
        }
        tiledRoof(ctx, 0.32, 0.26, 20, 6, s.c, s.c, { ox: s.ox, oy: s.oy, tile: 0.045 });
        // Fruta e pão no balcão.
        const [x, y] = P(s.ox, s.oy, 8);
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = ['#e3572f', '#f2c94c', '#8bc34a'][i];
            ctx.beginPath();
            ctx.arc(x - 5 + i * 5, y - 1, 2.2, 0, Math.PI * 2);
            ctx.fill();
        }
    };
    const stalls = [
        { ox: -0.22, oy: -0.2, c: roof },
        { ox: 0.22, oy: -0.18, c: '#e0b43c' },
        { ox: -0.2, oy: 0.24, c: '#4f86c6' }
    ];
    layered([
        // Poço ao centro.
        [0.05, 0.05, () => cylinder(ctx, 6, 6, '#a39c8e', { ox: 0.05, oy: 0.05 })],
        ...stalls.map((s) => [s.ox, s.oy, () => stall(s)]),
        // Caixotes.
        [0.3, 0.3, () => box(ctx, 0.12, 0.12, 6, '#b08255', { ox: 0.3, oy: 0.3 })],
        [0.32, 0.14, () => box(ctx, 0.1, 0.1, 5, '#a07448', { ox: 0.32, oy: 0.14 })]
    ]);
}

/** Uma pilha de toros deitados: a casca a fugir para trás e o topo cortado, com os anéis. */
function logPile(ctx, ox, oy) {
    const [x, y] = P(ox, oy);
    for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 3 - row; k++) {
            const cx = x - 6 + k * 6 + row * 3;
            const cy = y - 3 - row * 5;
            // A casca: o toro a fugir para trás e para cima, na vista.
            ctx.fillStyle = '#5e3d22';
            ctx.beginPath();
            ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - 2.1, cy - 2.1);
            ctx.lineTo(cx + 1.9, cy - 4.1);
            ctx.lineTo(cx + 6.1, cy + 0.1);
            ctx.lineTo(cx + 2.1, cy + 2.1);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7a5234';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx - 0.5, cy - 2.6);
            ctx.lineTo(cx + 3.5, cy - 4.6);
            ctx.stroke();
            // O topo cortado.
            ctx.fillStyle = '#8a5a30';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e0bb85';
            ctx.beginPath();
            ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#b48a55';
            ctx.lineWidth = 0.4;
            for (const r of [0.8, 1.6]) {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
}

function woodcutter(ctx, { roof = '#6f4a2e' }) {
    layered([
        [-0.1, -0.08, () => {
            const o = { ox: -0.1, oy: -0.08 };
            walls(ctx, 0.46, 0.4, 15, '#a57447', { ...o, tex: 'planks' });
            door(ctx, 'left', 0.46, 0.4, 0.5, 0.1, 9.5, DOOR, o);
            windows(ctx, 'right', 0.46, 0.4, 0.5, 0.08, 7, 11.5, { ...o, shutter: '#6b4a2b' });
            tiledRoof(ctx, 0.46, 0.4, 15, 12, roof === PLAYER_ROOF ? '#6f4a2e' : roof, '#a57447', o);
        }],
        [0.28, 0.22, () => logPile(ctx, 0.28, 0.22)],
        // Cepo com o machado.
        [-0.2, 0.3, () => {
            cylinder(ctx, 4, 4, '#8a5a30', { ox: -0.2, oy: 0.3 });
            ctx.strokeStyle = '#5a3a1e';
            ctx.lineWidth = 1.5;
            const [x, y] = P(-0.2, 0.3, 4);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 4, y - 8);
            ctx.stroke();
            poly(ctx, [[x + 3, y - 9], [x + 7, y - 9], [x + 6, y - 5]], '#c0c6cc');
        }]
    ]);
}

function quarry(ctx) {
    diamond(ctx, 0.92, 0.92, 0, '#8e887d');
    diamond(ctx, 0.6, 0.6, -3, '#6f695f');
    diamond(ctx, 0.36, 0.36, -6, '#5e584f');
    const parts = [[0.28, 0.24, 7], [0.32, 0.02, 6], [0.08, 0.34, 5], [-0.3, 0.26, 6]]
        .map(([ox, oy, s]) => [ox, oy, () => box(ctx, 0.14, 0.12, s, '#c5bfb2', { ox, oy })]);
    // Grua de madeira.
    parts.push([-0.3, -0.25, () => {
        const [bx, by] = P(-0.3, -0.25);
        ctx.strokeStyle = '#6b4a2b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by - 34);
        ctx.lineTo(bx + 24, by - 26);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#3b2a18';
        ctx.beginPath();
        ctx.moveTo(bx + 22, by - 26);
        ctx.lineTo(bx + 22, by - 8);
        ctx.stroke();
    }]);
    parts.push([0.02, -0.2, () => box(ctx, 0.08, 0.08, 5, '#c5bfb2', { ox: 0.02, oy: -0.2, z: 4 })]);
    layered(parts);
}

function sapling(ctx, ox, oy, s = 1) {
    const [x, y] = P(ox, oy);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x - 1, y - 6 * s, 2, 6 * s);
    ctx.fillStyle = '#5fae4a';
    ctx.beginPath();
    ctx.arc(x, y - 8 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
}

function forester(ctx, { roof = '#4f7d3a' }) {
    layered([
        [-0.1, -0.12, () => {
            const o = { ox: -0.1, oy: -0.12 };
            walls(ctx, 0.4, 0.36, 13, '#b48a5a', { ...o, tex: 'planks' });
            door(ctx, 'left', 0.4, 0.36, 0.5, 0.1, 8.5, DOOR, o);
            windows(ctx, 'right', 0.4, 0.36, 0.5, 0.08, 6, 10, { ...o, shutter: '#4f6b3a' });
            tiledRoof(ctx, 0.4, 0.36, 13, 11, roof === PLAYER_ROOF ? '#4f7d3a' : roof, '#b48a5a', { ...o, alongX: false });
        }],
        [0.25, 0.1, () => sapling(ctx, 0.25, 0.1, 0.8)],
        [0.05, 0.3, () => sapling(ctx, 0.05, 0.3, 1)],
        [0.3, 0.32, () => sapling(ctx, 0.3, 0.32, 0.7)]
    ]);
}

function millStatic(ctx) {
    stoneTower(ctx, 13, 12, '#b9b2a3');
    const top = stoneTower(ctx, 11, 26, '#d8d0bf', { z: 12 });
    tiledCone(ctx, top.x, top.y, 13, 18, '#7a5234');
    // Porta em arco e uma janelinha, se o lado deles estiver virado para quem olha.
    if (!faceOf(0, 1)) return;
    const [x, y] = P(0, 0.2);
    ctx.fillStyle = '#5a3d26';
    ctx.beginPath();
    ctx.moveTo(x - 3.8, y - 1.5);
    ctx.lineTo(x - 3.8, y - 9);
    ctx.quadraticCurveTo(x, y - 14.5, x + 3.8, y - 9);
    ctx.lineTo(x + 3.8, y - 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = DOOR;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 2);
    ctx.lineTo(x - 3, y - 9);
    ctx.quadraticCurveTo(x, y - 13.4, x + 3, y - 9);
    ctx.lineTo(x + 3, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0b43c';
    ctx.fillRect(x + 1.4, y - 6.5, 0.9, 0.9);
    ctx.fillStyle = FRAME;
    ctx.fillRect(x - 2.4, y - 28, 4.8, 5.6);
    ctx.fillStyle = GLASS;
    ctx.fillRect(x - 1.7, y - 27.3, 3.4, 4.2);
}

function bakery(ctx, { roof = '#b5652f' }) {
    walls(ctx, 0.62, 0.48, 18, WALL, { tex: 'timber' });
    door(ctx, 'left', 0.62, 0.48, 0.25, 0.1, 10.5);
    // A montra do pão, acesa pelo forno.
    windows(ctx, 'left', 0.62, 0.48, 0.65, 0.2, 6, 12.5, { glass: '#e9a93f', both: false });
    windows(ctx, 'right', 0.62, 0.48, 0.5, 0.1, 8, 13.5, { shutter: '#8a4a2a' });
    tiledRoof(ctx, 0.62, 0.48, 18, 14, roof === PLAYER_ROOF ? '#b5652f' : roof, WALL);
    chimney(ctx, 0.18, -0.1, 26, 10, seeded(41));
    // Tabuleta com um pão, na esquina da fachada — quando a fachada está à esquerda.
    if (faceOf(0, 1) !== 'left') return;
    const [x, y] = P(-0.31, 0.24, 14);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x - 8, y - 2, 8, 1.5);
    ctx.fillStyle = '#d99a4e';
    ctx.beginPath();
    ctx.ellipse(x - 7, y + 3, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
}

function fence(ctx, size, part) {
    // `part`: 'back' ou 'front' — os lados de trás pintam-se antes do que está
    // dentro da cerca, os da frente depois.
    const h = size / 2;
    const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
    const sides = [0, 1, 2, 3].filter((i) => {
        const [ax, ay] = corners[i];
        const [bx, by] = corners[(i + 1) % 4];
        return (depth((ax + bx) / 2, (ay + by) / 2) < 0) === (part === 'back');
    });
    ctx.strokeStyle = '#7a5234';
    ctx.lineWidth = 1.3;
    for (const lift of [3, 6]) {
        ctx.beginPath();
        for (const i of sides) {
            const [ax, ay] = corners[i];
            const [bx, by] = corners[(i + 1) % 4];
            ctx.moveTo(...P(ax, ay, lift));
            ctx.lineTo(...P(bx, by, lift));
        }
        ctx.stroke();
    }
    ctx.lineWidth = 1.6;
    for (const i of sides) {
        const [ax, ay] = corners[i];
        const [bx, by] = corners[(i + 1) % 4];
        for (let k = 0; k < 4; k++) {
            const t = k / 4;
            const [x, y] = P(ax + (bx - ax) * t, ay + (by - ay) * t);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - 8);
            ctx.stroke();
        }
    }
}

function pasture(ctx, { roof = '#8a3b2c' }) {
    diamond(ctx, 0.92, 0.92, 0, '#79b64a');
    fence(ctx, 0.88, 'back');
    layered([
        // Abrigo das vacas, ao fundo.
        [-0.22, -0.25, () => {
            walls(ctx, 0.34, 0.26, 12, '#a57447', { ox: -0.22, oy: -0.25, tex: 'planks' });
            tiledRoof(ctx, 0.34, 0.26, 12, 8, roof === PLAYER_ROOF ? '#8a3b2c' : roof, '#a57447', { ox: -0.22, oy: -0.25 });
        }],
        // Manjedoura.
        [0.22, -0.28, () => box(ctx, 0.2, 0.08, 4, '#9a6a3f', { ox: 0.22, oy: -0.28 })]
    ]);
    fence(ctx, 0.88, 'front');
}

function pigsty(ctx, { roof = '#7a4a32' }) {
    diamond(ctx, 0.92, 0.92, 0, '#8fae55');
    // A lama onde os porcos se espojam.
    diamond(ctx, 0.5, 0.42, 0.3, '#7a5a3a', null, 0.12, 0.14);
    diamond(ctx, 0.34, 0.26, 0.5, '#6a4c30', null, 0.16, 0.18);
    fence(ctx, 0.88, 'back');
    layered([
        // O curral coberto, baixo, ao fundo.
        [-0.22, -0.26, () => {
            walls(ctx, 0.34, 0.24, 9, '#a57447', { ox: -0.22, oy: -0.26, tex: 'planks' });
            door(ctx, 'left', 0.34, 0.24, 0.5, 0.12, 6.5, DOOR, { ox: -0.22, oy: -0.26 });
            tiledRoof(ctx, 0.34, 0.24, 9, 7, roof === PLAYER_ROOF ? '#7a4a32' : roof, '#a57447', { ox: -0.22, oy: -0.26 });
        }],
        // O comedouro.
        [0.24, -0.28, () => box(ctx, 0.2, 0.08, 3.5, '#8a5a30', { ox: 0.24, oy: -0.28, top: '#d8b14a' })]
    ]);
    fence(ctx, 0.88, 'front');
}

function carpentry(ctx, { roof = '#6d5a4a' }) {
    layered([
        [0, -0.12, () => {
            walls(ctx, 0.72, 0.42, 16, '#b88a5c', { oy: -0.12, tex: 'planks' });
            door(ctx, 'left', 0.72, 0.42, 0.3, 0.2, 11.5, '#6b4a2b', { oy: -0.12 });
            windows(ctx, 'left', 0.72, 0.42, 0.75, 0.12, 7, 12.5, { oy: -0.12, shutter: '#5d4028' });
            windows(ctx, 'right', 0.72, 0.42, 0.5, 0.08, 7, 12.5, { oy: -0.12 });
            tiledRoof(ctx, 0.72, 0.42, 16, 12, roof === PLAYER_ROOF ? '#6d5a4a' : roof, '#b88a5c', { oy: -0.12 });
            chimney(ctx, 0.2, -0.2, 22, 10, seeded(43));
        }],
        // Pilhas de tábuas à frente.
        [0.02, 0.3, () => {
            for (let i = 0; i < 4; i++) box(ctx, 0.36, 0.1, 1.6, i % 2 ? '#e0b980' : '#d4aa6e', { ox: 0.02, oy: 0.3, z: i * 1.8 });
        }],
        [0.34, 0.12, () => {
            for (let i = 0; i < 3; i++) box(ctx, 0.1, 0.3, 1.6, '#d9b27a', { ox: 0.34, oy: 0.12, z: i * 1.8 });
        }]
    ]);
}

function hay(ctx, ox, oy) {
    const [x, y] = P(ox, oy);
    ctx.fillStyle = '#d8b14a';
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b08a2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 3.5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function barn(ctx, { roof = '#5b3a2a' }) {
    const red = '#a8342d';
    const o = { ox: -0.06, oy: -0.06 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, 0.56, 0.62, 22, red, { ...o, tex: 'planks' });
            // Portão com a cruz branca.
            wallPatch(ctx, 'left', 0.56, 0.62, 0.5, 0.26, 0, 15, '#f1ebe0', o);
            wallPatch(ctx, 'left', 0.56, 0.62, 0.5, 0.22, 1, 14, shade(red, -0.2), o);
            const gate = houseFace(0, 1, 0.56, 0.62, o.ox, o.oy);
            if (gate) {
                const [u0, u1] = [0.5 - 0.11 / 0.56, 0.5 + 0.11 / 0.56];
                faceLine(ctx, gate, u0, 1, u1, 14, '#f1ebe0', 1.3);
                faceLine(ctx, gate, u1, 1, u0, 14, '#f1ebe0', 1.3);
                faceLine(ctx, gate, 0.5, 1, 0.5, 14, '#f1ebe0', 0.9);
            }
            windows(ctx, 'right', 0.56, 0.62, 0.5, 0.08, 16, 20, { ...o, frame: '#f1ebe0' });
            tiledRoof(ctx, 0.56, 0.62, 22, 16, roof === PLAYER_ROOF ? '#5b3a2a' : roof, red, { ...o, alongX: false });
        }],
        [0.32, 0.18, () => hay(ctx, 0.32, 0.18)],
        [0.3, 0.36, () => hay(ctx, 0.3, 0.36)],
        [0.16, 0.36, () => hay(ctx, 0.16, 0.36)]
    ]);
}

function dairy(ctx, { roof = '#5d7fa8' }) {
    const white = '#f4f1ea';
    const parts = [[0, 0, () => {
        walls(ctx, 0.58, 0.5, 3, PLINTH, { tex: 'stone' });
        walls(ctx, 0.58, 0.5, 15, white, { z: 3 });
        door(ctx, 'left', 0.58, 0.5, 0.3, 0.1, 10.5, '#5d7fa8');
        windows(ctx, 'left', 0.58, 0.5, 0.7, 0.1, 8, 13.5, { shutter: '#5d7fa8' });
        windows(ctx, 'right', 0.58, 0.5, 0.5, 0.1, 8, 13.5, { shutter: '#5d7fa8' });
        tiledRoof(ctx, 0.58, 0.5, 18, 12, roof === PLAYER_ROOF ? '#5d7fa8' : roof, white, { alongX: false });
    }]];
    // Bilhas de leite.
    for (const [ox, oy] of [[0.36, 0.22], [0.36, 0.36], [0.22, 0.38]]) {
        parts.push([ox, oy, () => {
            const top = cylinder(ctx, 3, 7, '#b8c0c8', { ox, oy });
            ctx.fillStyle = '#8c959e';
            ctx.fillRect(top.x - 1.5, top.y - 2, 3, 2);
        }]);
    }
    // Uma roda de queijo à porta.
    parts.push([-0.1, 0.4, () => {
        const [x, y] = P(-0.1, 0.4);
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.ellipse(x, y - 3, 6, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d9a632';
        ctx.fillRect(x - 6, y - 3, 12, 3);
    }]);
    layered(parts);
}

function goldmine(ctx) {
    // A mina é um monte de rocha com a entrada virada para quem olha, venha de
    // onde vier: não roda com a vista.
    unturned(() => goldmineBody(ctx));
}

function goldmineBody(ctx) {
    // Monte de rocha escavado, com a entrada virada para a esquerda.
    poly(ctx, [P(-0.45, 0.4), P(0.4, 0.45), P(0.3, -0.35), [0, -38], P(-0.4, -0.3)], '#8a7f6a');
    poly(ctx, [P(0.4, 0.45), P(0.3, -0.35), [0, -38], [2, -20]], '#6f6553');
    poly(ctx, [P(-0.45, 0.4), [2, -20], [0, -38], P(-0.4, -0.3)], '#9d927b');
    const [ex, ey] = P(-0.12, 0.28);
    ctx.fillStyle = '#1e1810';
    ctx.beginPath();
    ctx.moveTo(ex - 9, ey);
    ctx.lineTo(ex - 9, ey - 12);
    ctx.quadraticCurveTo(ex, ey - 20, ex + 9, ey - 12);
    ctx.lineTo(ex + 9, ey);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5234';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex - 10, ey + 1);
    ctx.lineTo(ex - 10, ey - 14);
    ctx.lineTo(ex + 10, ey - 14);
    ctx.lineTo(ex + 10, ey + 1);
    ctx.stroke();
    // Carris e vagoneta com ouro.
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(...P(-0.1, 0.3));
    ctx.lineTo(...P(-0.1, 0.5));
    ctx.moveTo(...P(-0.02, 0.3));
    ctx.lineTo(...P(-0.02, 0.5));
    ctx.stroke();
    box(ctx, 0.16, 0.12, 6, '#6b5a48', { ox: 0.18, oy: 0.36 });
    const [cx, cy] = P(0.18, 0.36, 6);
    ctx.fillStyle = '#f2c94c';
    for (const [dx, dy] of [[-3, 0], [2, -1], [0, -3]]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function coop(ctx, { roof = '#9a5a2a' }) {
    diamond(ctx, 0.92, 0.92, 0, '#b9a36a');
    diamond(ctx, 0.84, 0.84, 0.4, '#c7b27a');
    fence(ctx, 0.88, 'back');
    layered([
        // A casota das galinhas, em cima de estacas, com a rampa.
        [-0.2, -0.22, () => {
            const o = { ox: -0.2, oy: -0.22 };
            for (const [dx, dy] of [[-0.12, -0.09], [0.12, -0.09], [0.12, 0.09], [-0.12, 0.09]]) {
                box(ctx, 0.03, 0.03, 5, TIMBER, { ox: o.ox + dx, oy: o.oy + dy });
            }
            walls(ctx, 0.3, 0.24, 9, '#c79a5e', { ...o, z: 5, tex: 'planks' });
            wallPatch(ctx, 'left', 0.3, 0.24, 0.5, 0.08, 5, 10, DOOR, o);
            tiledRoof(ctx, 0.3, 0.24, 14, 8, roof === PLAYER_ROOF ? '#9a5a2a' : roof, '#c79a5e', o);
            if (faceOf(0, 1)) poly(ctx, [P(-0.23, -0.1, 5), P(-0.17, -0.1, 5), P(-0.17, 0.06, 0), P(-0.23, 0.06, 0)], '#a57447');
        }],
        // O bebedouro e um cesto de ovos.
        [0.26, -0.24, () => cylinder(ctx, 4, 2.5, '#9aa3ab', { ox: 0.26, oy: -0.24 })],
        [0.3, 0.3, () => {
            const top = cylinder(ctx, 4.5, 4, '#9a6a3f', { ox: 0.3, oy: 0.3 });
            ctx.fillStyle = '#f6efe0';
            for (const [dx, dy] of [[-1.6, 0], [1.6, 0.2], [0, -1.2]]) {
                ctx.beginPath();
                ctx.ellipse(top.x + dx, top.y + dy - 0.8, 1.4, 1.8, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }]
    ]);
    fence(ctx, 0.88, 'front');
}

// ---------- Lã, vinho, roupa e cultura (castelo nível 3 e 4) ----------

function sheepfold(ctx, { roof = '#7a5a3a' }) {
    diamond(ctx, 0.92, 0.92, 0, '#86bd55');
    fence(ctx, 0.88, 'back');
    layered([
        // O abrigo das ovelhas, de palha, ao fundo.
        [-0.2, -0.24, () => {
            walls(ctx, 0.38, 0.28, 11, '#b58b5c', { ox: -0.2, oy: -0.24, tex: 'planks' });
            door(ctx, 'left', 0.38, 0.28, 0.5, 0.13, 8.5, DOOR, { ox: -0.2, oy: -0.24 });
            tiledRoof(ctx, 0.38, 0.28, 11, 9, roof === PLAYER_ROOF ? '#d0a94f' : roof, '#b58b5c', { ox: -0.2, oy: -0.24 });
        }],
        // Um fardo de lã tosquiada, à espera de ir para a tecelagem.
        [0.26, -0.26, () => {
            const [x, y] = P(0.26, -0.26);
            ctx.fillStyle = '#f3efe4';
            ctx.beginPath();
            ctx.arc(x - 3, y - 4, 4, 0, Math.PI * 2);
            ctx.arc(x + 3, y - 4, 4, 0, Math.PI * 2);
            ctx.arc(x, y - 7, 4, 0, Math.PI * 2);
            ctx.fill();
        }]
    ]);
    fence(ctx, 0.88, 'front');
}

/** Um rolo de tecido deitado, ao longo de x, com a ponta desenrolada. */
function clothRoll(ctx, ox, oy, color, z = 0) {
    const [ax, ay] = P(ox - 0.12, oy, z + 3);
    const [bx, by] = P(ox + 0.12, oy, z + 3);
    ctx.strokeStyle = shade(color, -0.25);
    ctx.lineWidth = 6.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 0.8);
    ctx.lineTo(bx, by - 0.8);
    ctx.stroke();
    ctx.lineCap = 'butt';
}

function weaving(ctx, { roof = '#6f5b8f' }) {
    const wall = '#eadfca';
    const o = { ox: 0, oy: -0.1 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, 0.74, 0.46, 17, wall, { ...o, tex: 'timber' });
            door(ctx, 'left', 0.74, 0.46, 0.2, 0.1, 11, DOOR, o);
            // Janelas largas: os teares precisam de luz.
            for (const u of [0.45, 0.75]) windows(ctx, 'left', 0.74, 0.46, u, 0.14, 7, 13, { ...o, shutter: '#6f5b8f' });
            windows(ctx, 'right', 0.74, 0.46, 0.5, 0.16, 7, 13, o);
            tiledRoof(ctx, 0.74, 0.46, 17, 13, roof === PLAYER_ROOF ? '#6f5b8f' : roof, wall, o);
        }],
        // Os rolos de tecido à porta, em pilha.
        [0.1, 0.32, () => {
            clothRoll(ctx, 0.1, 0.3, '#c0504d');
            clothRoll(ctx, 0.1, 0.4, '#4f7fb8');
            clothRoll(ctx, 0.1, 0.35, '#e0c068', 5);
        }],
        // Um novelo de lã num cesto.
        [0.34, 0.3, () => {
            const top = cylinder(ctx, 4.5, 4, '#9a6a3f', { ox: 0.34, oy: 0.3 });
            ctx.fillStyle = '#f3efe4';
            ctx.beginPath();
            ctx.arc(top.x, top.y - 1.5, 3.2, 0, Math.PI * 2);
            ctx.fill();
        }]
    ]);
}

/** Uma pipa de pé: um cilindro com os arcos de ferro. */
function cask(ctx, ox, oy, r = 4.5, h = 8) {
    const top = cylinder(ctx, r, h, '#8a5a30', { ox, oy });
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.7)';
    ctx.lineWidth = 1;
    for (const k of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.ellipse(top.x, top.y + h * k, r, r * 0.5, 0, 0, Math.PI);
        ctx.stroke();
    }
    return top;
}

function distillery(ctx, { roof = '#7b3b4b' }) {
    const o = { ox: -0.1, oy: -0.1 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, 0.56, 0.5, 16, STONE, { ...o, tex: 'stone' });
            door(ctx, 'left', 0.56, 0.5, 0.3, 0.12, 11, DOOR, { ...o, arch: true, frame: '#b9b0a0' });
            windows(ctx, 'left', 0.56, 0.5, 0.72, 0.09, 7.5, 12.5, { ...o, lintel: '#e0d8c8' });
            windows(ctx, 'right', 0.56, 0.5, 0.5, 0.09, 7.5, 12.5, { ...o, lintel: '#e0d8c8' });
            tiledRoof(ctx, 0.56, 0.5, 16, 12, roof === PLAYER_ROOF ? '#7b3b4b' : roof, STONE, { ...o, alongX: false });
        }],
        // O alambique de cobre, com o capacete e o tubo.
        [0.3, -0.12, () => {
            const top = cylinder(ctx, 6, 9, '#c77a3a', { ox: 0.3, oy: -0.12 });
            cone(ctx, top.x, top.y, 6, 6, '#b06a30');
            ctx.strokeStyle = '#a0602c';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(top.x, top.y - 6);
            ctx.quadraticCurveTo(top.x + 8, top.y - 10, top.x + 9, top.y + 4);
            ctx.stroke();
        }],
        [0.3, 0.28, () => cask(ctx, 0.3, 0.28)],
        [0.12, 0.36, () => cask(ctx, 0.12, 0.36)],
        [0.36, 0.1, () => cask(ctx, 0.36, 0.1, 3.6, 6)]
    ]);
}

function tavern(ctx, { roof = '#8a4a2a' }) {
    const o = { ox: -0.04, oy: -0.06 };
    layered([
        [o.ox, o.oy, () => {
            // Dois andares de enxaimel: o de baixo de pedra, o de cima caiado.
            walls(ctx, 0.62, 0.52, 11, STONE, { ...o, tex: 'stone' });
            walls(ctx, 0.62, 0.52, 10, WALL, { ...o, z: 11, tex: 'timber' });
            door(ctx, 'left', 0.62, 0.52, 0.28, 0.12, 9.5, DOOR, o);
            windows(ctx, 'left', 0.62, 0.52, 0.72, 0.15, 3.5, 8.5, { ...o, glass: '#e9a93f', both: false });
            for (const u of [0.28, 0.74]) windows(ctx, 'left', 0.62, 0.52, u, 0.09, 14, 18.5, { ...o, flowers: ['#e3372f', '#f2c94c'] });
            windows(ctx, 'right', 0.62, 0.52, 0.5, 0.11, 14, 18.5, { ...o, glass: '#e9a93f' });
            tiledRoof(ctx, 0.62, 0.52, 21, 14, roof === PLAYER_ROOF ? '#8a4a2a' : roof, WALL, o);
            chimney(ctx, o.ox + 0.18, o.oy - 0.12, 28, 11, seeded(47));
        }],
        // Mesa e bancos cá fora.
        [0.24, 0.34, () => {
            box(ctx, 0.2, 0.1, 5, WOOD, { ox: 0.24, oy: 0.34 });
            box(ctx, 0.2, 0.04, 2.5, TIMBER, { ox: 0.24, oy: 0.43 });
        }],
        [-0.26, 0.36, () => cask(ctx, -0.26, 0.36, 3.6, 6)]
    ]);
    // A tabuleta com a caneca, na esquina da fachada — quando a fachada está à esquerda.
    if (faceOf(0, 1) !== 'left') return;
    const [x, y] = P(-0.35, 0.2, 19);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x - 9, y - 2, 9, 1.5);
    ctx.fillStyle = '#e9d9a8';
    ctx.fillRect(x - 9, y, 7, 6);
    ctx.fillStyle = '#c98434';
    ctx.fillRect(x - 7.5, y + 1.2, 3.2, 3.8);
    ctx.fillStyle = '#fffbe8';
    ctx.fillRect(x - 7.5, y + 1.2, 3.2, 1);
}

/** Um manequim de alfaiate com um vestido (ou um fato). */
function mannequin(ctx, ox, oy, color) {
    const [x, y] = P(ox, oy);
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 5);
    ctx.stroke();
    poly(ctx, [[x - 2.5, y - 16], [x + 2.5, y - 16], [x + 4.5, y - 5], [x - 4.5, y - 5]], color);
    poly(ctx, [[x - 2.5, y - 16], [x + 2.5, y - 16], [x + 1.6, y - 11], [x - 1.6, y - 11]], shade(color, 0.2));
    ctx.fillStyle = '#e9d9c0';
    ctx.beginPath();
    ctx.arc(x, y - 17.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
}

function tailor(ctx, { roof = '#3f6f6a' }) {
    const color = roof === PLAYER_ROOF ? '#3f6f6a' : roof;
    const o = { ox: -0.06, oy: -0.1 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, 0.6, 0.46, 3, PLINTH, { ...o, tex: 'stone' });
            walls(ctx, 0.6, 0.46, 16, WALL, { ...o, z: 3 });
            door(ctx, 'left', 0.6, 0.46, 0.22, 0.1, 11, DOOR, o);
            // A montra.
            windows(ctx, 'left', 0.6, 0.46, 0.64, 0.26, 4, 12, { ...o, glass: '#8fb3c8', both: false });
            windows(ctx, 'right', 0.6, 0.46, 0.5, 0.1, 9, 14.5, { ...o, shutter: color });
            tiledPyramid(ctx, 0.6, 0.46, 19, 12, color, o);
            // O toldo às riscas por cima da montra.
            if (faceOf(0, 1)) {
                const y = o.oy + 0.23;
                for (let i = 0; i < 5; i++) {
                    const xa = o.ox + 0.02 + i * 0.05;
                    poly(ctx, [P(xa, y, 14), P(xa + 0.05, y, 14), P(xa + 0.05, y + 0.08, 11), P(xa, y + 0.08, 11)],
                        i % 2 ? '#f4f1ea' : color);
                }
            }
        }],
        [0.3, 0.3, () => mannequin(ctx, 0.3, 0.3, '#b8457a')],
        [0.06, 0.38, () => mannequin(ctx, 0.06, 0.38, '#34405a')]
    ]);
}

function theatre(ctx, { roof = '#8e2f3c' }) {
    const color = roof === PLAYER_ROOF ? '#8e2f3c' : roof;
    const marble = '#efe8da';
    diamond(ctx, 0.94, 0.94, 0, '#d6ccb8');
    const o = { ox: -0.08, oy: -0.08 };
    const parts = [[o.ox, o.oy, () => {
        box(ctx, 0.72, 0.66, 3, '#cfc6b3', o);
        walls(ctx, 0.66, 0.6, 26, marble, { ...o, z: 3, tex: 'bigstone' });
        wallPatch(ctx, 'left', 0.66, 0.6, 0.5, 0.16, 3, 16, color, o);
        for (const u of [0.3, 0.7]) windows(ctx, 'right', 0.66, 0.6, u, 0.09, 12, 20, { ...o, lintel: '#f7f2e6' });
        // Frontão triangular sobre a fachada, e o telhado.
        tiledRoof(ctx, 0.66, 0.6, 29, 13, color, marble, { ...o, alongX: false });
        // As máscaras da comédia e da tragédia, no frontão.
        if (faceOf(0, 1) === 'left') {
            const [x, y] = P(o.ox, o.oy + 0.31, 34);
            for (const [dx, c, smile] of [[-3.2, '#f2c14e', 1], [3.2, '#d8dde4', -1]]) {
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.ellipse(x + dx, y, 2.6, 3.2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#3a2a20';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(x + dx, y + 1.2 - smile * 0.6, 1.3, smile > 0 ? 0 : Math.PI, smile > 0 ? Math.PI : 0);
                ctx.stroke();
            }
        }
    }]];
    // As colunas do pórtico, à frente da fachada (+y).
    for (let i = 0; i < 4; i++) {
        const ox = o.ox - 0.27 + i * 0.18;
        const oy = o.oy + 0.38;
        parts.push([ox, oy, () => cylinder(ctx, 2.2, 26, '#f7f2e6', { ox, oy, z: 3 })]);
    }
    parts.push([o.ox, o.oy + 0.38, () => box(ctx, 0.66, 0.08, 3, marble, { ox: o.ox, oy: o.oy + 0.38, z: 29 })]);
    layered(parts);
}

// ---------- Açúcar e doces (castelo nível 5) ----------

function sugarmill(ctx, { roof = '#8a6a3a' }) {
    const o = { ox: -0.08, oy: -0.1 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, 0.6, 0.48, 3, PLINTH, { ...o, tex: 'stone' });
            walls(ctx, 0.6, 0.48, 13, '#e6dcc4', { ...o, z: 3 });
            door(ctx, 'left', 0.6, 0.48, 0.3, 0.12, 11, DOOR, o);
            windows(ctx, 'left', 0.6, 0.48, 0.72, 0.09, 7.5, 12.5, { ...o, shutter: '#8a6a3a' });
            windows(ctx, 'right', 0.6, 0.48, 0.5, 0.09, 7.5, 12.5, { ...o, shutter: '#8a6a3a' });
            tiledRoof(ctx, 0.6, 0.48, 16, 12, roof === PLAYER_ROOF ? '#8a6a3a' : roof, '#e6dcc4', o);
        }],
        // A chaminé alta das caldeiras, de tijolo.
        [0.3, -0.26, () => {
            walls(ctx, 0.1, 0.1, 40, '#b5654a', { ox: 0.3, oy: -0.26, tex: 'stone', seed: 53 });
            box(ctx, 0.13, 0.13, 2, '#8f4a36', { ox: 0.3, oy: -0.26, z: 40 });
            diamond(ctx, 0.06, 0.06, 42, '#2a2622', null, 0.3, -0.26);
        }],
        // A moenda: três rolos de pedra de pé.
        [0.28, 0.24, () => {
            for (const [dx, dy] of [[-0.06, 0], [0.06, 0], [0, 0.08]]) cylinder(ctx, 3.2, 8, '#a39c8e', { ox: 0.28 + dx, oy: 0.24 + dy });
        }],
        // Um molho de cana à espera.
        [-0.2, 0.34, () => {
            const [x, y] = P(-0.2, 0.34);
            ctx.strokeStyle = '#c9b24a';
            ctx.lineWidth = 1.6;
            for (let k = 0; k < 5; k++) {
                ctx.beginPath();
                ctx.moveTo(x - 9 + k, y - 1 - k * 0.8);
                ctx.lineTo(x + 7 + k, y - 5 - k * 0.8);
                ctx.stroke();
            }
        }]
    ]);
}

/** Um bolo de dois andares, com cobertura e uma cereja. */
function cake(ctx, x, y) {
    ctx.fillStyle = '#e8c18a';
    ctx.fillRect(x - 4, y - 4, 8, 4);
    ctx.fillStyle = '#f7e6f0';
    ctx.fillRect(x - 4, y - 5, 8, 1.6);
    ctx.fillStyle = '#e8c18a';
    ctx.fillRect(x - 2.5, y - 8, 5, 3);
    ctx.fillStyle = '#f7e6f0';
    ctx.fillRect(x - 2.5, y - 9, 5, 1.4);
    ctx.fillStyle = '#d23a4a';
    ctx.beginPath();
    ctx.arc(x, y - 10, 1.1, 0, Math.PI * 2);
    ctx.fill();
}

function patisserie(ctx, { roof = '#d27a9a' }) {
    const color = roof === PLAYER_ROOF ? '#d27a9a' : roof;
    const wall = '#fbf3e6';
    const o = { ox: -0.06, oy: -0.1 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, 0.6, 0.48, 18, wall, o);
            door(ctx, 'left', 0.6, 0.48, 0.22, 0.1, 11, '#8a4a5a', o);
            windows(ctx, 'left', 0.6, 0.48, 0.64, 0.26, 4, 12, { ...o, glass: '#f0c98a', both: false });
            windows(ctx, 'right', 0.6, 0.48, 0.5, 0.1, 9, 14.5, { ...o, shutter: color, flowers: ['#d9577a', '#f7e6f0'] });
            tiledRoof(ctx, 0.6, 0.48, 18, 13, color, wall, o);
            chimney(ctx, o.ox + 0.16, o.oy - 0.1, 24, 10, seeded(59));
            // O toldo às riscas cor-de-rosa por cima da montra.
            if (faceOf(0, 1)) {
                const y = o.oy + 0.24;
                for (let i = 0; i < 5; i++) {
                    const xa = o.ox + 0.02 + i * 0.05;
                    poly(ctx, [P(xa, y, 14), P(xa + 0.05, y, 14), P(xa + 0.05, y + 0.08, 11), P(xa, y + 0.08, 11)],
                        i % 2 ? wall : color);
                }
            }
        }],
        // A mesinha cá fora com um bolo.
        [0.28, 0.3, () => {
            box(ctx, 0.14, 0.14, 5, WOOD, { ox: 0.28, oy: 0.3 });
            const [x, y] = P(0.28, 0.3, 5);
            cake(ctx, x, y);
        }]
    ]);
}

// ---------- Visitas e luxo (castelo níveis 4 e 5) ----------

/** Uma mala de viagem de couro, com a pega por cima. */
function suitcase(ctx, ox, oy, color, { z = 0, a = 0.1, b = 0.05, h = 4 } = {}) {
    box(ctx, a, b, h, color, { ox, oy, z });
    const [x, y] = P(ox, oy, z + h);
    ctx.strokeStyle = shade(color, -0.35);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(x, y - 0.2, 1.3, Math.PI, 0);
    ctx.stroke();
}

function inn(ctx, { roof = '#3f6f8a' }) {
    const color = roof === PLAYER_ROOF ? '#3f6f8a' : roof;
    const a = 0.66;
    const b = 0.54;
    const o = { ox: -0.06, oy: -0.08 };
    layered([
        [o.ox, o.oy, () => {
            // Três pisos: o de baixo de pedra, os dois de cima de enxaimel caiado.
            walls(ctx, a, b, 11, STONE, { ...o, tex: 'stone' });
            walls(ctx, a, b, 9, WALL, { ...o, z: 11, tex: 'timber' });
            walls(ctx, a, b, 9, WALL, { ...o, z: 20, tex: 'timber', seed: 71 });
            door(ctx, 'left', a, b, 0.5, 0.13, 9.5, DOOR, { ...o, arch: true });
            for (const u of [0.18, 0.82]) windows(ctx, 'left', a, b, u, 0.1, 3.5, 8.5, { ...o, glass: '#e9a93f', both: false });
            // Os quartos: uma janela por quarto, com portadas e vasos de flores.
            for (const z of [13, 22]) {
                for (const u of [0.2, 0.5, 0.8]) windows(ctx, 'left', a, b, u, 0.08, z, z + 5, { ...o, shutter: color, flowers: ['#e3372f', '#f2c94c', '#d9577a'] });
                for (const u of [0.3, 0.7]) windows(ctx, 'right', a, b, u, 0.08, z, z + 5, { ...o, shutter: color });
            }
            tiledRoof(ctx, a, b, 29, 14, color, WALL, o);
            chimney(ctx, o.ox + 0.2, o.oy - 0.12, 36, 10, seeded(83));
        }],
        // As malas dos visitantes que acabaram de chegar.
        [0.3, 0.34, () => {
            box(ctx, 0.14, 0.09, 5, '#7a4a2a', { ox: 0.3, oy: 0.34 });
            box(ctx, 0.14, 0.02, 1, '#c9a24a', { ox: 0.3, oy: 0.34, z: 3 });
            suitcase(ctx, 0.3, 0.34, '#3f5f8a', { z: 5 });
        }],
        [0.14, 0.4, () => suitcase(ctx, 0.14, 0.4, '#8a3f3f', { a: 0.08, h: 5 })]
    ]);
    // A tabuleta com a campainha, na esquina da fachada — quando a fachada está à esquerda.
    if (faceOf(0, 1) !== 'left') return;
    const [x, y] = P(o.ox - a / 2, o.oy + b / 2, 19);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x - 10, y - 2, 10, 1.5);
    ctx.fillStyle = '#e9d9a8';
    ctx.fillRect(x - 10, y, 8, 6.5);
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    ctx.arc(x - 6, y + 4.8, 2.4, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 8.8, y + 4.8, 5.6, 0.9);
    ctx.fillRect(x - 6.4, y + 1.6, 0.8, 1);
}

function jewelry(ctx, { roof = '#4a3f8a' }) {
    const color = roof === PLAYER_ROOF ? '#4a3f8a' : roof;
    const marble = '#f3ede2';
    const gold = '#e0b43c';
    const a = 0.56;
    const b = 0.46;
    const o = { ox: -0.06, oy: -0.1 };
    layered([
        [o.ox, o.oy, () => {
            walls(ctx, a, b, 3, PLINTH, { ...o, tex: 'stone' });
            walls(ctx, a, b, 15, marble, { ...o, z: 3, tex: 'bigstone' });
            // Uma cinta dourada por baixo do beiral.
            walls(ctx, a, b, 1.2, gold, { ...o, z: 18 });
            door(ctx, 'left', a, b, 0.22, 0.1, 11, color, { ...o, arch: true, frame: gold });
            // A montra, com as joias à mostra.
            windows(ctx, 'left', a, b, 0.64, 0.24, 4, 12.5, { ...o, glass: '#bfe0ec', frame: gold, both: false });
            windows(ctx, 'right', a, b, 0.5, 0.09, 8, 14, { ...o, shutter: color, frame: gold });
            tiledPyramid(ctx, a, b, 19.2, 13, color, o);
            // O remate dourado no bico do telhado.
            const [x, y] = P(o.ox, o.oy, 32.2);
            ctx.fillStyle = gold;
            ctx.fillRect(x - 0.6, y - 4, 1.2, 4);
            ctx.beginPath();
            ctx.arc(x, y - 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff4c2';
            ctx.beginPath();
            ctx.arc(x - 0.6, y - 5.6, 0.7, 0, Math.PI * 2);
            ctx.fill();
        }],
        // Um arbusto aparado em vaso de pedra, à porta.
        [0.3, 0.3, () => {
            cylinder(ctx, 3, 4, '#cfc6b3', { ox: 0.3, oy: 0.3 });
            const [x, y] = P(0.3, 0.3, 4);
            ctx.fillStyle = '#3f8a45';
            ctx.beginPath();
            ctx.arc(x, y - 3, 3.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#5aa54a';
            ctx.beginPath();
            ctx.arc(x - 1, y - 4, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }]
    ]);
    // A tabuleta com o anel, na esquina da fachada — quando a fachada está à esquerda.
    if (faceOf(0, 1) !== 'left') return;
    const [x, y] = P(o.ox - a / 2, o.oy + b / 2, 16);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(x - 9, y - 2, 9, 1.5);
    ctx.fillStyle = color;
    ctx.fillRect(x - 9, y, 7, 6.5);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(x - 5.5, y + 4, 1.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#7fd3f0';
    poly(ctx, [[x - 5.5, y + 0.6], [x - 4.3, y + 1.6], [x - 5.5, y + 2.6], [x - 6.7, y + 1.6]], '#7fd3f0');
}

// ---------- Castelos ----------

/**
 * O portão do castelo, desenhado na face `wall` (ver `houseFace`): o arco de
 * pedra com as aduelas e o portão de tábuas com as ferragens seguem a parede,
 * na perspetiva dela. `u` e `hw` em frações da largura da face.
 */
function castleGate(ctx, wall, u, hw, jamb, rise, boards) {
    const e = hw * 0.35;
    // O contorno do arco, `grow` mais largo e `lift` mais alto que o vão.
    const arch = (grow, lift) => {
        ctx.beginPath();
        ctx.moveTo(...wall.at(u - hw - grow, 0));
        ctx.lineTo(...wall.at(u - hw - grow, jamb));
        ctx.quadraticCurveTo(...wall.at(u, jamb + 2 * (rise + lift)), ...wall.at(u + hw + grow, jamb));
        ctx.lineTo(...wall.at(u + hw + grow, 0));
        ctx.closePath();
    };
    arch(e, 2.2);
    ctx.fillStyle = shade('#d9d0bd', wall.tone);
    ctx.fill();
    // As aduelas: juntas do arco de pedra, e as das ombreiras.
    const onArch = (t, grow, lift) => {
        const x0 = u - hw - grow;
        const x1 = u + hw + grow;
        const zc = jamb + 2 * (rise + lift);
        return wall.at((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * u + t * t * x1, (1 - t) * (1 - t) * jamb + 2 * (1 - t) * t * zc + t * t * jamb);
    };
    ctx.strokeStyle = shade('#a39a8a', wall.tone);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
        ctx.moveTo(...onArch(t, 0, 0));
        ctx.lineTo(...onArch(t, e, 2.2));
    }
    for (const z of [jamb * 0.33, jamb * 0.67]) {
        ctx.moveTo(...wall.at(u - hw - e, z));
        ctx.lineTo(...wall.at(u - hw, z));
        ctx.moveTo(...wall.at(u + hw, z));
        ctx.lineTo(...wall.at(u + hw + e, z));
    }
    ctx.stroke();
    // O portão de tábuas, com as ferragens ao longo da parede.
    arch(0, 0);
    ctx.fillStyle = shade('#6b4a2b', wall.tone);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let k = 1; k < boards; k++) {
        const uu = u - hw + (2 * hw * k) / boards;
        faceLine(ctx, wall, uu, 0, uu, jamb + rise, '#4a3020', k === boards / 2 ? 1 : 0.6);
    }
    for (const z of [jamb * 0.3, jamb * 0.75]) faceLine(ctx, wall, u - hw, z, u + hw, z, '#2f2b28', 1.2);
    for (const du of [-0.18, 0.18]) {
        const [x, y] = wall.at(u + hw * du, jamb * 0.5);
        ctx.fillStyle = '#2f2b28';
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}


/**
 * As medidas do castelo em cada nível: a muralha, as torres dos cantos e os
 * pisos do edifício central (lado, altura), que é o que cresce com o nível —
 * um piso no 1, dois no 2, três do 3 em diante. `top` é a altura do cimo do
 * telhado, onde `castleLive` põe a bandeira.
 */
function castleSpec(level) {
    const floors = [[0.82, 26], [0.6, 22], [0.4, 18]].slice(0, Math.min(3, level));
    const rises = [14, 11];
    const tiers = [];
    let z = 0;
    floors.forEach(([a, h], i) => {
        const last = i === floors.length - 1;
        // O telhado de cada piso de baixo é uma saia de quatro águas; o piso de
        // cima assenta nela, à altura a que a saia passa pela parede dele.
        const rise = last ? 24 + level : rises[i];
        tiers.push({ a, h, z, rise, last });
        if (!last) z += h + rise * (1 - floors[i + 1][0] / a);
    });
    const top = tiers[tiers.length - 1];
    return {
        span: 1.62,
        wallH: 13 + level,
        towerH: 22 + level * 1.5,
        tiers,
        top: top.z + top.h + top.rise
    };
}

/** Um estandarte azul com a coroa dourada, pendurado numa face (ver `houseFace`). */
function banner(ctx, f, u, z1, w = 0.07) {
    if (!f) return;
    const hw = w / f.w / 2;
    const z0 = z1 - 9;
    poly(ctx, [f.at(u - hw, z1), f.at(u + hw, z1), f.at(u + hw, z0 + 1.5), f.at(u, z0), f.at(u - hw, z0 + 1.5)], shade('#2f4f9a', f.tone));
    faceLine(ctx, f, u - hw * 1.2, z1, u + hw * 1.2, z1, '#c9a13a', 1);
    const [x, y] = f.at(u, z1 - 4.2);
    ctx.fillStyle = shade('#e8c252', f.tone);
    ctx.beginPath();
    ctx.moveTo(x - 1.6, y + 1.2);
    ctx.lineTo(x - 1.6, y - 1);
    ctx.lineTo(x - 0.8, y);
    ctx.lineTo(x, y - 1.4);
    ctx.lineTo(x + 0.8, y);
    ctx.lineTo(x + 1.6, y - 1);
    ctx.lineTo(x + 1.6, y + 1.2);
    ctx.closePath();
    ctx.fill();
}

/** Ameias ao longo de uma aresta, de (ax, ay) a (bx, by) na grelha da peça, à altura z. */
function merlons(ctx, ax, ay, bx, by, z, color, n) {
    const along = Math.abs(bx - ax) > Math.abs(by - ay);
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const ox = ax + (bx - ax) * t;
        const oy = ay + (by - ay) * t;
        box(ctx, along ? 0.06 : 0.07, along ? 0.07 : 0.06, 3.2, color, { ox, oy, z });
    }
}

/** Um pináculo dourado: a haste e a bola, no ponto de ecrã (x, y). */
function finial(ctx, x, y, h = 7, gold = '#d9a63a') {
    ctx.strokeStyle = shade(gold, -0.25);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(x, y - h * 0.55, 1.3, 0, Math.PI * 2);
    ctx.fill();
}

function castle(ctx, { level = 1 }) {
    const { span, wallH, towerH, tiers } = castleSpec(level);
    const c = span / 2 - 0.02;
    const t = 0.1;
    const inner = c - t / 2;
    const gold = level >= 5;

    // O pátio, por dentro da muralha.
    diamond(ctx, span - 0.1, span - 0.1, 0, '#b9ae98');
    diamond(ctx, span - 0.3, span - 0.3, 0.2, '#c4b9a2');

    /** Um lano da muralha: a parede grossa com o adarve, as ameias do lado de fora, os estandartes e (na +y) o portão. */
    const wallSide = (nx, ny) => () => {
        const along = ny !== 0;
        const len = span - 0.2;
        const [ox, oy] = [nx * inner, ny * inner];
        const [a, b] = along ? [len, t] : [t, len];
        walls(ctx, a, b, wallH, STONE, { ox, oy, tex: 'bigstone', top: '#a89d88', seed: 80 + nx * 3 + ny });
        const [ex, ey] = along ? [len / 2, 0] : [0, len / 2];
        const out = 0.03;
        merlons(ctx, ox - ex + nx * out, oy - ey + ny * out, ox + ex + nx * out, oy + ey + ny * out, wallH, STONE, 8);
        const face = houseFace(nx, ny, a, b, ox, oy);
        if (!face) return;
        for (const u of ny === 1 ? [0.18, 0.82] : [0.3, 0.7]) banner(ctx, face, u, wallH - 2);
        if (nx === 0 && ny === 1) {
            // A casa da guarda: um corpo mais alto a meio da muralha, com o portão.
            const gw = 0.34;
            walls(ctx, gw, t + 0.08, wallH + 5, STONE, { ox: 0, oy: oy + 0.02, tex: 'bigstone', top: '#a89d88', seed: 97 });
            merlons(ctx, -gw / 2, oy + 0.09, gw / 2, oy + 0.09, wallH + 5, STONE, 4);
            const gf = houseFace(0, 1, gw, t + 0.08, 0, oy + 0.02);
            if (gf) {
                castleGate(ctx, gf, 0.5, 0.26, 11, 6, 8);
                windows(ctx, 'left', gw, t + 0.08, 0.5, 0.05, wallH - 1, wallH + 3, { ox: 0, oy: oy + 0.02, both: false });
            }
        }
    };

    /** Uma torre redonda do canto, com o telhado cónico e o pináculo. */
    const corner = (sx, sy) => () => {
        stoneTower(ctx, 11, towerH, STONE, { ox: sx * c, oy: sy * c });
        // O parapeito, mais largo, por baixo do telhado.
        const top = cylinder(ctx, 12.5, 3, '#cfc6b3', { ox: sx * c, oy: sy * c, z: towerH - 3 });
        tiledCone(ctx, top.x, top.y, 13, 20, CASTLE_ROOF);
        finial(ctx, top.x, top.y - 20, 6, gold ? '#e9b94a' : '#c9a13a');
    };

    /** O edifício central: os pisos de baixo para cima, cada um com a saia de telhado. */
    const keepBody = () => {
        tiers.forEach((tier, i) => {
            const { a, h, z, rise, last } = tier;
            walls(ctx, a, a, h, '#ddd4c2', { z, tex: 'stone', seed: 60 + i });
            // Uma cornija de pedra mais clara no cimo de cada piso.
            walls(ctx, a + 0.03, a + 0.03, 1.4, '#e8e0cf', { z: z + h - 1.4, tex: 'plaster', seed: 64 + i });
            const n = i === 0 ? [0.25, 0.75] : [0.5];
            for (const u of n) {
                for (const side of ['left', 'right']) {
                    windows(ctx, side, a, a, u, 0.05, z + h * 0.35, z + h * 0.72, { lintel: '#e8e0cf', frame: '#e8e0cf' });
                }
            }
            if (i === 0) door(ctx, 'left', a, a, 0.5, 0.11, 11, '#5d4028', { arch: true, frame: '#e8e0cf' });
            const roof = last && gold ? '#d9a63a' : CASTLE_ROOF;
            tiledPyramid(ctx, a, a, z + h, rise, roof, { over: 0.035, seed: 7 + i });
            if (last) {
                const [x, y] = P(0, 0, z + h + rise);
                finial(ctx, x, y, 10, gold ? '#f0c64e' : '#c9a13a');
            }
        });
    };

    /** A partir do nível 4, torreões nos cantos do piso de baixo, a subir acima da saia. */
    const turret = (sx, sy) => () => {
        const a0 = tiers[0].a / 2;
        const h = tiers[0].h + 12;
        const top = stoneTower(ctx, 4.5, h, '#ddd4c2', { ox: sx * a0, oy: sy * a0 });
        tiledCone(ctx, top.x, top.y, 5.5, 12, gold ? '#d9a63a' : CASTLE_ROOF);
        finial(ctx, top.x, top.y - 12, 4, '#c9a13a');
    };

    // Tudo de trás para a frente na vista: as peças da muralha e das torres por
    // profundidade, o edifício central com os torreões à volta dele.
    const parts = [
        [-c, -c, corner(-1, -1)], [c, -c, corner(1, -1)], [c, c, corner(1, 1)], [-c, c, corner(-1, 1)],
        [0, -inner, wallSide(0, -1)], [inner, 0, wallSide(1, 0)], [0, inner, wallSide(0, 1)], [-inner, 0, wallSide(-1, 0)]
    ];
    const keepParts = [[0, 0, keepBody]];
    if (level >= 4) {
        const a0 = tiers[0].a / 2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) keepParts.push([sx * a0 * 1.02, sy * a0 * 1.02, turret(sx, sy)]);
    }
    // As torres dos cantos dos lados (à mesma profundidade que o centro) ficam
    // atrás do edifício; as muralhas da frente, à frente dele.
    const order = parts.map((p) => ({ d: depth(p[0], p[1]) + (p[0] && p[1] ? 0 : 0.001), draw: p[2] }));
    order.push(...keepParts.map((p) => ({ d: depth(p[0], p[1]) * 0.25 + 0.0005, draw: p[2] })));
    order.sort((p, q) => p.d - q.d);
    for (const p of order) p.draw();
}

function keep(ctx, { roof = '#d8587b' }) {
    walls(ctx, 0.84, 0.84, 9, STONE, { top: '#bdb3a0', tex: 'bigstone' });
    crenels(ctx, 0.84, 0.84, 9, STONE, { n: 3 });
    layered([
        [-0.05, -0.05, () => {
            const t = stoneTower(ctx, 13, 46, '#ddd4c2', { ox: -0.05, oy: -0.05 });
            tiledCone(ctx, t.x, t.y, 15, 26, roof);
        }],
        [0.28, 0.28, () => {
            const s = stoneTower(ctx, 8, 30, STONE, { ox: 0.28, oy: 0.28 });
            tiledCone(ctx, s.x, s.y, 10, 16, roof);
        }]
    ]);
}

/** Um peixe pendurado (ou no balde): um fuso prateado com a cauda. */
function hangingFish(ctx, x, y, color = '#a9b8c4') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 1.4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [[x, y + 5.5], [x - 1.6, y + 7.6], [x + 1.6, y + 7.6]], shade(color, -0.2));
}

/**
 * O cais: tábuas que saem do bloco pelo lado `side` (0: +x, 1: -x, 2: +y,
 * 3: -y, na grelha da peça) até à água, `reach` casas mais à frente, com as
 * estacas a espreitar. É lá que os barcos atracam (ver boats.js).
 */
const SIDE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pier(ctx, side, reach) {
    const [sx, sy] = SIDE_DIRS[side];
    // Uma casa é meio bloco: o cais passa por cima da terra que houver e entra
    // dois terços de casa na água.
    const len = reach * 0.5 - 0.17;
    const cx = sx * (0.5 + len / 2 - 0.08);
    const cy = sy * (0.5 + len / 2 - 0.08);
    const a = sx ? len + 0.16 : 0.18;
    const b = sy ? len + 0.16 : 0.18;
    // As estacas: da água até às tábuas.
    for (const k of reach > 1 ? [0.3, 0.62, 0.95] : [0.3, 0.95]) {
        for (const w of [-1, 1]) {
            const px = sx * (0.5 + len * k - 0.08) + (sx ? 0 : w * 0.08);
            const py = sy * (0.5 + len * k - 0.08) + (sy ? 0 : w * 0.08);
            box(ctx, 0.025, 0.025, 6, '#5a3d24', { ox: px, oy: py, z: -3 });
        }
    }
    box(ctx, a, b, 1.6, '#b58a57', { ox: cx, oy: cy, z: 2.4, top: '#c99d66' });
}

/**
 * Onde fica cada coisa da cabana de pesca, conforme o lado da água: a cabana
 * de costas para o lago, o cais para ele, o resto ao longo da margem.
 * `variant` é `side + 4 * reach` de `shoreSide` (world.js); abaixo de 4 não
 * há água à beira e não há cais.
 */
function fisheryLayout(variant) {
    const side = variant % 4;
    const reach = Math.floor(variant / 4);
    const [sx, sy] = SIDE_DIRS[side];
    // Perpendicular ao cais.
    const [qx, qy] = [-sy, sx];
    const at = (along, across) => ({ ox: sx * along + qx * across, oy: sy * along + qy * across });
    return {
        side, reach, sx, sy, qx, qy,
        hut: at(-0.14, -0.08),
        rack: at(0.2, 0.24),
        barrel: at(0.26, -0.26),
        net: at(-0.3, 0.3)
    };
}

function fishery(ctx, { roof = '#4f6f8f', variant = 0 }) {
    const { side, reach, sx, sy, qx, qy, hut, rack, barrel, net } = fisheryLayout(variant);
    const color = roof === PLAYER_ROOF ? '#4f6f8f' : roof;
    const plank = '#8d6a45';
    const parts = [
        [hut.ox, hut.oy, () => {
            walls(ctx, 0.44, 0.4, 13, plank, { ...hut, tex: 'planks' });
            door(ctx, 'left', 0.44, 0.4, 0.62, 0.1, 9, DOOR, hut);
            windows(ctx, 'right', 0.44, 0.4, 0.5, 0.08, 6.5, 10.5, { ...hut, shutter: color });
            tiledRoof(ctx, 0.44, 0.4, 13, 11, color, plank, { ...hut, alongX: sx !== 0 });
        }],
        // O estendal do peixe a secar: duas estacas, uma vara e o peixe pendurado.
        [rack.ox, rack.oy, () => {
            const a = P(rack.ox - qx * 0.12, rack.oy - qy * 0.12);
            const b = P(rack.ox + qx * 0.12, rack.oy + qy * 0.12);
            ctx.strokeStyle = '#6b4a2b';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(a[0], a[1] - 13);
            ctx.lineTo(b[0], b[1] - 13);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
            for (let k = 1; k <= 3; k++) {
                const u = k / 4;
                hangingFish(ctx, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - 12, k === 2 ? '#c7a26a' : '#a9b8c4');
            }
        }],
        // Barrica do peixe salgado.
        [barrel.ox, barrel.oy, () => {
            const top = cylinder(ctx, 4, 6, '#8a5a30', barrel);
            ctx.fillStyle = '#c9d4dc';
            ctx.beginPath();
            ctx.ellipse(top.x, top.y, 3, 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
        }],
        // Uma rede estendida no chão, a secar.
        [net.ox, net.oy, () => {
            const [x, y] = P(net.ox, net.oy);
            ctx.strokeStyle = 'rgba(80, 64, 44, 0.75)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            for (let k = -2; k <= 2; k++) {
                ctx.moveTo(x - 8 + k * 2, y - 2 - k);
                ctx.lineTo(x + 2 + k * 2, y + 3 - k);
                ctx.moveTo(x - 7 + k * 2.2, y + 2 + k * 0.4);
                ctx.lineTo(x + 3 + k * 2.2, y - 3 + k * 0.4);
            }
            ctx.stroke();
        }]
    ];
    if (reach) parts.push([sx * 0.75, sy * 0.75, () => pier(ctx, side, reach)]);
    layered(parts);
}

// ---------- Tabelas ----------

export const STATIC = {
    tree,
    rock,
    ore,
    mountain,
    field,
    house,
    market,
    woodcutter,
    quarry,
    forester,
    mill: millStatic,
    bakery,
    pasture,
    pigsty,
    carpentry,
    barn,
    dairy,
    goldmine,
    fishery,
    sheepfold,
    weaving,
    vineyard,
    distillery,
    tavern,
    cottonfield,
    tailor,
    theatre,
    coop,
    canefield,
    paddy,
    sugarmill,
    patisserie,
    inn,
    jewelry,
    castle,
    keep
};

// ---------- Partes vivas ----------

/** As pás ficam sempre do mesmo lado do ecrã: um moinho vira-se para o vento, não para o mapa. */
function millBlades(ctx, b, t) {
    const working = b.owner !== 'player' || b.status === 'ok';
    const angle = (working ? t * 1.6 : 0.3) + (b.x * 7 + b.y * 3);
    const hubX = 6;
    const hubY = -32;
    ctx.save();
    ctx.translate(hubX, hubY);
    ctx.scale(0.72, 1);
    for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(angle + (i * Math.PI) / 2);
        ctx.fillStyle = '#6b4a2b';
        ctx.fillRect(-1, 0, 2, 26);
        ctx.fillStyle = 'rgba(244, 236, 214, 0.95)';
        ctx.fillRect(1, 6, 7, 19);
        ctx.strokeStyle = 'rgba(107, 74, 43, 0.6)';
        ctx.lineWidth = 0.8;
        for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.moveTo(1, 8 + k * 4.5);
            ctx.lineTo(8, 8 + k * 4.5);
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.fillStyle = '#4a3020';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function smoke(ctx, x, y, t, seed = 0) {
    for (let i = 0; i < 4; i++) {
        const phase = (t * 0.5 + i / 4 + seed) % 1;
        const r = 3 + phase * 7;
        ctx.fillStyle = `rgba(235, 235, 235, ${0.55 * (1 - phase)})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin((phase + seed) * 6) * 4 + phase * 8, y - phase * 30, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function bakeryLive(ctx, b, t) {
    const working = b.owner !== 'player' || b.status === 'ok';
    if (!working) return;
    const [x, y] = P(0.18, -0.1, 36);
    smoke(ctx, x, y, t, b.x * 0.13);
}

function chimneyLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const [x, y] = P(0.2, -0.2, 36);
    smoke(ctx, x, y, t, b.y * 0.17);
}

function houseLive(ctx, b, t, { variant = 0 }) {
    // O fumo sai da chaminé do estilo da casa (ver `house`); há estilos sem chaminé.
    const chim = HOUSE_CHIMNEY[variant % 6];
    if (!chim) return;
    const [cx, cy] = houseFrame(Math.floor(variant / 6) % 2 === 0).off(chim.u, chim.v);
    const [x, y] = P(cx, cy, chim.top + 3);
    smoke(ctx, x, y, t * 0.7, b.x * 0.21);
}

function cow(ctx, x, y, flip, spots) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillStyle = 'rgba(20, 40, 10, 0.2)';
    ctx.beginPath();
    ctx.ellipse(1, 1, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(-5, -4, 1.6, 4);
    ctx.fillRect(3, -4, 1.6, 4);
    ctx.fillStyle = '#f6f2ea';
    ctx.beginPath();
    ctx.ellipse(0, -7, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spots;
    ctx.beginPath();
    ctx.arc(-2, -8, 2.2, 0, Math.PI * 2);
    ctx.arc(3, -6.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f2ea';
    ctx.beginPath();
    ctx.ellipse(7.5, -9, 3, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a8a0';
    ctx.fillRect(9, -9, 2, 2);
    ctx.restore();
}

function pastureLive(ctx, b, t) {
    const seed = b.x * 3.1 + b.y * 1.7;
    for (let i = 0; i < 2; i++) {
        const s = t * 0.25 + seed + i * 2.4;
        const gx = Math.sin(s) * 0.2 + (i ? 0.1 : -0.05);
        const gy = Math.cos(s * 0.8) * 0.15 + (i ? 0.18 : 0.02);
        const [x, y] = P(gx, gy);
        cow(ctx, x, y, Math.cos(s) > 0, i ? '#2d2520' : '#6b4a2b');
    }
}

/** Um porco cor-de-rosa, gordo, com o focinho e o rabo enrolado. */
function pig(ctx, x, y, flip, muddy) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillStyle = 'rgba(20, 40, 10, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9848a';
    ctx.fillRect(-4, -3, 1.5, 3);
    ctx.fillRect(2.5, -3, 1.5, 3);
    ctx.fillStyle = '#f0a8ae';
    ctx.beginPath();
    ctx.ellipse(0, -5.5, 6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (muddy) {
        ctx.fillStyle = 'rgba(106, 76, 48, 0.75)';
        ctx.beginPath();
        ctx.ellipse(-2, -4, 2.6, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#f0a8ae';
    ctx.beginPath();
    ctx.arc(5.8, -6.4, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9848c';
    ctx.beginPath();
    ctx.ellipse(8.2, -6, 1.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [[4.2, -8.6], [5.6, -11], [6.6, -8.4]], '#d9848c');
    ctx.strokeStyle = '#d9848c';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(-6.6, -6.6, 1.3, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
}

function pigstyLive(ctx, b, t) {
    const seed = b.x * 1.9 + b.y * 2.7;
    for (let i = 0; i < 3; i++) {
        const s = t * 0.2 + seed + i * 2.2;
        const gx = Math.sin(s) * 0.14 + [0.12, -0.12, 0.2][i];
        const gy = Math.cos(s * 0.8) * 0.1 + [0.14, 0.12, 0.3][i];
        const [x, y] = P(gx, gy);
        pig(ctx, x, y, Math.cos(s) > 0, i !== 1);
    }
}

/** Uma galinha: corpo branco ou castanho, crista vermelha, a debicar de vez em quando. */
function hen(ctx, x, y, flip, color, peck) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillStyle = 'rgba(20, 40, 10, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 3.6, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0a030';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-0.8, -2);
    ctx.lineTo(-0.8, 0);
    ctx.moveTo(0.8, -2);
    ctx.lineTo(0.8, 0);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, -3.6, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [[-2.6, -4.4], [-4.4, -6.6], [-3.2, -3.2]], shade(color, -0.1));
    const hy = peck ? -2.4 : -5.8;
    const hx = peck ? 3.6 : 2.6;
    ctx.beginPath();
    ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d63a2e';
    ctx.fillRect(hx - 0.6, hy - 2.4, 1.2, 1.2);
    ctx.fillStyle = '#e0a030';
    poly(ctx, [[hx + 1.2, hy - 0.4], [hx + 2.6, hy + 0.2], [hx + 1.2, hy + 0.6]], '#e0a030');
    ctx.restore();
}

function coopLive(ctx, b, t) {
    const seed = b.x * 2.9 + b.y * 1.3;
    const colors = ['#f6f2ea', '#b86a32', '#f6f2ea', '#8a4a22'];
    for (let i = 0; i < 4; i++) {
        const s = t * 0.35 + seed + i * 1.7;
        const gx = Math.sin(s) * 0.16 + [0.05, 0.2, -0.05, 0.15][i];
        const gy = Math.cos(s * 0.9) * 0.1 + [0.1, 0.05, 0.28, 0.25][i];
        const [x, y] = P(gx, gy);
        hen(ctx, x, y, Math.cos(s) > 0, colors[i], Math.sin(t * 3 + i * 2.3 + seed) > 0.6);
    }
}

function sugarmillLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const [x, y] = P(0.3, -0.26, 42);
    smoke(ctx, x, y, t * 0.7, b.x * 0.31);
}

function patisserieLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const [x, y] = P(0.1, -0.2, 36);
    smoke(ctx, x, y, t * 0.5, b.y * 0.37);
}

function innLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const [x, y] = P(0.14, -0.2, 46);
    smoke(ctx, x, y, t * 0.5, b.x * 0.41);
}

/** O remate dourado da joalharia a cintilar, enquanto os ourives trabalham. */
function jewelryLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const phase = (t * 0.7 + b.x * 0.13 + b.y * 0.07) % 1;
    if (phase > 0.4) return;
    const k = Math.sin((phase / 0.4) * Math.PI);
    const [x, y] = P(-0.06, -0.1, 32.2);
    ctx.strokeStyle = `rgba(255, 248, 210, ${k})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 5 * k, y - 5);
    ctx.lineTo(x + 5 * k, y - 5);
    ctx.moveTo(x, y - 5 - 5 * k);
    ctx.lineTo(x, y - 5 + 5 * k);
    ctx.stroke();
}

function flag(ctx, x, y, t, color, h = 16) {
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        ctx.lineTo(x + u * 13, y - h + Math.sin(t * 5 + u * 4) * 1.6 * u);
    }
    for (let i = 6; i >= 0; i--) {
        const u = i / 6;
        ctx.lineTo(x + u * 13, y - h + 7 + Math.sin(t * 5 + u * 4) * 1.6 * u);
    }
    ctx.closePath();
    ctx.fill();
}

function castleLive(ctx, b, t, { level = 1 }) {
    // A bandeira no pináculo do edifício central, e flâmulas nas duas torres
    // dos cantos dos lados da vista (as da frente e de trás ficam alinhadas
    // com o pináculo, e as flâmulas amontoavam-se lá).
    const { span, towerH, top } = castleSpec(level);
    const [x, y] = P(0, 0, top + 9);
    flag(ctx, x, y, t, level >= 4 ? '#f2c14e' : '#c8553d', 16);
    const c = span / 2 - 0.02;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        if (Math.abs(depth(sx, sy)) > 0.5) continue;
        const [fx, fy] = P(sx * c, sy * c, towerH + 25);
        flag(ctx, fx, fy, t + sx * 0.7 + sy * 0.3, '#2f4f9a', 7);
    }
}

function keepLive(ctx, b, t) {
    const [x, y] = P(-0.05, -0.05, 46 + 24);
    flag(ctx, x, y, t, b.roof || '#fff', 14);
}

function oreLive(ctx, b, t, { seed = 0 }) {
    const phase = (t * 0.6 + seed) % 1;
    if (phase > 0.35) return;
    const k = Math.sin((phase / 0.35) * Math.PI);
    const x = -7 + (seed * 37) % 16;
    const y = -8 - (seed * 53) % 6;
    ctx.strokeStyle = `rgba(255, 244, 190, ${k})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 4 * k, y);
    ctx.lineTo(x + 4 * k, y);
    ctx.moveTo(x, y - 4 * k);
    ctx.lineTo(x, y + 4 * k);
    ctx.stroke();
}

/** Fumo do fumeiro da cabana de pesca, quando os pescadores estão a trabalhar. */
function fisheryLive(ctx, b, t, { variant = 0 }) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const { hut } = fisheryLayout(variant);
    const [x, y] = P(hut.ox, hut.oy, 26);
    smoke(ctx, x, y, t * 0.6, b.x * 0.19);
}

/** Uma ovelha: um novelo de lã com cabeça e patas escuras. */
function sheep(ctx, x, y, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillStyle = 'rgba(20, 40, 10, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d2520';
    ctx.fillRect(-3.5, -3, 1.3, 3);
    ctx.fillRect(2.2, -3, 1.3, 3);
    ctx.fillStyle = '#f4f0e6';
    for (const [dx, dy, r] of [[-2.5, -5.5, 3], [1, -6.2, 3.2], [3, -5, 2.6], [-0.5, -4.2, 3]]) {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#3a302a';
    ctx.beginPath();
    ctx.ellipse(6, -6.5, 1.8, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function sheepfoldLive(ctx, b, t) {
    const seed = b.x * 2.3 + b.y * 1.1;
    for (let i = 0; i < 3; i++) {
        const s = t * 0.22 + seed + i * 2.1;
        const gx = Math.sin(s) * 0.18 + [-0.1, 0.15, 0.05][i];
        const gy = Math.cos(s * 0.7) * 0.12 + [0.05, 0.12, 0.28][i];
        const [x, y] = P(gx, gy);
        sheep(ctx, x, y, Math.cos(s) > 0);
    }
}

/** A roupa de lã tingida a secar num estendal ao lado da tecelagem, a abanar com o vento. */
function weavingLive(ctx, b, t) {
    const [ax, ay] = P(-0.42, 0.44);
    const [bx, by] = P(-0.42, 0.18);
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, ay - 16);
    ctx.lineTo(bx, by - 16);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const colors = ['#c0504d', '#e0c068', '#4f7fb8'];
    for (let k = 0; k < 3; k++) {
        const u = (k + 0.5) / 3;
        const x = ax + (bx - ax) * u;
        const y = ay + (by - ay) * u - 16;
        const sway = Math.sin(t * 3 + k + b.x) * 1.4;
        poly(ctx, [[x - 2.6, y], [x + 2.6, y - 1.3], [x + 2.6 + sway, y + 7], [x - 2.6 + sway, y + 8.3]], colors[k]);
    }
}

function distilleryLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const [x, y] = P(0.3, -0.12, 16);
    smoke(ctx, x, y, t * 0.8, b.y * 0.23);
}

function tavernLive(ctx, b, t) {
    if (b.owner === 'player' && b.status !== 'ok') return;
    const [x, y] = P(0.14, -0.18, 40);
    smoke(ctx, x, y, t * 0.6, b.x * 0.29);
}

function theatreLive(ctx, b, t) {
    const [x, y] = P(-0.08, -0.08, 45);
    flag(ctx, x, y, t, b.owner === 'player' && b.status !== 'ok' ? '#9a9a9a' : '#f2c14e', 14);
}

export const LIVE = {
    mill: millBlades,
    fishery: fisheryLive,
    bakery: bakeryLive,
    carpentry: chimneyLive,
    house: houseLive,
    pasture: pastureLive,
    pigsty: pigstyLive,
    coop: coopLive,
    sugarmill: sugarmillLive,
    patisserie: patisserieLive,
    inn: innLive,
    jewelry: jewelryLive,
    sheepfold: sheepfoldLive,
    weaving: weavingLive,
    distillery: distilleryLive,
    tavern: tavernLive,
    theatre: theatreLive,
    castle: castleLive,
    keep: keepLive,
    ore: oreLive
};
