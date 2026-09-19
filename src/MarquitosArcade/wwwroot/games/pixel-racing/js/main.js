// Pixel Racing — ponto de entrada.
//
// Monta o viewport, liga os controlos e corre o ciclo principal. O ciclo arranca
// logo no carregamento da página, mesmo em menu: é ele que desenha a pista por
// trás do ecrã inicial.

import { createButtonGroup, createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';

import { MODE_TOURNAMENT, NAME_STORAGE_KEY, TOURNAMENT_CUPS } from './config.js';
import { sfx } from './audio.js';
import { attachControls, setPauseHandler } from './input.js';
import { resetParticles, updateConfetti, updateParticles } from './particles.js';
import { menuZoom, returnToMenuAbort, startRace, togglePause, updateCamera, updateRace } from './race.js';
import { drawCountdown, drawFinishOverlay, initRenderer, render } from './render.js';
import { setReturnToMenuHandler, showResultScreen } from './results.js';
import { setupParticipants } from './cars.js';
import { createMenu } from './menu.js';
import { race, session } from './state.js';
import { els, topBar, topBarEl } from './ui.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: 'Tu' });

// ---------- Viewport ----------

const viewport = createViewport(els.game, {
    topBar: topBarEl,
    topBarGap: 6,
    onResize(v) {
        race.view = v;
        // Fora da corrida ninguém está a mexer na câmara, e o enquadramento do
        // menu depende do tamanho do ecrã: aplica-se aqui para o fundo não ficar
        // com o enquadramento do tamanho de ecrã anterior.
        if (race.phase !== 'racing') race.zoom = menuZoom();
    }
});
initRenderer(viewport);

// ---------- Ciclo principal ----------

const loop = createLoop(
    (dt) => {
        race.globalClock += dt;

        switch (race.phase) {
            case 'countdown':
                stepCountdown(dt);
                break;
            case 'racing':
                // Em pausa a corrida não avança, mas a câmara e as partículas sim:
                // o fundo do ecrã de pausa fica vivo em vez de congelado.
                if (!race.paused) updateRace(dt);
                updateCamera(dt);
                updateParticles(dt);
                render();
                break;
            case 'finishOverlay':
                stepFinishOverlay(dt);
                break;
            case 'result':
                updateConfetti(dt);
                render();
                break;
            default:
                render();
        }
    },
    // dt em segundos. O teto de 50ms evita que um separador em segundo plano
    // devolva um salto de vários segundos e atire os carros para fora da pista.
    { scale: 1000, maxDelta: 0.05 }
);

function stepCountdown(dt) {
    race.countdownTimer += dt;
    if (race.countdownTimer >= 1) {
        race.countdownTimer = 0;
        if (race.countdownValue > 0) {
            sfx.tick();
            race.countdownValue--;
        } else {
            sfx.go();
            race.phase = 'racing';
            loop.resetDelta(); // o primeiro frame de corrida começa do zero
        }
    }
    drawCountdown();
}

/**
 * Depois de o jogador cortar a meta, os adversários continuam a correr durante
 * 1,3s antes dos resultados — vê-se quem chega a seguir em vez de o ecrã congelar.
 */
function stepFinishOverlay(dt) {
    updateCamera(dt);
    updateParticles(dt);
    race.finishTimer -= dt;
    drawFinishOverlay();
    if (race.finishTimer <= 0) showResultScreen();
}

// ---------- Menu ----------

const menu = createMenu({ playerName });

// O modo não arranca a corrida: leva ao ecrã seguinte, onde se escolhe a pista
// (corrida simples) e a dificuldade.
createButtonGroup(els.modeRow, '.modeBtn', (mode) => menu.showSetup(mode));

createButtonGroup(els.diffRow, '.diffBtn', (level) => {
    session.difficulty = parseFloat(level);
});

els.backBtn.addEventListener('click', () => menu.showMenu());

els.startBtn.addEventListener('click', () => {
    setupParticipants(playerName.remember(), session.playerColor);
    session.playerBoardName = playerName.forBoard();
    session.raceIndex = 0;
    session.tracks = session.mode === MODE_TOURNAMENT ? [...TOURNAMENT_CUPS[session.cupIdx].tracks] : [session.trackIdx];
    startRace(session.tracks[0]);
});

setReturnToMenuHandler((action) => {
    if (action === 'again') {
        setupParticipants(playerName.remember(), session.playerColor);
        session.playerBoardName = playerName.forBoard();
        session.raceIndex = 0;
        startRace(session.tracks[0]);
        return;
    }
    race.phase = 'menu';
    resetParticles();
    menu.showMenu();
    topBar.setInGame(false);
});

// ---------- Barra de topo e pausa ----------

setPauseHandler(togglePause);
attachControls(els.game);

els.pauseBtn.addEventListener('click', togglePause);
els.resumeBtn.addEventListener('click', togglePause);
els.quitBtn.addEventListener('click', returnToMenuAbort);
els.endBtn.addEventListener('click', () => {
    if (race.phase === 'racing' || race.paused) returnToMenuAbort();
});

loop.start();

// O menu está montado: o ecrã de arranque já pode acabar a barra. O tempo
// mínimo é dele (lib/arcade/splash.js), isto só lhe diz que não falta nada.
window.__arcadeSplash?.ready();
