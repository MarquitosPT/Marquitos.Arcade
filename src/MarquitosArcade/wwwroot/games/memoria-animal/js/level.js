// Um nível do princípio ao fim: montar o tabuleiro, mostrar as cartas, as
// jogadas, o relógio e o fim.
//
// Os relógios (pré-visualização, cartas erradas, fim do nível) andam no ciclo
// do main.js e não em `setTimeout`: assim a pausa congela tudo de uma vez, e
// voltar de outro separador não encontra as cartas viradas a meio de nada.

import { animalById } from './animals.js';
import { sfx } from './audio.js';
import {
    buildBoard, dealCards, hideBanner, setCardMatched, setCardUp, shakeCards, showBanner, whenImagesReady
} from './board.js';
import {
    CLEAR_PAUSE_SECONDS, ERROR_POINTS, MAX_STARS, MIN_POINTS_PER_PAIR, MISMATCH_SECONDS, PAIR_POINTS,
    PREVIEW_BASE_SECONDS, PREVIEW_MAX_SECONDS, PREVIEW_PER_PAIR, TIME_POINTS
} from './config.js';
import { fmtClock } from './format.js';
import { levelById } from './levels.js';
import { recordClear, totalScore } from './progress.js';
import { scores } from './scores.js';
import { game, session } from './state.js';
import { els } from './ui.js';

/** Sobe a cada nível começado: um carregamento que chegue tarde a um nível já abandonado não faz nada. */
let generation = 0;

function resetGame() {
    generation++;
    game.phase = 'menu';
    game.paused = false;
    game.first = null;
    game.wrong = [];
    game.attempts = 0;
    game.errors = 0;
    game.pairsFound = 0;
    game.elapsed = 0;
    game.previewTimer = 0;
    game.wrongTimer = 0;
    game.endTimer = 0;
    game.result = null;
    hideBanner();
    els.playArea.classList.remove('is-live');
    els.board.classList.remove('is-cleared');
}

/**
 * O tabuleiro que se vê por trás do vidro nos menus: as cartas do nível
 * apontado, viradas para cima. É só enfeite — ao jogar, baralha-se de novo.
 */
export function showMenuBoard(levelId) {
    const level = levelById(levelId);
    if (!level) return;
    game.level = level;
    game.cards = buildBoard(dealCards(level.pairs));
    for (const card of game.cards) setCardUp(card, true);
    updateHud();
}

/**
 * Começa um nível: baralha, espera pelas ilustrações e mostra as cartas.
 * @returns {boolean} False se o nível não existir.
 */
export function startLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return false;

    resetGame();
    const mine = generation;
    game.level = level;
    game.phase = 'loading';
    game.cards = buildBoard(dealCards(level.pairs));
    els.playArea.classList.add('is-live');
    updateHud();

    whenImagesReady().then(() => {
        if (mine !== generation) return;
        for (const card of game.cards) setCardUp(card, true);
        game.previewTimer = Math.min(PREVIEW_MAX_SECONDS, PREVIEW_BASE_SECONDS + level.pairs * PREVIEW_PER_PAIR);
        game.phase = 'preview';
        showBanner('Olha bem…');
    });

    return true;
}

/** Avança os relógios do nível. `dt` em segundos; em pausa não é chamado. */
export function updateLevel(dt) {
    switch (game.phase) {
        case 'preview':
            game.previewTimer -= dt;
            if (game.previewTimer <= 0) beginPlay();
            break;
        case 'playing':
            game.elapsed += dt;
            if (game.wrong.length) {
                game.wrongTimer -= dt;
                if (game.wrongTimer <= 0) hideWrong();
            }
            els.hudTime.textContent = fmtClock(game.elapsed);
            break;
        default:
            break;
    }
}

/** As cartas viram-se para baixo e o relógio começa a andar. */
function beginPlay() {
    for (const card of game.cards) setCardUp(card, false);
    game.phase = 'playing';
    game.elapsed = 0;
    showBanner('Encontra os pares!', { hold: 900 });
    sfx.go();
}

/** Um toque numa carta. */
export function flipCard(card) {
    if (game.phase !== 'playing' || game.paused) return;
    if (!card || card.matched) return;

    // Quem não quer esperar que as duas cartas erradas se virem sozinhas
    // pode jogar logo a seguinte: viram-se já e a jogada nova começa —
    // mesmo que o toque seja numa delas.
    if (game.wrong.length) hideWrong();
    if (card.up) return;

    setCardUp(card, true);
    sfx.flip();

    if (!game.first) {
        game.first = card;
        return;
    }

    const first = game.first;
    game.first = null;
    game.attempts++;

    if (first.animal === card.animal) {
        setCardMatched(first);
        setCardMatched(card);
        game.pairsFound++;
        sfx.match(game.pairsFound, game.level.pairs);
        showBanner(`${animalById(card.animal)?.name ?? ''}!`, { tone: 'match', hold: 900 });
        if (game.pairsFound === game.level.pairs) finishLevel();
    } else {
        game.errors++;
        game.wrong = [first, card];
        game.wrongTimer = MISMATCH_SECONDS;
        shakeCards(game.wrong);
        sfx.miss();
    }

    updateHud();
}

function hideWrong() {
    for (const card of game.wrong) {
        card.el.classList.remove('is-wrong');
        setCardUp(card, false);
    }
    game.wrong = [];
    game.wrongTimer = 0;
}

/**
 * O último par: o nível acabou. O progresso e a pontuação ficam registados
 * aqui e não no ecrã de resultados — um ecrã que não chegue a montar-se não
 * pode ser a razão de se perder o que se fez (a mesma regra do Maze Run).
 */
function finishLevel() {
    const level = game.level;
    const seconds = game.elapsed;
    const result = {
        levelId: level.id,
        seconds,
        ms: Math.round(seconds * 1000),
        attempts: game.attempts,
        errors: game.errors,
        pairs: level.pairs,
        stars: starsFor(level, game.errors),
        score: scoreFor(level, seconds, game.errors),
        improved: false,
        unlockedLevel: null
    };

    const recorded = recordClear(level.id, result);
    result.improved = recorded.improved;
    result.unlockedLevel = recorded.unlockedLevel;
    // Ao quadro vai o total do jogador, e não os pontos deste nível: o quadro
    // é um só por jogo, e o que se compara é o caminho todo.
    scores.submitQuietly(session.playerBoardName, totalScore());

    game.result = result;
    game.phase = 'ending';
    game.endTimer = CLEAR_PAUSE_SECONDS;
    els.board.classList.add('is-cleared');
    sfx.clear();
}

/** Estrelas pelos erros: é um jogo de memória, e devagar mas certo também é jogar bem. */
export function starsFor(level, errors) {
    if (errors <= level.threeStarErrors) return MAX_STARS;
    if (errors <= level.twoStarErrors) return 2;
    return 1;
}

/** Pares, mais o que sobrou do tempo-alvo, menos os erros — com um chão por par. */
export function scoreFor(level, seconds, errors) {
    const points = level.pairs * PAIR_POINTS
        + Math.max(0, Math.floor(level.par - seconds)) * TIME_POINTS
        - errors * ERROR_POINTS;
    return Math.max(level.pairs * MIN_POINTS_PER_PAIR, points);
}

/** Conta o fim do nível; devolve true quando é hora de mostrar os resultados. */
export function stepEnding(dt) {
    if (game.phase !== 'ending') return false;
    game.endTimer -= dt;
    return game.endTimer <= 0;
}

export function togglePause() {
    if (!isInLevel()) return;
    game.paused = !game.paused;
}

/** Está-se dentro de um nível (e não num menu nem nos resultados). */
export const isInLevel = () => ['loading', 'preview', 'playing'].includes(game.phase);

/** Sair a meio: o nível é abandonado e volta-se ao menu, sem resultado nenhum. */
export function abortLevel() {
    resetGame();
}

export function updateHud() {
    const level = game.level;
    if (!level) return;
    els.hudLevel.textContent = `Nível ${level.id} · ${level.name}`;
    els.hudTime.textContent = fmtClock(game.elapsed);
    els.hudPairs.textContent = `${game.pairsFound}/${level.pairs}`;
    els.hudErrors.textContent = String(game.errors);
}
