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

    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

    /**
     * A geometria escavada, sem contar com portas. É esta que o desenho usa: as
     * paredes pintam-se uma vez por nível (render.js) e uma porta que abre não
     * pode obrigar a repintar o labirinto — a porta é desenhada por cima, viva,
     * e o que ela faz ao caminho é com o `blocked` aqui em baixo.
     */
    const isWallStatic = (x, y) => !inside(x, y) || grid[y * w + x] === WALL;

    /**
     * As portas fechadas deste nível, por chave "x,y". Não estão na grelha de
     * propósito: a grelha é a forma do labirinto e não muda; isto é o estado do
     * nível e muda a meio. Tudo o que decide caminho — o andar, as saídas de
     * uma célula, o mapa dos guardas — passa pelo `isFloor`, por isso abrir uma
     * porta chega para toda a gente saber que já pode passar por ali.
     */
    const blocked = new Set();

    /** Portais, por chave "x,y" -> a célula do outro lado. */
    const portals = new Map();

    const maze = {
        cols: w,
        rows: h,
        grid,
        floors,
        blocked,
        portals,
        /** O gerador do nível, já com a semente gasta pela geração — serve para as colocações. */
        random,
        isWallStatic,
        isFloor: (x, y) => inside(x, y) && grid[y * w + x] === FLOOR && !blocked.has(`${x},${y}`),
        isWall: (x, y) => !maze.isFloor(x, y),
        /** A célula do outro lado do portal que está aqui, ou `null`. */
        teleport: (x, y) => portals.get(`${x},${y}`) || null
    };

    return maze;
}

/** Chave de célula para os conjuntos e mapas do labirinto. */
export const cellKey = (x, y) => `${x},${y}`;

/**
 * Distâncias (em células) de todo o labirinto até uma célula, por onda — é o
 * mapa que os guardas descem para perseguir e sobem para dispersar. Paredes e
 * cantos inalcançáveis ficam a -1.
 *
 * Uma onda destas custa uma passagem pelo labirinto (algumas centenas de
 * células) e faz-se uma vez por frame, não uma por guarda: quatro guardas a
 * perseguir o mesmo jogador lêem todos o mesmo mapa. Por ser refeita a cada
 * frame, uma porta que abra entra nela sozinha — não há mapa em cache para
 * invalidar.
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
            visit(x + step.x, y + step.y, next);
        }

        // Um portal é uma porta ao lado, para efeitos de caminho: sem isto, um
        // guarda que descesse este mapa passava ao lado do portal sem o ver, e
        // o jogador atravessava o labirinto por um atalho que a perseguição não
        // conhecia.
        const twin = maze.teleport(x, y);
        if (twin) visit(twin.x, twin.y, next);
    }

    function visit(x, y, distance) {
        if (!maze.isFloor(x, y)) return;
        const index = y * cols + x;
        if (field[index] !== -1) return;
        field[index] = distance;
        queue[tail++] = index;
    }

    return field;
}

/** As direções por onde se sai de uma célula. */
export function exitsFrom(maze, x, y) {
    return STEPS.filter((step) => maze.isFloor(x + step.x, y + step.y));
}

/** True se ainda dá para ir de uma célula à outra com o labirinto como está agora. */
export function canReach(maze, from, to) {
    const field = distanceField(maze, from.x, from.y);
    return field[to.y * maze.cols + to.x] >= 0;
}

/**
 * O caminho mais curto entre duas células, sem a de partida. Desce o mapa de
 * distâncias até ao destino, exatamente como um guarda faz — por isso inclui os
 * saltos de portal, e não só os passos de vizinho para vizinho.
 *
 * Serve para procurar onde pôr uma porta: uma porta só vale a pena onde passa
 * mesmo o caminho para o que ela guarda (ver `placeDoors` em levels.js).
 */
export function shortestPath(maze, from, to) {
    const field = distanceField(maze, to.x, to.y);
    let current = { x: from.x, y: from.y };
    let distance = field[current.y * maze.cols + current.x];
    if (distance < 0) return [];

    const path = [];
    while (distance > 0) {
        const twin = maze.teleport(current.x, current.y);
        const options = STEPS
            .map((step) => ({ x: current.x + step.x, y: current.y + step.y }))
            .concat(twin ? [twin] : [])
            .filter((cell) => maze.isFloor(cell.x, cell.y));

        const next = options.find((cell) => field[cell.y * maze.cols + cell.x] === distance - 1);
        if (!next) return path; // labirinto mexeu debaixo dos pés; o que há serve
        path.push(next);
        current = next;
        distance--;
    }

    return path;
}

export { STEPS };
