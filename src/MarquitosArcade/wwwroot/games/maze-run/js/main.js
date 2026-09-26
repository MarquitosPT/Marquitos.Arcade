// Maze Run — ponto de entrada.
//
// Monta o viewport, liga os controlos e corre o ciclo principal. O ciclo arranca
// logo no carregamento da página, mesmo em menu: é ele que desenha o labirinto
// do nível escolhido por trás do vidro.

import { createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';
import { bindMusicButton, unlockAudioOnGesture } from '/lib/arcade/music.js';

import { NAME_STORAGE_KEY, PLAYER_FALLBACK } from './config.js';
import { resumeAudio } from './audio.js';
import { attachControls, setInputHandlers } from './input.js';
import {
    HURRY_FROM, abortLevel, isFrozen, respawn, startLevel, steer, stepCountdown, togglePause, updateLevel
} from './level.js';
import { createMenu } from './menu.js';
import { music, setMusicMood } from './music.js';
import { loadProgress } from './progress.js';
import { initRenderer, layoutMaze, render } from './render.js';
import { setResultHandler, showResultScreen } from './results.js';
import { game, session } from './state.js';
import { els, overlays, topBar, topBarEl } from './ui.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: PLAYER_FALLBACK });

// ---------- Viewport ----------

const viewport = createViewport(els.game, {
    topBar: topBarEl,
    topBarGap: 6,
    onResize(v) {
        game.view = v;
        // O tamanho de uma célula depende do ecrã: refaz-se o enquadramento (e
        // o labirinto pintado) a cada remedição, em jogo ou em menu.
        layoutMaze();
    }
});
initRenderer(viewport);
game.view = viewport;

// ---------- Ciclo principal ----------

const loop = createLoop(
    (dt) => {
        game.globalClock += dt;

        switch (game.phase) {
            case 'countdown':
                if (!game.paused) stepCountdown(dt);
                break;
            case 'playing':
                if (!game.paused) updateLevel(dt);
                break;
            case 'caught':
                game.holdTimer -= dt;
                if (game.holdTimer <= 0) respawn();
                break;
            case 'ending':
                game.holdTimer -= dt;
                if (game.holdTimer <= 0) showResultScreen();
                break;
            default:
                break;
        }

        setMusicMood(musicMood());
        render();
    },
    // dt em segundos. O teto de 50ms evita que um separador em segundo plano
    // devolva um salto de vários segundos e atire o jogador para dentro de um guarda.
    { scale: 1000, maxDelta: 0.05 }
);

// ---------- Menu ----------

const menu = createMenu({ playerName, onPlay: play });

/** Arranca um nível: o nome fica decidido aqui, antes de o relógio andar. */
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

setResultHandler((action, levelId) => {
    if (action === 'levels') {
        abortLevel();
        topBar.setInGame(false);
        menu.showLevels();
        return;
    }
    play(levelId);
});

// ---------- Barra de topo, pausa e controlos ----------

setInputHandlers({ steer, pause: requestPause });
attachControls(els.game);

function requestPause() {
    if (game.phase !== 'playing' && game.phase !== 'countdown') return;
    togglePause();
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

// ---------- Música ----------

/**
 * O que a música deve estar a fazer: calma nos menus e na contagem, a correr no
 * labirinto, a apertar nos últimos segundos, parada com os guardas congelados, e
 * só o ostinato quando se é apanhado ou o nível acaba.
 */
function musicMood() {
    switch (game.phase) {
        case 'playing':
            if (isFrozen()) return 'frozen';
            return game.timeLeft <= HURRY_FROM ? 'hurry' : 'run';
        case 'caught':
        case 'ending':
            return 'hold';
        default:
            return 'menu';
    }
}

/** Toca em todo o lado menos na pausa e com a página escondida. */
function syncMusic() {
    music.setWanted(!game.paused && document.visibilityState === 'visible');
}

bindMusicButton(els.musicBtn, music, { resume: resumeAudio, onToggle: syncMusic });

// O browser só deixa soar depois de um gesto. O primeiro toque ou tecla, onde
// quer que seja (até a escrever o nome), destranca o áudio e a música começa
// logo no menu, sem esperar pelo "Jogar".
unlockAudioOnGesture(resumeAudio, syncMusic);
document.addEventListener('visibilitychange', syncMusic);

// ---------- Arranque ----------

menu.showMenu();
loop.start();

// O progresso da conta chega depois do primeiro frame: o menu já está no ar e
// atualiza-se quando ele vier. Quem joga sem conta nem dá por isso.
loadProgress().then(() => {
    // Só se o jogador ainda estiver no primeiro ecrã: se já foi escolher um
    // nível (ou já está a jogar), não se lhe puxa o tapete.
    if (overlays.isVisible('start')) menu.showMenu();
    else menu.refreshProgress();
});

// O menu está montado: o ecrã de arranque já pode acabar a barra. O tempo
// mínimo é dele (lib/arcade/splash.js), isto só lhe diz que não falta nada.
window.__arcadeSplash?.ready();
