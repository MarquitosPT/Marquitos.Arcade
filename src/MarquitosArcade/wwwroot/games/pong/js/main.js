// Pong Retro — ponto de entrada.
//
// Junta as peças (campo, física, desenho, controlos) e trata do ciclo de vida:
// menu, partida a decorrer, pausa e regresso ao menu.

import { createAboutDialog, createButtonGroup, createLoop, createOverlays, createTopBar, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput, createScoreClient } from '/lib/arcade/scores.js';

import { ABOUT, GAME_ID, MODE_SINGLE, NAME_STORAGE_KEY } from './config.js';
import { isSinglePlayer, resetScores, state } from './state.js';
import { layout } from './field.js';
import { resumeAudio } from './audio.js';
import { attachControls } from './input.js';
import { update } from './physics.js';
import { draw } from './render.js';

const canvas = document.getElementById('game');
const startBtn = document.getElementById('startBtn');
const resumeBtn = document.getElementById('resumeBtn');
const pauseBtn = document.getElementById('pauseBtn');
const endBtn = document.getElementById('endBtn');
const diffRow = document.getElementById('diffRow');
const nameRow = document.getElementById('nameRow');
const modeRow = document.getElementById('modeRow');
const rotateWarning = document.getElementById('rotateWarning');
const aboutBtn = document.getElementById('aboutBtn');
const topBarEl = document.querySelector('.topBar');

const overlays = createOverlays({
    start: document.getElementById('startScreen'),
    pause: document.getElementById('pauseScreen')
});

const topBar = createTopBar({
    arcadeLink: document.getElementById('arcadeLink'),
    aboutBtn,
    scoresLink: document.getElementById('scoresLink'),
    pauseBtn,
    endBtn
});

createAboutDialog(ABOUT, { opener: aboutBtn });

const scores = createScoreClient(GAME_ID);
const playerName = bindPlayerNameInput(document.getElementById('playerNameInput'), NAME_STORAGE_KEY);

// ---------- Ciclo de jogo ----------

const loop = createLoop(
    (dt) => {
        update(dt);
        draw();
    },
    // dt em "frames a 60fps": 1.0 é um frame. O teto de 2.5 evita que a bola
    // atravesse a raquete quando o separador esteve em segundo plano.
    { scale: 16.67, maxDelta: 2.5 }
);

createViewport(canvas, {
    topBar: topBarEl,
    topBarGap: 10,
    onResize(viewport) {
        state.view = viewport;
        layout();
        checkOrientation();
        if (state.running) draw();
    }
});

/**
 * O modo a dois jogadores precisa de ecrã ao comprido: as raquetes ficam nos
 * lados e em retrato não há espaço para os dois jogadores. Em vez de deixar
 * começar uma partida injogável, o botão desaparece e pede-se para rodar.
 */
function checkOrientation() {
    const needsLandscape = !isSinglePlayer() && state.view.isPortrait;
    rotateWarning.style.display = needsLandscape ? 'block' : 'none';
    startBtn.style.display = needsLandscape ? 'none' : 'inline-block';
}

function startGame() {
    resumeAudio(); // só funciona dentro de um gesto do utilizador — este é o clique
    overlays.hide('start');
    topBar.setInGame(true);
    resetScores();
    layout();
    state.running = true;
    loop.start();
}

/** Sair da partida guarda a pontuação: não há "game over" no Pong, o jogador é que desiste. */
function returnToMenu() {
    submitCurrentScore();
    state.running = false;
    loop.stop();
    overlays.show('start');
    topBar.setInGame(false);
}

function submitCurrentScore() {
    // Só o modo a um jogador conta para o leaderboard — a dois, a pontuação é
    // contra outra pessoa e não mede nada comparável.
    if (!isSinglePlayer() || !state.running || state.scoreP <= 0) return;
    // O `remember` guarda o nome para a próxima visita; ao quadro vai o
    // `forBoard`, que deixa o servidor tratar de quem não escreveu nome.
    playerName.remember();
    scores.submitQuietly(playerName.forBoard(), state.scoreP);
}

// ---------- Ligações aos controlos ----------

attachControls(canvas);

startBtn.addEventListener('click', startGame);

pauseBtn.addEventListener('click', () => {
    if (!state.running) return;
    loop.paused = true;
    overlays.show('pause');
});

resumeBtn.addEventListener('click', () => {
    loop.paused = false;
    overlays.hide('pause');
});

endBtn.addEventListener('click', () => {
    if (state.running) returnToMenu();
});

createButtonGroup(modeRow, '.modeBtn', (mode) => {
    state.mode = mode;
    const single = mode === MODE_SINGLE;
    diffRow.style.display = single ? 'flex' : 'none';
    nameRow.style.display = single ? 'flex' : 'none';
    checkOrientation();
});

createButtonGroup(diffRow, '.diffBtn', (level) => {
    state.aiLevel = parseFloat(level);
});

draw();

// O menu está montado: o ecrã de arranque já pode acabar a barra. O tempo
// mínimo é dele (lib/arcade/splash.js), isto só lhe diz que não falta nada.
window.__arcadeSplash?.ready();
