// Tasca do Zé — ponto de entrada.
//
// Liga os botões aos módulos e monta o ecrã inicial. Toda a lógica vive nos
// módulos importados; aqui só há ligações.

import { ALL_DISHES } from './data.js';
import { audio, resumeAudio, sfxClick, sfxTap } from './audio.js';
import { applyMute } from './music.js';
import { SAVORY, SWEET, buildBench, setBenchCategory } from './bench.js';
import { renderLeaderboard } from './leaderboard.js';
import { ringBell, setShiftOverHandler } from './orders.js';
import { getAccountDisplayName } from './scores.js';
import { state } from './state.js';
import { endShift, quitToMenu, readStoredPlayerName, rememberPlayerName, startShift, togglePause } from './shift.js';
import { els, renderHearts, showOverlay } from './ui.js';

// Quando acaba a última vida é o turno que fecha. Registado assim (e não por
// import direto) para os pedidos não dependerem do ciclo de vida.
setShiftOverHandler(endShift);

/** Grelha de pratos no ecrã de preparação: serve de ementa antes de começar. */
function buildMenuGrid() {
    els.menuGrid.innerHTML = '';
    for (const dish of ALL_DISHES) {
        const cell = document.createElement('div');
        cell.innerHTML = `${dish.emoji}<span>${dish.name}</span>`;
        els.menuGrid.appendChild(cell);
    }
}

function openLeaderboard() {
    sfxClick();
    renderLeaderboard();
    showOverlay('leaderboardOverlay');
}

function backToMainMenu() {
    sfxClick();
    showOverlay('mainMenuOverlay');
}

function toggleMute() {
    const muted = audio.toggleMuted();
    els.muteBtn.textContent = muted ? '🔇' : '🔊';
    applyMute();
    if (!muted) {
        resumeAudio();
        sfxClick();
    }
}

const startBtn = document.getElementById('startBtn');

// ---------- Menu principal ----------

document.getElementById('playBtn').addEventListener('click', () => {
    sfxClick();
    // Sugere o nome do turno anterior, o guardado neste aparelho, ou o da conta.
    els.nameInput.value = state.playerName || readStoredPlayerName() || getAccountDisplayName() || '';
    showOverlay('setupOverlay');
    // O foco imediato competiria com a animação de entrada do ecrã.
    setTimeout(() => els.nameInput.focus(), 200);
});

document.getElementById('scoresBtn').addEventListener('click', openLeaderboard);
document.getElementById('overScoresBtn').addEventListener('click', openLeaderboard);
document.getElementById('closeLeaderboardBtn').addEventListener('click', backToMainMenu);
document.getElementById('backToMenuBtn').addEventListener('click', backToMainMenu);
document.getElementById('menuBtn').addEventListener('click', backToMainMenu);

// ---------- Preparação e turno ----------

startBtn.addEventListener('click', () => {
    rememberPlayerName(els.nameInput.value);
    startShift();
});

els.nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') startBtn.click();
});

document.getElementById('againBtn').addEventListener('click', startShift);
document.getElementById('restartBtn').addEventListener('click', startShift);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('quitBtn').addEventListener('click', quitToMenu);

// ---------- Cozinha ----------

els.tabSavory.addEventListener('click', () => {
    sfxTap();
    setBenchCategory(SAVORY);
});
els.tabSweet.addEventListener('click', () => {
    sfxTap();
    setBenchCategory(SWEET);
});

els.bellBtn.addEventListener('click', ringBell);
els.pauseBtn.addEventListener('click', togglePause);
els.muteBtn.addEventListener('click', toggleMute);

// ---------- Arranque ----------

buildMenuGrid();
buildBench();
renderHearts();
showOverlay('mainMenuOverlay');
