// Os desenhos do reino: árvores, rochas, campos, casas, oficinas e castelos.
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
    P, box, cone, crenels, cylinder, depth, diamond, faceOf, gable, groundShadow, layered, poly, pyramid, shade,
    unturned, wallPatch
} from './draw.js';

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
    field: [-34, -30, 68, 50],
    castle: [-86, -196, 172, 250],
    keep: [-40, -126, 80, 152],
    mill: [-40, -110, 80, 136],
    // O cais pode sair até três casas para fora do bloco.
    fishery: [-66, -96, 132, 138]
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

// ---------- Casas e oficinas ----------

function house(ctx, { roof = PLAYER_ROOF, variant = 0 }) {
    groundShadow(ctx, 26, 10, 0.2, 6, 4);
    const along = variant % 2 === 0;
    const a = along ? 0.6 : 0.5;
    const b = along ? 0.46 : 0.58;
    box(ctx, a, b, 20, WALL);
    // Enxaimel: vigas escuras nas faces.
    for (const u of [0.02, 0.98]) wallPatch(ctx, 'left', a, b, u, 0.03, 0, 20, TIMBER);
    wallPatch(ctx, 'left', a, b, 0.5, a, 18.5, 20, TIMBER);
    wallPatch(ctx, 'left', a, b, 0.3, 0.1, 0, 11, DOOR);
    wallPatch(ctx, 'left', a, b, 0.72, 0.1, 8, 14, WINDOW);
    wallPatch(ctx, 'right', a, b, 0.5, 0.12, 8, 14, shade(WINDOW, -0.2));
    gable(ctx, a, b, 20, 15, roof, WALL, { alongX: along });
    if (variant % 3 === 0) box(ctx, 0.07, 0.07, 10, '#8f877a', { ox: a / 4, oy: -b / 6, z: 26 });
}

function market(ctx, { roof = PLAYER_ROOF }) {
    diamond(ctx, 0.94, 0.94, 0, '#c9b99a');
    diamond(ctx, 0.86, 0.86, 0.5, '#d8c9a8');
    const stall = (s) => {
        box(ctx, 0.3, 0.22, 7, WOOD, { ox: s.ox, oy: s.oy });
        for (const [px, py] of [[-0.14, -0.1], [0.14, -0.1], [0.14, 0.1], [-0.14, 0.1]]) {
            box(ctx, 0.025, 0.025, 15, TIMBER, { ox: s.ox + px, oy: s.oy + py, z: 7 });
        }
        gable(ctx, 0.32, 0.26, 20, 6, s.c, s.c, { ox: s.ox, oy: s.oy, over: 0.02 });
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

function logPile(ctx, ox, oy) {
    const [x, y] = P(ox, oy);
    for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 3 - row; k++) {
            const cx = x - 6 + k * 6 + row * 3;
            const cy = y - 3 - row * 5;
            ctx.fillStyle = '#8a5a30';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d9b27a';
            ctx.beginPath();
            ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function woodcutter(ctx, { roof = '#6f4a2e' }) {
    groundShadow(ctx, 24, 10, 0.2, 6, 4);
    layered([
        [-0.1, -0.08, () => {
            box(ctx, 0.46, 0.4, 15, '#a57447', { ox: -0.1, oy: -0.08 });
            wallPatch(ctx, 'left', 0.46, 0.4, 0.5, 0.1, 0, 9, DOOR, { ox: -0.1, oy: -0.08 });
            gable(ctx, 0.46, 0.4, 15, 12, roof === PLAYER_ROOF ? '#6f4a2e' : roof, '#a57447', { ox: -0.1, oy: -0.08 });
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
    groundShadow(ctx, 20, 9, 0.18, 5, 3);
    layered([
        [-0.1, -0.12, () => {
            box(ctx, 0.4, 0.36, 13, '#b48a5a', { ox: -0.1, oy: -0.12 });
            wallPatch(ctx, 'left', 0.4, 0.36, 0.5, 0.1, 0, 8, DOOR, { ox: -0.1, oy: -0.12 });
            gable(ctx, 0.4, 0.36, 13, 11, roof === PLAYER_ROOF ? '#4f7d3a' : roof, '#b48a5a', { ox: -0.1, oy: -0.12, alongX: false });
        }],
        [0.25, 0.1, () => sapling(ctx, 0.25, 0.1, 0.8)],
        [0.05, 0.3, () => sapling(ctx, 0.05, 0.3, 1)],
        [0.3, 0.32, () => sapling(ctx, 0.3, 0.32, 0.7)]
    ]);
}

function millStatic(ctx) {
    groundShadow(ctx, 22, 10, 0.2, 6, 4);
    cylinder(ctx, 13, 12, '#b9b2a3');
    const top = cylinder(ctx, 11, 26, '#d8d0bf', { z: 12 });
    cone(ctx, top.x, top.y, 13, 18, '#7a5234');
    // Porta, se o lado dela estiver virado para quem olha.
    if (!faceOf(0, 1)) return;
    const [x, y] = P(0, 0.2);
    ctx.fillStyle = DOOR;
    ctx.fillRect(x - 3, y - 11, 6, 9);
}

function bakery(ctx, { roof = '#b5652f' }) {
    groundShadow(ctx, 26, 10, 0.2, 6, 4);
    box(ctx, 0.62, 0.48, 18, WALL);
    wallPatch(ctx, 'left', 0.62, 0.48, 0.25, 0.1, 0, 10, DOOR);
    wallPatch(ctx, 'left', 0.62, 0.48, 0.65, 0.2, 6, 12, '#f4c35b');
    wallPatch(ctx, 'right', 0.62, 0.48, 0.5, 0.12, 7, 13, WINDOW);
    gable(ctx, 0.62, 0.48, 18, 14, roof === PLAYER_ROOF ? '#b5652f' : roof, WALL);
    box(ctx, 0.09, 0.09, 16, '#9a8f80', { ox: 0.18, oy: -0.1, z: 18 });
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
            box(ctx, 0.34, 0.26, 12, '#a57447', { ox: -0.22, oy: -0.25 });
            gable(ctx, 0.34, 0.26, 12, 8, roof === PLAYER_ROOF ? '#8a3b2c' : roof, '#a57447', { ox: -0.22, oy: -0.25 });
        }],
        // Manjedoura.
        [0.22, -0.28, () => box(ctx, 0.2, 0.08, 4, '#9a6a3f', { ox: 0.22, oy: -0.28 })]
    ]);
    fence(ctx, 0.88, 'front');
}

function carpentry(ctx, { roof = '#6d5a4a' }) {
    groundShadow(ctx, 30, 11, 0.2, 6, 4);
    layered([
        [0, -0.12, () => {
            box(ctx, 0.72, 0.42, 16, '#b88a5c', { oy: -0.12 });
            wallPatch(ctx, 'left', 0.72, 0.42, 0.3, 0.2, 0, 11, DOOR, { oy: -0.12 });
            wallPatch(ctx, 'left', 0.72, 0.42, 0.75, 0.14, 7, 12, WINDOW, { oy: -0.12 });
            gable(ctx, 0.72, 0.42, 16, 12, roof === PLAYER_ROOF ? '#6d5a4a' : roof, '#b88a5c', { oy: -0.12 });
            box(ctx, 0.08, 0.08, 12, '#8f877a', { ox: 0.2, oy: -0.2, z: 22 });
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
    groundShadow(ctx, 28, 11, 0.2, 6, 4);
    const red = '#a8342d';
    const o = { ox: -0.06, oy: -0.06 };
    layered([
        [o.ox, o.oy, () => {
            box(ctx, 0.56, 0.62, 22, red, o);
            // Portão com a cruz branca.
            wallPatch(ctx, 'left', 0.56, 0.62, 0.5, 0.26, 0, 15, '#f1ebe0', o);
            wallPatch(ctx, 'left', 0.56, 0.62, 0.5, 0.22, 1, 14, shade(red, -0.2), o);
            gable(ctx, 0.56, 0.62, 22, 16, roof === PLAYER_ROOF ? '#5b3a2a' : roof, red, { ...o, alongX: false });
        }],
        [0.32, 0.18, () => hay(ctx, 0.32, 0.18)],
        [0.3, 0.36, () => hay(ctx, 0.3, 0.36)],
        [0.16, 0.36, () => hay(ctx, 0.16, 0.36)]
    ]);
}

function dairy(ctx, { roof = '#5d7fa8' }) {
    groundShadow(ctx, 26, 10, 0.2, 6, 4);
    const white = '#f4f1ea';
    const parts = [[0, 0, () => {
        box(ctx, 0.58, 0.5, 18, white);
        wallPatch(ctx, 'left', 0.58, 0.5, 0.3, 0.1, 0, 10, '#5d7fa8');
        wallPatch(ctx, 'left', 0.58, 0.5, 0.7, 0.12, 7, 13, WINDOW);
        wallPatch(ctx, 'right', 0.58, 0.5, 0.5, 0.12, 7, 13, WINDOW);
        gable(ctx, 0.58, 0.5, 18, 12, roof === PLAYER_ROOF ? '#5d7fa8' : roof, white, { alongX: false });
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
    groundShadow(ctx, 26, 10, 0.2, 5, 3);
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

// ---------- Castelos ----------

function castle(ctx, { level = 1 }) {
    groundShadow(ctx, 70, 30, 0.22, 10, 8);
    const wallH = 14 + level * 3;
    const towerH = 26 + level * 5;
    const keepH = 34 + level * 9;
    const span = 1.62;
    const c = span / 2 - 0.02;

    // As torres dos cantos (e, no nível 4, as do meio das muralhas). As que
    // ficam atrás do centro, na vista, pintam-se antes da muralha.
    const corner = (ox, oy, rise) => [ox, oy, () => {
        const t = cylinder(ctx, 11, towerH, STONE, { ox, oy });
        cone(ctx, t.x, t.y, 13, rise, CASTLE_ROOF);
    }];
    const towers = [corner(-c, c, 22 + level), corner(c, c, 22 + level)];
    if (level >= 2) towers.push(corner(c, -c, 22 + level), corner(-c, -c, 22));
    if (level >= 4) {
        for (const [ox, oy] of [[0, c], [c, 0]]) {
            towers.push([ox, oy, () => {
                const t = cylinder(ctx, 8, towerH - 4, STONE, { ox, oy });
                cone(ctx, t.x, t.y, 10, 16, CASTLE_ROOF);
            }]);
        }
    }
    const behind = towers.filter(([ox, oy]) => depth(ox, oy) < 0);
    layered(behind);

    box(ctx, span, span, wallH, STONE, { top: '#bdb3a0' });
    crenels(ctx, span, span, wallH, STONE, { n: 6 });

    // Pátio: a torre de menagem ao meio, e no nível 3 uma torre alta ao lado
    // dela — atrás, entre as paredes e o telhado, ou à frente, conforme a vista.
    const keepA = 0.62 + level * 0.04;
    const side = level >= 3 ? depth(0.22 + 0.08, -0.34 + 0.08) : 0;
    const sideTower = () => {
        const t = cylinder(ctx, 8, keepH + 10, '#ddd4c2', { ox: 0.22, oy: -0.34 });
        cone(ctx, t.x, t.y, 10, 20, CASTLE_ROOF);
    };
    if (level >= 3 && side < -0.1) sideTower();
    box(ctx, keepA, keepA, keepH, '#ddd4c2', { oy: -0.08, ox: -0.08 });
    wallPatch(ctx, 'left', keepA, keepA, 0.5, 0.1, keepH - 16, keepH - 8, WINDOW, { ox: -0.08, oy: -0.08 });
    wallPatch(ctx, 'right', keepA, keepA, 0.35, 0.1, keepH - 16, keepH - 8, shade(WINDOW, -0.2), { ox: -0.08, oy: -0.08 });
    if (level >= 3 && Math.abs(side) <= 0.1) sideTower();
    pyramid(ctx, keepA, keepA, keepH, 22 + level * 2, KEEP_ROOF, { ox: -0.08, oy: -0.08 });
    if (level >= 3 && side > 0.1) sideTower();

    // Portão na muralha +y (a da frente-esquerda na vista sem rodar).
    if (faceOf(0, 1)) {
        const gate = P(0.1, span / 2 + 0.005);
        ctx.fillStyle = '#3b2a1c';
        ctx.beginPath();
        ctx.moveTo(gate[0] - 9, gate[1] - 4);
        ctx.lineTo(gate[0] - 9, gate[1] - 16);
        ctx.quadraticCurveTo(gate[0], gate[1] - 24, gate[0] + 9, gate[1] - 11);
        ctx.lineTo(gate[0] + 9, gate[1] + 1);
        ctx.closePath();
        ctx.fill();
    }

    layered(towers.filter((t) => !behind.includes(t)));
}

function keep(ctx, { roof = '#d8587b' }) {
    groundShadow(ctx, 30, 12, 0.22, 6, 4);
    box(ctx, 0.84, 0.84, 9, STONE, { top: '#bdb3a0' });
    crenels(ctx, 0.84, 0.84, 9, STONE, { n: 3 });
    layered([
        [-0.05, -0.05, () => {
            const t = cylinder(ctx, 13, 46, '#ddd4c2', { ox: -0.05, oy: -0.05 });
            cone(ctx, t.x, t.y, 15, 26, roof);
        }],
        [0.28, 0.28, () => {
            const s = cylinder(ctx, 8, 30, STONE, { ox: 0.28, oy: 0.28 });
            cone(ctx, s.x, s.y, 10, 16, roof);
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
    groundShadow(ctx, 24, 10, 0.2, 6, 4);
    const parts = [
        [hut.ox, hut.oy, () => {
            box(ctx, 0.44, 0.4, 13, plank, hut);
            // Tábuas ao alto: riscas mais escuras nas paredes.
            for (const u of [0.2, 0.45, 0.8]) wallPatch(ctx, 'left', 0.44, 0.4, u, 0.012, 0, 13, shade(plank, -0.25), hut);
            wallPatch(ctx, 'left', 0.44, 0.4, 0.62, 0.1, 0, 9, DOOR, hut);
            wallPatch(ctx, 'right', 0.44, 0.4, 0.5, 0.1, 6, 10, WINDOW, hut);
            gable(ctx, 0.44, 0.4, 13, 11, color, plank, { ...hut, alongX: sx !== 0 });
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
    field,
    house,
    market,
    woodcutter,
    quarry,
    forester,
    mill: millStatic,
    bakery,
    pasture,
    carpentry,
    barn,
    dairy,
    goldmine,
    fishery,
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
    // Nem todas as casas têm chaminé (ver `house`): só as de variante múltipla de 3.
    if (variant % 3 !== 0) return;
    const along = variant % 2 === 0;
    const bb = along ? 0.46 : 0.58;
    const aa = along ? 0.6 : 0.5;
    const [x, y] = P(aa / 4, -bb / 6, 38);
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
    const keepH = 34 + level * 9;
    const rise = 22 + level * 2;
    const [x, y] = P(-0.08, -0.08, keepH + rise - 2);
    flag(ctx, x, y, t, level >= 4 ? '#f2c14e' : '#c8553d', 18);
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

export const LIVE = {
    mill: millBlades,
    fishery: fisheryLive,
    bakery: bakeryLive,
    carpentry: chimneyLive,
    house: houseLive,
    pasture: pastureLive,
    castle: castleLive,
    keep: keepLive,
    ore: oreLive
};
