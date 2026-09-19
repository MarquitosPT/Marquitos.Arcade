// Quem anda no labirinto — o jogador e os guardas movem-se todos assim.
//
// A posição não é livre: um caminhante está sempre entre duas células, com um
// progresso `t` de 0 a 1 do lado de cá para o lado de lá. Assim nunca há
// ninguém a entrar numa parede nem a atravessar um corredor num frame lento, e
// as decisões (virar, escolher caminho) acontecem onde é justo acontecerem —
// no centro de uma célula, à vista de quem joga.
//
// Quem decide para onde se vai não é este módulo: é o `chooseDir` que lhe
// passam a cada passo. O jogador dá a tecla; os guardas dão o seu alvo
// (ver enemies.js).

/** Direções, com o par oposto a saber-se de cor. */
export const DIRS = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
};

export const isSameDir = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
export const isOppositeDir = (a, b) => !!a && !!b && a.x === -b.x && a.y === -b.y;
export const oppositeOf = (dir) => ({ x: -dir.x, y: -dir.y });

/**
 * @param {object} start Célula de partida `{ x, y }`.
 * @param {number} speed Células por segundo.
 * @param {object} [dir] Direção inicial; sem ela, fica parado à espera de ordens.
 */
export function createWalker({ x, y, speed, dir = null }) {
    return {
        /** Célula de onde se está a sair (ou onde se está parado). */
        cx: x,
        cy: y,
        /** Progresso de 0 a 1 para a célula seguinte. */
        t: 0,
        dir,
        moving: false,
        speed,
        /** Direção pedida e ainda por aplicar — aplica-se na próxima célula. */
        queued: null
    };
}

/** Posição em células, já interpolada: é isto que o desenho usa. */
export function walkerPos(walker) {
    if (!walker.moving || !walker.dir) return { x: walker.cx, y: walker.cy };
    return {
        x: walker.cx + walker.dir.x * walker.t,
        y: walker.cy + walker.dir.y * walker.t
    };
}

/** A célula em que o caminhante está a contar — a mais perto, não a de partida. */
export function walkerCell(walker) {
    if (!walker.moving || !walker.dir || walker.t < 0.5) return { x: walker.cx, y: walker.cy };
    return { x: walker.cx + walker.dir.x, y: walker.cy + walker.dir.y };
}

export const canGo = (maze, walker, dir) => !!dir && maze.isFloor(walker.cx + dir.x, walker.cy + dir.y);

/**
 * Inverter a marcha é a única mudança de direção que não espera pela célula
 * seguinte: quem vê um guarda a entrar no corredor tem de poder voltar para
 * trás já, e não a meio caminho do beco.
 */
export function reverseWalker(walker) {
    if (!walker.moving || !walker.dir) return;
    walker.cx += walker.dir.x;
    walker.cy += walker.dir.y;
    walker.t = 1 - walker.t;
    walker.dir = oppositeOf(walker.dir);
}

/**
 * Avança `dt` segundos. Pode atravessar mais do que uma célula num passo (num
 * frame lento), e por isso o `chooseDir` é chamado a cada chegada e não uma vez
 * por frame — um guarda rápido continua a decidir em todos os cruzamentos por
 * onde passa.
 *
 * @param {(walker: object) => object|null} chooseDir Direção a tomar a partir da
 *   célula em que se acabou de chegar. Devolver `null` (ou uma direção para uma
 *   parede) deixa o caminhante parado onde está.
 */
export function stepWalker(walker, maze, dt, chooseDir) {
    let remaining = walker.speed * dt;
    // Teto de segurança: mesmo com um `dt` enorme ninguém atravessa o labirinto
    // inteiro num frame — e o ciclo nunca fica preso aqui.
    let hops = 0;

    while (remaining > 0 && hops++ < 16) {
        if (!walker.moving) {
            const dir = chooseDir(walker);
            if (!canGo(maze, walker, dir)) {
                walker.dir = dir || walker.dir;
                break;
            }
            walker.dir = dir;
            walker.moving = true;
            walker.t = 0;
        }

        const step = Math.min(remaining, 1 - walker.t);
        walker.t += step;
        remaining -= step;

        if (walker.t >= 1 - 1e-6) {
            walker.cx += walker.dir.x;
            walker.cy += walker.dir.y;
            walker.t = 0;
            walker.moving = false;
        }
    }
}

/** Distância entre dois caminhantes, em células. */
export function walkerDistance(a, b) {
    const pa = walkerPos(a);
    const pb = walkerPos(b);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}
