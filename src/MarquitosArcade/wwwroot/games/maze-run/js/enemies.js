// Os guardas.
//
// Todos andam da mesma maneira (ver walker.js). O que os distingue é a célula
// que tomam por alvo, e é só isso que um guarda novo precisa de trazer.
//
// Perseguir não é ir "na direção" do jogador: é descer um mapa de distâncias do
// labirinto (ver `distanceField`). Um guarda que vá pela direção certa fica
// preso na primeira parede e dá voltas parvas; um guarda que desça o mapa
// escolhe mesmo o caminho mais curto, paredes contadas. O mapa calcula-se uma
// vez por frame e serve todos os guardas.

import { pick } from '/lib/arcade/index.js';

import { AMBUSH_LOOKAHEAD, CHASE_SECONDS, ENEMY_BASE_SPEED, SCATTER_SECONDS } from './config.js';
import { GUARD_AMBUSH, GUARD_CHASE, GUARD_ROAM } from './levels.js';
import { distanceField, exitsFrom } from './maze.js';
import { game } from './state.js';
import { createWalker, isOppositeDir, stepWalker, walkerCell } from './walker.js';

/** Cor de cada tipo, para se perceber de relance com quem se está a lidar. */
const GUARD_COLORS = {
    [GUARD_ROAM]: '#ff5d9e',
    [GUARD_CHASE]: '#ff8a3d',
    [GUARD_AMBUSH]: '#b78bff'
};

/** Monta os guardas do nível a partir das colocações do `buildLevelLayout`. */
export function createGuards(layout) {
    return layout.guards.map((guard, index) => ({
        kind: guard.kind,
        color: GUARD_COLORS[guard.kind] || '#ff5d9e',
        home: { x: guard.x, y: guard.y },
        /** Desencontra os primeiros passos de guardas que começam juntos. */
        offset: index * 0.17,
        walker: createWalker({ x: guard.x, y: guard.y, speed: ENEMY_BASE_SPEED * guard.speed })
    }));
}

/** Volta a pôr toda a gente no sítio — a seguir a uma vida perdida. */
export function resetGuards(guards) {
    for (const guard of guards) {
        guard.walker.cx = guard.home.x;
        guard.walker.cy = guard.home.y;
        guard.walker.t = 0;
        guard.walker.dir = null;
        guard.walker.moving = false;
    }
}

/**
 * Alterna perseguição e dispersão. É o que dá ritmo ao nível: há uma janela em
 * que se anda a fugir e outra em que se pode ir buscar o cristal que ficou para
 * trás (ver CHASE_SECONDS/SCATTER_SECONDS no config.js).
 */
export function updateGuardMode(dt) {
    game.guardModeTimer -= dt;
    if (game.guardModeTimer > 0) return;

    game.guardMode = game.guardMode === 'chase' ? 'scatter' : 'chase';
    game.guardModeTimer = game.guardMode === 'chase' ? CHASE_SECONDS : SCATTER_SECONDS;
}

export function resetGuardMode() {
    game.guardMode = 'chase';
    game.guardModeTimer = CHASE_SECONDS;
}

export function updateGuards(dt) {
    const { maze, player } = game;
    const playerCell = walkerCell(player);

    // Um mapa por frame para todos os que perseguem, outro para os que emboscam.
    // Só se calculam se houver quem os leia — num nível só de vadios não se
    // percorre o labirinto por nada.
    const kinds = new Set(game.guards.map((guard) => guard.kind));
    const chaseField = kinds.has(GUARD_CHASE) || game.guardMode === 'scatter'
        ? distanceField(maze, playerCell.x, playerCell.y)
        : null;
    const ambushField = kinds.has(GUARD_AMBUSH) && game.guardMode === 'chase'
        ? distanceField(maze, ...ambushTarget(playerCell))
        : null;

    for (const guard of game.guards) {
        stepWalker(guard.walker, maze, dt, (walker) => chooseDir(guard, walker, chaseField, ambushField));
    }
}

/**
 * A célula algumas casas à frente do jogador, na direção em que segue. É o alvo
 * do emboscador: em vez de vir atrás, tenta estar lá quando o jogador chegar.
 * Se o que está à frente for parede, encurta até dar — e no pior caso fica a
 * própria célula do jogador.
 */
function ambushTarget(playerCell) {
    const dir = game.player.dir;
    if (!dir) return [playerCell.x, playerCell.y];

    for (let ahead = AMBUSH_LOOKAHEAD; ahead > 0; ahead--) {
        const x = playerCell.x + dir.x * ahead;
        const y = playerCell.y + dir.y * ahead;
        if (game.maze.isFloor(x, y)) return [x, y];
    }
    return [playerCell.x, playerCell.y];
}

/**
 * A direção a tomar a partir da célula onde o guarda acabou de chegar.
 *
 * Voltar para trás é a última opção, para todos os tipos: um guarda que inverta
 * a marcha num corredor é impossível de ler e tira ao jogador a única coisa que
 * ele tem — saber de que lado vem o perigo. Num beco sem saída, claro, não há
 * outra.
 */
function chooseDir(guard, walker, chaseField, ambushField) {
    const options = exitsFrom(game.maze, walker.cx, walker.cy);
    if (!options.length) return null;

    const forward = walker.dir
        ? options.filter((dir) => !isOppositeDir(dir, walker.dir))
        : options;
    const pool = forward.length ? forward : options;

    if (game.guardMode === 'scatter') return furthestFrom(walker, pool, chaseField);

    switch (guard.kind) {
        case GUARD_CHASE:
            return descend(walker, pool, chaseField);
        case GUARD_AMBUSH:
            return descend(walker, pool, ambushField) || descend(walker, pool, chaseField);
        default:
            return pick(pool);
    }
}

/** A saída que mais aproxima do alvo do mapa. */
function descend(walker, options, field) {
    if (!field) return null;
    return bestBy(walker, options, field, (a, b) => a < b);
}

/** A saída que mais afasta do jogador — é assim que se dispersa. */
function furthestFrom(walker, options, field) {
    if (!field) return pick(options);
    return bestBy(walker, options, field, (a, b) => a > b) || pick(options);
}

function bestBy(walker, options, field, isBetter) {
    let best = null;
    let bestValue = null;

    for (const dir of options) {
        const value = field[(walker.cy + dir.y) * game.maze.cols + walker.cx + dir.x];
        if (value < 0) continue; // canto inalcançável a partir do alvo
        if (bestValue === null || isBetter(value, bestValue)) {
            bestValue = value;
            best = dir;
        }
    }

    return best;
}
