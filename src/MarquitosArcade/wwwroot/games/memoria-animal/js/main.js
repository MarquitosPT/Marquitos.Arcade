// Memória Animal — ponto de entrada.
//
// O jogo é todo em DOM (as cartas são botões), sem canvas. O ciclo de
// requestAnimationFrame só anda com os relógios: o do nível, a
// pré-visualização, as cartas erradas e a pausa antes dos resultados.

import { createLoop } from '/lib/arcade/index.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';

import { resumeAudio } from './audio.js';
import { cardFromEvent, layoutBoard } from './board.js';
import { NAME_STORAGE_KEY, PLAYER_FALLBACK } from './config.js';
import { prepareHowto } from './howto.js';
import { abortLevel, flipCard, isInLevel, startLevel, stepEnding, togglePause, updateLevel } from './level.js';
import { createMenu } from './menu.js';
import { musicEnabled, setMusicWanted, toggleMusic } from './music.js';
import { loadProgress } from './progress.js';
import { setResultHandler, showResultScreen } from './results.js';
import { game, session } from './state.js';
import { els, overlays, topBar } from './ui.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: PLAYER_FALLBACK });

// ---------- Ciclo ----------

const loop = createLoop(
    (dt) => {
        if (game.paused) return;
        updateLevel(dt);
        if (stepEnding(dt)) showResultScreen();
    },
    // dt em segundos. O teto de 50ms faz com que um separador em segundo plano
    // não devolva um salto de vários segundos ao relógio do nível.
    { scale: 1000, maxDelta: 0.05 }
);

// ---------- Tamanho das cartas ----------

// A área livre muda com a rotação, com a barra do browser a esconder-se e com
// o HUD a aparecer: um ResizeObserver no palco apanha tudo isso de uma vez.
new ResizeObserver(() => layoutBoard()).observe(els.stage);

// ---------- Menu ----------

const menu = createMenu({ playerName, onPlay: play });

/** Arranca um nível: o nome fica decidido aqui, antes de o relógio andar. */
function play(levelId) {
    resumeAudio();
    session.playerName = playerName.remember();
    session.playerBoardName = playerName.forBoard();

    if (!startLevel(levelId)) return;
    game.menuLevelId = levelId;
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
els.howtoBtn.addEventListener('click', () => {
    prepareHowto();
    overlays.show('howto');
    els.howtoScreen.scrollTop = 0;
});
els.backBtn.addEventListener('click', () => menu.showMenu());
els.howtoBackBtn.addEventListener('click', () => menu.showMenu());

setResultHandler((action, levelId) => {
    if (action === 'levels') {
        abortLevel();
        menu.showLevels();
        return;
    }
    play(levelId);
});

// ---------- Cartas ----------

els.board.addEventListener('click', (event) => flipCard(cardFromEvent(event)));

// ---------- Pausa e sair ----------

function requestPause() {
    if (!isInLevel()) return;
    togglePause();
    if (game.paused) overlays.show('pause');
    else {
        overlays.hideAll();
        loop.resetDelta();
    }
    syncMusic();
}

els.pauseBtn.addEventListener('click', requestPause);
els.resumeBtn.addEventListener('click', requestPause);
els.quitBtn.addEventListener('click', backToMenu);
els.endBtn.addEventListener('click', () => {
    if (!isInLevel() && game.phase !== 'ending') return;
    backToMenu();
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') requestPause();
});

// Fora do jogo o relógio não conta: ao esconder a página (outra app, ecrã
// bloqueado) o nível fica em pausa até se carregar em "Continuar".
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isInLevel() && !game.paused) requestPause();
    syncMusic();
});

// ---------- Música ----------

/**
 * A música toca nos menus, no tabuleiro e nos resultados, e cala-se na pausa e
 * com a página escondida. Antes do primeiro toque não há AudioContext e ela espera.
 */
function syncMusic() {
    setMusicWanted(!game.paused && document.visibilityState === 'visible');
}

function refreshMusicBtn() {
    const on = musicEnabled();
    els.musicBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Desligar a música' : 'Ligar a música';
    els.musicBtn.title = label;
    els.musicBtn.setAttribute('aria-label', label);
}

els.musicBtn.addEventListener('click', () => {
    resumeAudio();
    toggleMusic();
    refreshMusicBtn();
    syncMusic();
});
refreshMusicBtn();

// O browser só deixa soar depois de um gesto. O primeiro toque ou tecla, onde
// quer que seja (até a escrever o nome), destranca o áudio e a música começa
// logo no menu, sem esperar pelo "Jogar".
function unlockAudio() {
    if (!resumeAudio()) return;
    document.removeEventListener('pointerup', unlockAudio, true);
    document.removeEventListener('keydown', unlockAudio, true);
    syncMusic();
}
document.addEventListener('pointerup', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);

// ---------- Arranque ----------

menu.showMenu();
loop.start();

// O progresso da conta chega depois do primeiro frame: o menu já está no ar e
// atualiza-se quando ele vier.
loadProgress().then(() => {
    if (overlays.isVisible('start')) menu.showMenu();
    else menu.refreshProgress();
});

// O menu está montado: o ecrã de arranque já pode acabar a barra.
window.__arcadeSplash?.ready();
