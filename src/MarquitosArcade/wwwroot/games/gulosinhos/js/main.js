// Gulosinhos — ponto de entrada.
//
// Monta o viewport, liga os controlos e corre o ciclo principal. O ciclo arranca
// logo no carregamento da página, mesmo em menu: é ele que desenha o início do
// nível escolhido por trás do vidro, com o bicho à espera na partida.

import { createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';
import { bindMusicButton, unlockAudioOnGesture } from '/lib/arcade/music.js';

import { NAME_STORAGE_KEY, PLAYER_FALLBACK } from './config.js';
import { resumeAudio } from './audio.js';
import { layoutView, viewSize } from './camera.js';
import { updateParticles } from './effects.js';
import { attachControls, releaseAll, setPauseHandler } from './input.js';
import { abortLevel, respawn, startLevel, stepCountdown, togglePause, updateIdleWorld, updateLevel } from './level.js';
import { createMenu, previewLevel } from './menu.js';
import { music } from './music.js';
import { loadProgress } from './progress.js';
import { initRenderer, render } from './render.js';
import { setResultHandler, showResultScreen } from './results.js';
import { game, session } from './state.js';
import { els, overlays, topBar, topBarEl } from './ui.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: PLAYER_FALLBACK });

// Num aparelho de toque os botões aparecem logo; noutro, ao primeiro toque no ecrã.
game.touchMode = window.matchMedia?.('(pointer: coarse)').matches ?? false;

// ---------- Viewport ----------

const viewport = createViewport(els.game, {
    topBar: topBarEl,
    topBarGap: 8,
    onResize(v) {
        game.view = v;
        layoutView();
    }
});
initRenderer(viewport);
game.view = viewport;

// ---------- Ciclo principal ----------

const loop = createLoop(
    (dt) => {
        game.globalClock += dt;
        if (!game.paused) {
            switch (game.phase) {
                case 'countdown':
                    stepCountdown(dt);
                    break;
                case 'playing':
                    updateLevel(dt);
                    break;
                case 'falling':
                    // O relógio do nível não pára: cair custa tempo.
                    game.elapsed += dt;
                    updateIdleWorld(dt);
                    game.holdTimer -= dt;
                    if (game.holdTimer <= 0) respawn();
                    break;
                case 'ending':
                    updateIdleWorld(dt);
                    game.holdTimer -= dt;
                    if (game.holdTimer <= 0) showResultScreen();
                    break;
                case 'menu':
                    panMenuCamera();
                    break;
                default:
                    break;
            }
            updateParticles(dt);
        }
        render();
    },
    // dt em segundos, com teto: um separador em segundo plano não pode devolver
    // um salto de vários segundos.
    { scale: 1000, maxDelta: 0.05 }
);

/** No menu a câmara passeia devagar pelo princípio do nível, para lá e para cá. */
function panMenuCamera() {
    const world = game.menuWorld;
    if (!world) return;
    const { cols } = viewSize();
    const span = Math.max(0, Math.min(60, world.cols - cols));
    game.camera.x = span * (0.5 - 0.5 * Math.cos(game.globalClock * 0.06));
}

// ---------- Menu ----------

const menu = createMenu({ playerName, onPlay: play });

/** Arranca um nível: o nome fica decidido aqui, antes de o relógio andar. */
function play(levelId) {
    resumeAudio();
    session.playerName = playerName.remember();
    session.playerBoardName = playerName.forBoard();
    releaseAll();
    if (!startLevel(levelId)) return;
    overlays.hideAll();
    topBar.setInGame(true);
    syncMusic();
}

function backToMenu() {
    abortLevel();
    releaseAll();
    topBar.setInGame(false);
    menu.showMenu();
    syncMusic();
}

els.playBtn.addEventListener('click', () => play(game.menuLevelId));
els.chooseBtn.addEventListener('click', () => menu.showLevels());
els.backBtn.addEventListener('click', () => menu.showMenu());

setResultHandler((action, levelId) => {
    if (action === 'levels') {
        abortLevel();
        topBar.setInGame(false);
        previewLevel(game.menuLevelId);
        menu.showLevels();
        return;
    }
    game.menuLevelId = levelId;
    play(levelId);
});

// ---------- Barra de topo, pausa e controlos ----------

setPauseHandler(requestPause);
attachControls(els.game, { onTouchMode: layoutView });

function requestPause() {
    if (!['playing', 'countdown', 'falling'].includes(game.phase)) return;
    togglePause();
    releaseAll();
    if (game.paused) overlays.show('pause');
    else overlays.hideAll();
    syncMusic();
}

els.pauseBtn.addEventListener('click', requestPause);
els.resumeBtn.addEventListener('click', requestPause);
els.quitBtn.addEventListener('click', backToMenu);
els.endBtn.addEventListener('click', () => {
    if (game.phase === 'menu' || game.phase === 'result') return;
    backToMenu();
});

// Esconder a página a meio de um nível pausa-o: voltar e encontrar o bicho
// no fundo de um buraco seria pior do que voltar à pausa.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !game.paused && ['playing', 'countdown'].includes(game.phase)) requestPause();
    syncMusic();
});

// ---------- Música ----------

function syncMusic() {
    music.setWanted(!game.paused && document.visibilityState === 'visible');
}

bindMusicButton(els.musicBtn, music, { resume: resumeAudio, onToggle: syncMusic });
unlockAudioOnGesture(resumeAudio, syncMusic);

// ---------- Arranque ----------

menu.showMenu();
loop.start();

loadProgress().then(() => {
    if (overlays.isVisible('start')) menu.showMenu();
    else menu.refreshProgress();
});

window.__arcadeSplash?.ready();
