// Quebra-Tijolos — ponto de entrada.
//
// Monta o viewport e o campo, liga os controlos e corre o ciclo principal. O
// ciclo arranca logo no carregamento da página, mesmo em menu: é ele que
// desenha o nível escolhido por trás do vidro.

import { createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';
import { bindMusicButton, unlockAudioOnGesture } from '/lib/arcade/music.js';

import { NAME_STORAGE_KEY, PLAYER_FALLBACK } from './config.js';
import { resumeAudio } from './audio.js';
import { updateEffects } from './effects.js';
import { layoutField } from './field.js';
import { attachControls, releaseAll, setPauseHandler } from './input.js';
import { abortLevel, startLevel, togglePause, updateLevel } from './level.js';
import { createMenu } from './menu.js';
import { music } from './music.js';
import { loadProgress } from './progress.js';
import { render } from './render.js';
import { setResultHandler, showResultScreen } from './results.js';
import { game, session } from './state.js';
import { els, overlays, topBar, topBarEl } from './ui.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: PLAYER_FALLBACK });

// Num aparelho de toque as instruções falam em tocar; noutro, ao primeiro toque no ecrã.
game.touchMode = window.matchMedia?.('(pointer: coarse)').matches ?? false;

// ---------- Viewport ----------

createViewport(els.game, {
    topBar: topBarEl,
    topBarGap: 8,
    onResize(viewport) {
        game.view = viewport;
        layoutField(topBarEl);
    }
});

/** A barra muda de botões ao entrar e sair do nível, e o campo pode subir ao lado dela. */
function setInGame(inGame) {
    topBar.setInGame(inGame);
    layoutField(topBarEl);
}

// ---------- Ciclo principal ----------

const loop = createLoop(
    (dt) => {
        game.globalClock += dt;
        if (!game.paused) {
            if (['playing', 'lost', 'ending'].includes(game.phase)) updateLevel(dt);
            if (game.phase === 'ending' && game.holdTimer <= 0) showResultScreen();
            updateEffects(dt);
        }
        render();
    },
    // dt em segundos, com teto: um separador em segundo plano não pode devolver
    // um salto de vários segundos (a bola atravessava a raquete).
    { scale: 1000, maxDelta: 0.05 }
);

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
    setInGame(true);
    syncMusic();
}

function backToMenu() {
    abortLevel();
    releaseAll();
    setInGame(false);
    menu.showMenu();
    syncMusic();
}

els.playBtn.addEventListener('click', () => play(game.menuLevelId));
els.chooseBtn.addEventListener('click', () => menu.showLevels());
els.backBtn.addEventListener('click', () => menu.showMenu());

setResultHandler((action, levelId) => {
    if (action === 'levels') {
        abortLevel();
        setInGame(false);
        menu.showLevels();
        return;
    }
    game.menuLevelId = levelId;
    play(levelId);
});

// ---------- Barra de topo e pausa ----------

setPauseHandler(requestPause);
attachControls(els.game);

function requestPause() {
    if (!['playing', 'lost'].includes(game.phase)) return;
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

// Esconder a página a meio de um nível pausa-o: voltar e encontrar a bola já
// perdida seria pior do que voltar à pausa.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !game.paused && ['playing', 'lost'].includes(game.phase)) requestPause();
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
