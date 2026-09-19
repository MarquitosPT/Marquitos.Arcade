// Geração do labirinto.
//
// Os labirintos não estão desenhados à mão em lado nenhum: cada nível traz um
// punhado de números (largura, altura, semente, quanto abrir) e o labirinto sai
// daqui sempre igual. É a mesma ideia das pistas do Pixel Racing — acrescentar
// um nível é acrescentar uma receita, não desenhar um mapa.
//
// A grelha é de células: 1 é parede, 0 é chão. Largura e altura têm de ser
// ímpares, porque o algoritmo escava de duas em duas células e a moldura
// exterior é sempre parede.

/** Gerador com semente (mulberry32): a mesma semente dá sempre o mesmo labirinto. */
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const WALL = 1;
const FLOOR = 0;

/** As quatro direções, sempre por esta ordem — o baralhar é que traz a variedade. */
const STEPS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
];

const toOdd = (value, min) => {
    const clamped = Math.max(min, Math.round(value));
    return clamped % 2 === 0 ? clamped + 1 : clamped;
};

/**
 * Escava o labirinto com uma pilha (backtracker): anda de duas em duas células
 * para uma vizinha ainda por visitar, deitando abaixo a parede pelo meio, e
 * recua quando não tem para onde ir. Dá um labirinto perfeito — um único
 * caminho entre quaisquer dois pontos.
 */
function carve(grid, cols, rows, random) {
    const stack = [{ x: 1, y: 1 }];
    grid[1 * cols + 1] = FLOOR;

    while (stack.length) {
        const current = stack[stack.length - 1];
        const options = [];
        for (const step of STEPS) {
            const nx = current.x + step.x * 2;
            const ny = current.y + step.y * 2;
            if (nx <= 0 || ny <= 0 || nx >= cols - 1 || ny >= rows - 1) continue;
            if (grid[ny * cols + nx] === FLOOR) continue;
            options.push({ nx, ny, step });
        }

        if (!options.length) {
            stack.pop();
            continue;
        }

        const chosen = options[Math.floor(random() * options.length)];
        grid[(current.y + chosen.step.y) * cols + current.x + chosen.step.x] = FLOOR;
        grid[chosen.ny * cols + chosen.nx] = FLOOR;
        stack.push({ x: chosen.nx, y: chosen.ny });
    }
}

/**
 * Abre becos sem saída, ligando-os a um corredor vizinho.
 *
 * Um labirinto perfeito é injusto num jogo de perseguição: quem entra num beco
 * com um guarda atrás não tem jogada nenhuma. Com laços há sempre uma volta a
 * dar, e é isso que faz o jogo ser sobre escolher o caminho. O `braid` do nível
 * diz que parte dos becos se abre: 0 deixa o labirinto como saiu, 1 tira-lhe
 * todos os becos.
 */
function braid(grid, cols, rows, amount, random) {
    if (amount <= 0) return;

    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            if (grid[y * cols + x] !== FLOOR) continue;

            const open = STEPS.filter((step) => grid[(y + step.y) * cols + x + step.x] === FLOOR);
            if (open.length !== 1) continue;
            if (random() > amount) continue;

            // Derruba uma parede que dê para outro corredor (e não para fora).
            const walls = STEPS.filter((step) => {
                const wx = x + step.x;
                const wy = y + step.y;
                if (wx <= 0 || wy <= 0 || wx >= cols - 1 || wy >= rows - 1) return false;
                if (grid[wy * cols + wx] !== WALL) return false;
                const bx = x + step.x * 2;
                const by = y + step.y * 2;
                return bx > 0 && by > 0 && bx < cols - 1 && by < rows - 1 && grid[by * cols + bx] === FLOOR;
            });

            if (walls.length) {
                const step = walls[Math.floor(random() * walls.length)];
                grid[(y + step.y) * cols + x + step.x] = FLOOR;
            }
        }
    }
}

/**
 * @param {object} recipe
 * @param {number} recipe.cols Largura em células (acertada para ímpar).
 * @param {number} recipe.rows Altura em células (acertada para ímpar).
 * @param {number} recipe.seed Semente: o mesmo número dá sempre o mesmo labirinto.
 * @param {number} [recipe.braid=0] Parte dos becos sem saída a abrir, de 0 a 1.
 */
export function buildMaze({ cols, rows, seed, braid: braidAmount = 0 }) {
    const w = toOdd(cols, 7);
    const h = toOdd(rows, 7);
    const random = seededRandom(seed);
    const grid = new Uint8Array(w * h).fill(WALL);

    carve(grid, w, h, random);
    braid(grid, w, h, braidAmount, random);

    const floors = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (grid[y * w + x] === FLOOR) floors.push({ x, y });
        }
    }

    return {
        cols: w,
        rows: h,
        grid,
        floors,
        /** O gerador do nível, já com a semente gasta pela geração — serve para as colocações. */
        random,
        isWall: (x, y) => x < 0 || y < 0 || x >= w || y >= h || grid[y * w + x] === WALL,
        isFloor: (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] === FLOOR
    };
}

/**
 * Distâncias (em células) de todo o labirinto até uma célula, por onda — é o
 * mapa que os guardas descem para perseguir e sobem para dispersar. Paredes e
 * cantos inalcançáveis ficam a -1.
 *
 * Uma onda destas custa uma passagem pelo labirinto (algumas centenas de
 * células) e faz-se uma vez por frame, não uma por guarda: quatro guardas a
 * perseguir o mesmo jogador lêem todos o mesmo mapa.
 *
 * @returns {Int16Array} Indexado por `y * maze.cols + x`.
 */
export function distanceField(maze, targetX, targetY) {
    const { cols, rows } = maze;
    const field = new Int16Array(cols * rows).fill(-1);
    if (!maze.isFloor(targetX, targetY)) return field;

    const queue = new Int32Array(cols * rows);
    let head = 0;
    let tail = 0;

    const start = targetY * cols + targetX;
    field[start] = 0;
    queue[tail++] = start;

    while (head < tail) {
        const index = queue[head++];
        const x = index % cols;
        const y = (index - x) / cols;
        const next = field[index] + 1;

        for (const step of STEPS) {
            const nx = x + step.x;
            const ny = y + step.y;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const ni = ny * cols + nx;
            if (field[ni] !== -1 || maze.grid[ni] === WALL) continue;
            field[ni] = next;
            queue[tail++] = ni;
        }
    }

    return field;
}

/** As direções por onde se sai de uma célula. */
export function exitsFrom(maze, x, y) {
    return STEPS.filter((step) => maze.isFloor(x + step.x, y + step.y));
}

export { STEPS };
