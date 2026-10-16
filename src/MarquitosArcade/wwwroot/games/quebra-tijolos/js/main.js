import { createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';
import { bindMusicButton, unlockAudioOnGesture } from '/lib/arcade/music.js';

import { NAME_STORAGE_KEY, PLAYER_FALLBACK } from './config.js';
import { resumeAudio } from './audio.js';
import { abortLevel, layoutPlayfield, startLevel, togglePause, updateGame } from './game.js';
import { attachControls } from './input.js';
import { createMenu } from './menu.js';
import { music } from './music.js';
import { loadProgress } from './progress.js';
import { render } from './render.js';
import { setResultHandler, showResultScreen } from './results.js';
import { game, session } from './state.js';
import { els, overlays, topBar, topBarEl } from './ui.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: PLAYER_FALLBACK });
attachControls(els.game);

game.touchMode = window.matchMedia?.('(pointer: coarse)').matches ?? false;
createViewport(els.game, {
    topBar: topBarEl,
    topBarGap: 8,
    onResize(viewport) {
        game.view = viewport;
        layoutPlayfield();
        render();
    }
});

const loop = createLoop((dt) => {
    game.globalClock += dt;
    if (!game.paused) {
        if (game.phase === 'ending') {
            updateGame(dt);
            if (game.holdTimer <= 0) showResultScreen();
        } else if (['countdown', 'playing', 'lifeLost'].includes(game.phase)) updateGame(dt);
    }
    render();
}, { scale: 1000, maxDelta: 0.04 });

const menu = createMenu({ playerName, onPlay: play });

function syncMusic() {
    music.setWanted(!game.paused && document.visibilityState === 'visible');
}

function play(levelId) {
    resumeAudio();
    session.playerName = playerName.remember();
    session.playerBoardName = playerName.forBoard();
    if (!startLevel(levelId)) return;
    overlays.hideAll();
    topBar.setInGame(true);
    syncMusic();
}

function backToMenu() {
    abortLevel();
    topBar.setInGame(false);
    menu.showMenu();
    syncMusic();
}

els.playBtn.addEventListener('click', () => play(game.menuLevelId));
els.chooseBtn.addEventListener('click', () => menu.showLevels());
els.backBtn.addEventListener('click', () => menu.showMenu());
els.pauseBtn.addEventListener('click', () => {
    if (!['playing', 'countdown', 'lifeLost'].includes(game.phase)) return;
    togglePause();
    if (game.paused) overlays.show('pause');
    else overlays.hideAll();
    syncMusic();
});
els.resumeBtn.addEventListener('click', () => {
    if (!game.paused) return;
    togglePause();
    overlays.hideAll();
    syncMusic();
});
els.quitBtn.addEventListener('click', backToMenu);
els.endBtn.addEventListener('click', () => {
    if (game.phase === 'menu' || game.phase === 'result') return;
    backToMenu();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !game.paused && ['playing', 'countdown'].includes(game.phase)) {
        togglePause();
        overlays.show('pause');
    }
    syncMusic();
});

setResultHandler((action, levelId) => {
    if (action === 'levels') {
        abortLevel();
        topBar.setInGame(false);
        menu.showLevels();
        return;
    }
    game.menuLevelId = levelId;
    play(levelId);
});

bindMusicButton(els.musicBtn, music, { resume: resumeAudio, onToggle: syncMusic });
unlockAudioOnGesture(resumeAudio, syncMusic);

menu.showMenu();
loop.start();

loadProgress().then(() => {
    if (overlays.isVisible('start')) menu.showMenu();
    else menu.refreshProgress();
});

window.__arcadeSplash?.ready();
