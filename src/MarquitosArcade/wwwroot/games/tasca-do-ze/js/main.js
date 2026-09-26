// Tasca do Zé — ponto de entrada.
//
// Liga os botões aos módulos e monta o ecrã inicial. Toda a lógica vive nos
// módulos importados; aqui só há ligações.

import { ALL_DISHES } from './data.js';
import { audio, resumeAudio, sfxClick, sfxTap } from './audio.js';
import { applyMute } from './music.js';
import { SAVORY, SWEET, buildBench, setBenchCategory } from './bench.js';
import { ringBell, setShiftOverHandler } from './orders.js';
import { renderAboutDetails } from '/lib/arcade/about.js';
import { bindPlayerNameInput } from '/lib/arcade/scores.js';
import { ABOUT, DEFAULT_PLAYER_NAME, NAME_STORAGE_KEY } from './config.js';
import { state } from './state.js';
import { endShift, quitToMenu, startShift, togglePause } from './shift.js';
import { els, renderHearts, showOverlay } from './ui.js';

// O campo do nome é do SDK, como nos outros dois jogos: trata do que está
// guardado neste aparelho, do nome da conta de quem tem sessão iniciada e da
// ordem entre os dois. Ver /lib/arcade/scores.js.
const playerName = bindPlayerNameInput(els.nameInput, NAME_STORAGE_KEY, { fallback: DEFAULT_PLAYER_NAME });

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

function openAbout() {
    sfxClick();
    showOverlay('aboutOverlay');
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
    // O campo não se mexe aqui: o que lá está é o que o jogador escreveu (ou o
    // nome da conta). Reescrevê-lo a cada abertura era o que punha o
    // "Cozinheiro(a) Anónimo" no campo de quem tinha jogado sem dar nome.
    showOverlay('setupOverlay');
    // O foco imediato competiria com a animação de entrada do ecrã.
    setTimeout(() => els.nameInput.focus(), 200);
});

document.getElementById('aboutBtn').addEventListener('click', openAbout);
document.getElementById('closeAboutBtn').addEventListener('click', backToMainMenu);
document.getElementById('backToMenuBtn').addEventListener('click', backToMainMenu);
document.getElementById('menuBtn').addEventListener('click', backToMainMenu);

// ---------- Preparação e turno ----------

startBtn.addEventListener('click', () => {
    state.playerName = playerName.remember();
    state.boardName = playerName.forBoard();
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
els.aboutDetails.appendChild(renderAboutDetails(ABOUT));
renderHearts();
showOverlay('mainMenuOverlay');

// O menu está montado: o ecrã de arranque já pode acabar a barra. O tempo
// mínimo é dele (lib/arcade/splash.js), isto só lhe diz que não falta nada.
window.__arcadeSplash?.ready();
