// O nível: montar, jogar, perder uma vida, acabar.
//
// Este módulo é o que sabe as regras — apanhar cristais abre a saída, um guarda
// em cima custa uma vida, o relógio a zero acaba a tentativa. Quem manda os
// fotogramas andar é o `main.js`, que troca de fase conforme o que aqui fica
// escrito em `game.phase`.

import {
    CATCH_RADIUS, CAUGHT_PAUSE, CLEAR_PAUSE, COUNTDOWN_FROM, CRYSTAL_POINTS,
    LEVEL_POINTS, LIFE_POINTS, PICKUP_RADIUS, PLAYER_SPEED, RESPAWN_COUNTDOWN, TIME_POINTS
} from './config.js';
import { sfx } from './audio.js';
import { createGuards, resetGuardMode, resetGuards, updateGuardMode, updateGuards } from './enemies.js';
import { buildLevelLayout, levelById, livesOf, starsFor } from './levels.js';
import { recordClear, totalScore } from './progress.js';
import { scores } from './scores.js';
import { game, resetGame, session } from './state.js';
import { canGo, createWalker, isOppositeDir, reverseWalker, stepWalker, walkerDistance, walkerPos } from './walker.js';
import { layoutMaze } from './render.js';

/** Últimos segundos em que o relógio começa a apitar. */
const HURRY_FROM = 10;
let lastHurrySecond = -1;

/** Monta o nível e põe a contagem decrescente a andar. */
export function startLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return false;

    resetGame();
    session.levelId = levelId;

    game.layout = buildLevelLayout(level);
    game.level = level;
    game.maze = game.layout.maze;
    game.crystals = game.layout.crystals.map((cell) => ({ x: cell.x, y: cell.y, taken: false }));
    game.guards = createGuards(game.layout);
    game.player = createWalker({ ...game.layout.spawn, speed: PLAYER_SPEED });
    game.lives = livesOf(level);
    game.timeLeft = level.seconds;
    game.elapsed = 0;
    game.collected = 0;
    game.livesLost = 0;
    game.exitOpen = false;
    game.result = null;

    layoutMaze();
    beginCountdown(COUNTDOWN_FROM);
    return true;
}

function beginCountdown(from) {
    game.phase = 'countdown';
    game.countdownValue = from;
    game.countdownTimer = 0;
    game.paused = false;
    lastHurrySecond = -1;
    resetGuardMode();
}

/** Um passo da contagem decrescente. Devolve `true` quando o nível arranca. */
export function stepCountdown(dt) {
    game.countdownTimer += dt;
    if (game.countdownTimer < 1) return false;

    game.countdownTimer = 0;
    if (game.countdownValue > 0) {
        sfx.tick();
        game.countdownValue--;
        return false;
    }

    sfx.go();
    game.phase = 'playing';
    return true;
}

/** Direção pedida pelos controlos. Guarda-se e aplica-se na célula seguinte. */
export function steer(dir) {
    if (!game.player || game.phase !== 'playing' || game.paused) return;

    // Inverter a marcha é imediato: ver o porquê em walker.js.
    if (game.player.moving && isOppositeDir(dir, game.player.dir)) {
        reverseWalker(game.player);
        game.player.queued = null;
        return;
    }

    game.player.queued = dir;
}

export function updateLevel(dt) {
    game.elapsed += dt;
    tickClock(dt);
    // O relógio pode ter acabado de esgotar o nível: daí a fase voltar a
    // verificar-se antes de se mexer mais alguém.
    if (game.phase !== 'playing') return;

    updateGuardMode(dt);
    stepWalker(game.player, game.maze, dt, playerDir);
    updateGuards(dt);

    collectCrystals();
    checkExit();
    checkCaught();
}

/**
 * Para onde o jogador segue ao chegar a uma célula: o que pediu, se der; senão
 * em frente; senão pára. Não se "come" o pedido que não deu — quem carregou em
 * cima antes da esquina continua a virar lá à frente.
 */
function playerDir(walker) {
    if (canGo(game.maze, walker, walker.queued)) {
        const dir = walker.queued;
        walker.queued = null;
        return dir;
    }
    return walker.dir;
}

function tickClock(dt) {
    game.timeLeft -= dt;

    if (game.timeLeft <= HURRY_FROM && game.timeLeft > 0) {
        const second = Math.ceil(game.timeLeft);
        if (second !== lastHurrySecond) {
            lastHurrySecond = second;
            sfx.hurry();
        }
    }

    if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        finishLevel(false, 'tempo');
    }
}

function collectCrystals() {
    const pos = walkerPos(game.player);

    for (let i = 0; i < game.crystals.length; i++) {
        const crystal = game.crystals[i];
        if (crystal.taken) continue;
        if (Math.hypot(pos.x - crystal.x, pos.y - crystal.y) > PICKUP_RADIUS) continue;

        crystal.taken = true;
        game.collected++;
        sfx.crystal(game.collected, game.crystals.length);

        if (game.collected === game.crystals.length) {
            game.exitOpen = true;
            sfx.exitOpen();
        }
    }
}

function checkExit() {
    if (!game.exitOpen) return;
    const pos = walkerPos(game.player);
    const exit = game.layout.exit;
    if (Math.hypot(pos.x - exit.x, pos.y - exit.y) <= PICKUP_RADIUS) finishLevel(true);
}

function checkCaught() {
    for (const guard of game.guards) {
        if (walkerDistance(game.player, guard.walker) > CATCH_RADIUS) continue;
        loseLife();
        return;
    }
}

function loseLife() {
    game.lives--;
    game.livesLost++;
    sfx.caught();

    if (game.lives <= 0) {
        finishLevel(false, 'apanhado');
        return;
    }

    game.phase = 'caught';
    game.holdTimer = CAUGHT_PAUSE;
}

/** Fim da pausa de quem foi apanhado: toda a gente volta ao sítio e conta-se outra vez. */
export function respawn() {
    game.player.cx = game.layout.spawn.x;
    game.player.cy = game.layout.spawn.y;
    game.player.t = 0;
    game.player.dir = null;
    game.player.queued = null;
    game.player.moving = false;
    resetGuards(game.guards);
    beginCountdown(RESPAWN_COUNTDOWN);
}

/**
 * Acaba a tentativa. O progresso e a pontuação ficam registados aqui e não no
 * ecrã de resultados: o nível acabou neste instante, e um ecrã que não chegue a
 * montar-se não pode ser a razão de se perder o que se fez.
 */
function finishLevel(cleared, reason = null) {
    const level = game.level;
    const seconds = game.elapsed;
    const ms = Math.round(seconds * 1000);

    const result = {
        cleared,
        reason,
        levelId: level.id,
        seconds,
        ms,
        collected: game.collected,
        crystals: game.crystals.length,
        livesLeft: Math.max(0, game.lives),
        livesLost: game.livesLost,
        stars: 0,
        score: 0,
        improved: false,
        unlockedLevel: null
    };

    if (cleared) {
        result.stars = starsFor(level, { seconds, livesLost: game.livesLost });
        result.score = scoreFor(level, result);
        const recorded = recordClear(level.id, result);
        result.improved = recorded.improved;
        result.unlockedLevel = recorded.unlockedLevel;
        // Ao quadro vai o total do jogador, e não os pontos deste nível: o
        // quadro é um só por jogo, e o que se compara é o caminho todo.
        scores.submitQuietly(session.playerBoardName, totalScore());
        sfx.clear();
    } else {
        sfx.fail();
    }

    game.result = result;
    game.phase = 'ending';
    game.holdTimer = cleared ? CLEAR_PAUSE : CAUGHT_PAUSE;
}

/**
 * Os pontos de um nível concluído: os cristais, o que sobrou do relógio, as
 * vidas por gastar e um prémio que cresce com o número do nível — sem ele, os
 * níveis difíceis rendiam o mesmo que os fáceis e não valia a pena avançar.
 */
function scoreFor(level, result) {
    return result.collected * CRYSTAL_POINTS
        + Math.max(0, Math.floor(game.timeLeft)) * TIME_POINTS
        + result.livesLeft * LIFE_POINTS
        + level.id * LEVEL_POINTS;
}

export function togglePause() {
    if (game.phase !== 'playing' && game.phase !== 'countdown') return;
    game.paused = !game.paused;
}

/** Sair a meio: o nível é abandonado e volta-se ao menu, sem resultado nenhum. */
export function abortLevel() {
    resetGame();
}
