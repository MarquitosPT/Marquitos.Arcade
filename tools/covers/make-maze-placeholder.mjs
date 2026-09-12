#!/usr/bin/env node
/**
 * Gera a capa provisória do Maze Run (wwwroot/covers/maze-run.svg).
 *
 * O jogo ainda não existe, por isso não há screenshot para tirar: desenhamos um
 * labirinto perfeito (DFS) com as cores da arcada, no mesmo formato 16:9 das
 * outras capas. Quando o jogo estiver pronto, apaga este SVG e acrescenta o
 * Maze Run ao capture-covers.mjs.
 *
 * Uso: node tools/covers/make-maze-placeholder.mjs [semente]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/MarquitosArcade/wwwroot/covers');

const COLS = 16;
const ROWS = 9;
const CELL = 60;          // 16 x 9 células de 60px = 960 x 540
const SEED = Number(process.argv[2] ?? 20260912);

// Gerador pseudo-aleatório com semente, para o labirinto ser reproduzível.
let seed = SEED >>> 0;
const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};

// ---- Labirinto perfeito por DFS iterativo ----
const cells = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({
    walls: { top: true, right: true, bottom: true, left: true },
    seen: false
})));

const DIRS = [
    { dx: 0, dy: -1, wall: 'top', opposite: 'bottom' },
    { dx: 1, dy: 0, wall: 'right', opposite: 'left' },
    { dx: 0, dy: 1, wall: 'bottom', opposite: 'top' },
    { dx: -1, dy: 0, wall: 'left', opposite: 'right' }
];

const stack = [{ x: 0, y: 0 }];
cells[0][0].seen = true;
const trail = [{ x: 0, y: 0 }];

while (stack.length) {
    const current = stack[stack.length - 1];
    const options = DIRS.filter(({ dx, dy }) => {
        const nx = current.x + dx, ny = current.y + dy;
        return nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !cells[ny][nx].seen;
    });
    if (!options.length) { stack.pop(); continue; }
    const dir = options[Math.floor(random() * options.length)];
    const nx = current.x + dir.dx, ny = current.y + dir.dy;
    cells[current.y][current.x].walls[dir.wall] = false;
    cells[ny][nx].walls[dir.opposite] = false;
    cells[ny][nx].seen = true;
    stack.push({ x: nx, y: ny });
    if (stack.length > trail.length) trail.push({ x: nx, y: ny });
}

// ---- SVG ----
const walls = [];
for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
        const { walls: w } = cells[y][x];
        const x0 = x * CELL, y0 = y * CELL, x1 = x0 + CELL, y1 = y0 + CELL;
        if (w.top) walls.push(`M${x0} ${y0}H${x1}`);
        if (w.left) walls.push(`M${x0} ${y0}V${y1}`);
        if (x === COLS - 1 && w.right) walls.push(`M${x1} ${y0}V${y1}`);
        if (y === ROWS - 1 && w.bottom) walls.push(`M${x0} ${y1}H${x1}`);
    }
}

// Rasto do jogador: os primeiros passos do percurso mais fundo do labirinto.
const path = trail.slice(0, 26)
    .map(({ x, y }, i) => `${i ? 'L' : 'M'}${x * CELL + CELL / 2} ${y * CELL + CELL / 2}`)
    .join(' ');
const head = trail[Math.min(25, trail.length - 1)];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * CELL} ${ROWS * CELL}" width="${COLS * CELL}" height="${ROWS * CELL}" role="img" aria-label="Labirinto do Maze Run, em desenvolvimento">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#123a5e"/>
      <stop offset="1" stop-color="#0b2440"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#c1467e" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#c1467e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <g fill="#1f5c8a" opacity="0.5">
    ${Array.from({ length: ROWS + 1 }, (_, r) => Array.from({ length: COLS + 1 }, (_, c) =>
        `<circle cx="${c * CELL}" cy="${r * CELL}" r="2.5"/>`).join('')).join('\n    ')}
  </g>
  <path d="${walls.join(' ')}" fill="none" stroke="#1f5c8a" stroke-width="7" stroke-linecap="round" opacity="0.95"/>
  <path d="${path}" fill="none" stroke="#c1467e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" stroke-dasharray="2 26"/>
  <circle cx="${head.x * CELL + CELL / 2}" cy="${head.y * CELL + CELL / 2}" r="46" fill="url(#glow)"/>
  <circle cx="${head.x * CELL + CELL / 2}" cy="${head.y * CELL + CELL / 2}" r="13" fill="#f6ecd9"/>
</svg>
`;

await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, 'maze-run.svg'), svg);
console.log(`maze-run: ${(svg.length / 1024).toFixed(1)} kB → ${resolve(OUT, 'maze-run.svg')}`);
