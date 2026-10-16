import { LEVEL_COLS, LEVEL_COUNT } from './config.js';

const PALETTES = [
    { accent: '#7dd3fc', bricks: ['#6ee7ff', '#38bdf8', '#2563eb'], wall: '#0f4c81', glow: 'rgba(96, 202, 255, 0.28)' },
    { accent: '#f9a8d4', bricks: ['#fda4af', '#fb7185', '#db2777'], wall: '#7f1d58', glow: 'rgba(255, 120, 180, 0.28)' },
    { accent: '#fcd34d', bricks: ['#fde68a', '#fbbf24', '#f59e0b'], wall: '#7c4a03', glow: 'rgba(252, 211, 77, 0.3)' },
    { accent: '#86efac', bricks: ['#bbf7d0', '#4ade80', '#16a34a'], wall: '#166534', glow: 'rgba(110, 231, 183, 0.25)' },
    { accent: '#c4b5fd', bricks: ['#ddd6fe', '#a78bfa', '#7c3aed'], wall: '#4c1d95', glow: 'rgba(180, 140, 255, 0.3)' },
    { accent: '#fca5a5', bricks: ['#fecaca', '#fb7185', '#dc2626'], wall: '#7f1d1d', glow: 'rgba(255, 150, 150, 0.25)' }
];

const ADJECTIVES = ['Morno', 'Vítreo', 'Arcano', 'Denso', 'Veloz', 'Pálido', 'Vivo', 'Brilhante'];
const NOUNS = ['Pátio', 'Fortim', 'Labirinto', 'Muralha', 'Salão', 'Corredor', 'Farol', 'Bastião'];
const HINTS = [
    'Ataca os cantos para abrir caminho depressa.',
    'As peças de aço só servem de ricochete.',
    'Nos níveis tardios vale mais controlar o ângulo do que a velocidade.',
    'Uma vida inteira guardada vale mais uma estrela.',
    'As fileiras apertadas pedem batidas rasantes.',
    'Quando o teto fecha muito, usa a raquete como mira.'
];

function mulberry32(seed) {
    return function rand() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function familyFill(family, row, col, rows, cols, rng, id) {
    const mid = (cols - 1) / 2;
    const dist = Math.abs(col - mid);
    switch (family) {
        case 0:
            return row <= rows - 1 - Math.floor(dist * 0.7) || (row < rows - 1 && rng() > 0.86);
        case 1:
            return (row + col) % 2 === id % 2 || dist <= row * 0.35 + 0.9;
        case 2:
            return dist + row * 0.85 <= rows + 0.6 || (row < 2 && dist <= mid - 1);
        case 3:
            return dist >= 1 || row < rows - 1 || rng() > 0.45;
        case 4:
            return row === 0 || row === rows - 1 || dist === Math.floor(mid) || rng() > 0.18;
        default:
            return row <= rows - 1 - (col % 3 === 1 ? 1 : 0) || dist <= 1.3;
    }
}

function createPattern(id) {
    const tier = Math.floor((id - 1) / 8);
    const rows = Math.min(8, 4 + Math.floor((id - 1) / 6));
    const cols = LEVEL_COLS;
    const rng = mulberry32(id * 7919);
    const family = (id - 1) % 6;
    const strongBias = Math.min(0.72, 0.18 + tier * 0.08 + id * 0.006);
    const armoredBias = Math.min(0.4, tier * 0.05 + Math.max(0, id - 18) * 0.0065);
    const steelBias = id < 9 ? 0 : Math.min(0.18, (id - 8) * 0.0035);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    const mid = Math.floor(cols / 2);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= mid; col++) {
            if (!familyFill(family, row, col, rows, cols, rng, id)) continue;
            const mirrored = cols - 1 - col;
            let value = 1;
            const depth = row / Math.max(1, rows - 1);
            if (rng() < steelBias * (0.35 + depth * 0.8) && row > 0 && row < rows - 1) value = 9;
            else if (rng() < armoredBias * (0.3 + depth)) value = 3;
            else if (rng() < strongBias * (0.5 + depth * 0.6)) value = 2;
            grid[row][col] = value;
            grid[row][mirrored] = value;
        }
    }

    for (let row = 0; row < rows; row++) {
        if (family === 3 && row >= 1 && row < rows - 1) grid[row][mid] = 0;
        if (family === 5 && row % 2 === 1 && rows > 4) grid[row][0] = grid[row][cols - 1] = 0;
    }

    if (!grid.some((line) => line.some((cell) => cell > 0 && cell < 9))) {
        grid[0][mid] = 1;
        grid[1] && (grid[1][mid] = 2);
    }

    return { rows, cols, grid };
}

function countBricks(grid) {
    let total = 0;
    for (const row of grid) for (const cell of row) if (cell > 0 && cell < 9) total++;
    return total;
}

function nameFor(id) {
    return `${ADJECTIVES[(id - 1) % ADJECTIVES.length]} ${NOUNS[Math.floor((id - 1) / ADJECTIVES.length) % NOUNS.length]}`;
}

function createLevel(id) {
    const pattern = createPattern(id);
    const tier = Math.floor((id - 1) / 8);
    const palette = PALETTES[(id - 1) % PALETTES.length];
    return {
        id,
        name: nameFor(id),
        hint: HINTS[(id - 1) % HINTS.length],
        accent: palette.accent,
        palette,
        cols: pattern.cols,
        rows: pattern.rows,
        grid: pattern.grid,
        brickCount: countBricks(pattern.grid),
        paddleWidth: Math.max(88, 142 - id - tier * 5),
        ballSpeed: 390 + id * 8,
        targetMs: Math.max(32000, 70000 - id * 650 - tier * 1200),
        clearBonus: 450 + id * 36,
        previewLivesStar: 3
    };
}

export const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, index) => createLevel(index + 1));

export const levelCount = () => LEVELS.length;
export const levelById = (id) => LEVELS[id - 1];
