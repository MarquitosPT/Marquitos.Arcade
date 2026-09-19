// Maze Run — ponto de entrada.
//
// Monta o viewport, liga os controlos e corre o ciclo principal. O ciclo arranca
// logo no carregamento da página, mesmo em menu: é ele que desenha o labirinto
// do nível escolhido por trás do vidro.

import { createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';

import { NAME_STORAGE_KEY, PLAYER_FALLBACK } from './config.js';
import { resumeAudio } from './audio.js';
import { attachControls, setInputHandlers } from './input.js';
import {
    abortLevel, respawn, startLevel, steer, stepCountdown, togglePause, updateLevel
} from './level.js';
import { createMenu } from './menu.js';
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
}

function backToMenu() {
    abortLevel();
    topBar.setInGame(false);
    menu.showMenu();
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
}

els.pauseBtn.addEventListener('click', requestPause);
els.resumeBtn.addEventListener('click', requestPause);
els.quitBtn.addEventListener('click', backToMenu);
els.endBtn.addEventListener('click', () => {
    if (game.phase === 'menu' || game.phase === 'result') return;
    backToMenu();
});

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
