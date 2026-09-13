// Ciclo de vida de um turno: começar, correr, pausar e fechar a cozinha.

import { readText, writeText } from '/lib/arcade/storage.js';
import { DEFAULT_PLAYER_NAME, NAME_STORAGE_KEY } from './config.js';
import { resumeAudio, sfxClick, sfxGameOver } from './audio.js';
import { startMusic, stopMusic } from './music.js';
import { loseLife, renderQueue, spawnOrder, updatePatienceBar } from './orders.js';
import { scores } from './scores.js';
import { resetShift, state } from './state.js';
import { els, hideAllOverlays, renderBrandSub, renderHearts, renderScore, showOverlay, toast } from './ui.js';

const OFFLINE_WARNING = 'Sem ligação ao servidor — pontuação guardada só neste aparelho.';

/**
 * O relógio do turno. Anda em ms reais (não em frames): a paciência dos clientes
 * está definida em segundos e tem de correr à mesma velocidade em qualquer ecrã.
 */
let lastTick = 0;
let frameId = 0;

function tick(timestamp) {
    if (!state.running) return;
    if (!lastTick) lastTick = timestamp;
    const dt = timestamp - lastTick;
    lastTick = timestamp;

    if (!state.paused) {
        advanceActiveOrder(dt);
        advanceSpawnTimer(dt);
    }

    frameId = requestAnimationFrame(tick);
}

function advanceActiveOrder(dt) {
    const order = state.orders[0];
    if (!order) return;

    order.patienceLeft -= dt;
    if (order.patienceLeft > 0) {
        updatePatienceBar(order);
        return;
    }

    state.orders.shift();
    renderQueue();
    loseLife('Um cliente foi-se embora zangado!');
}

function advanceSpawnTimer(dt) {
    state.lastSpawn += dt;
    if (state.lastSpawn < state.spawnInterval) return;
    state.lastSpawn = 0;
    spawnOrder();
}

export function startShift() {
    resumeAudio(); // só funciona dentro de um gesto do utilizador — este é o clique
    // Reiniciar a partir da pausa deixava o ciclo anterior a correr: ficavam dois
    // requestAnimationFrame a descontar paciência e o turno andava ao dobro.
    if (frameId) cancelAnimationFrame(frameId);
    resetShift();
    lastTick = 0;

    renderScore();
    renderBrandSub();
    renderHearts();
    hideAllOverlays();

    // Dois clientes logo à partida: um sozinho fazia o arranque parecer parado.
    spawnOrder();
    spawnOrder();

    startMusic();
    frameId = requestAnimationFrame(tick);
}

function stopShift() {
    state.running = false;
    state.paused = false;
    stopMusic();
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
}

/** Fim do turno por falta de vidas. Mostra o resultado e guarda a pontuação. */
export function endShift(reason) {
    stopShift();
    sfxGameOver();

    const name = state.playerName || DEFAULT_PLAYER_NAME;
    els.overReason.textContent = reason || 'a cozinha fechou por hoje';
    els.finalScore.textContent = state.score;
    els.overPlayerLine.textContent = `${name} — a guardar pontuação...`;
    showOverlay('overOverlay');

    const finalScore = state.score;
    scores.submit(name, finalScore).then((result) => {
        const isTop = result.board.findIndex((e) => e.name === name && e.score === finalScore) === 0;
        els.overPlayerLine.textContent = result.ok && isTop && finalScore > 0
            ? `${name} — novo recorde! 🏆`
            : `${name} — pontos no turno de hoje`;
        if (!result.ok) toast(OFFLINE_WARNING);
    });
}

/** Sair a meio conta na mesma: a pontuação feita até ali vai para o quadro. */
export function quitToMenu() {
    if (state.running && state.score > 0) {
        scores.submit(state.playerName || DEFAULT_PLAYER_NAME, state.score).then((result) => {
            if (!result.ok) toast(OFFLINE_WARNING);
        });
    }

    stopShift();
    els.orderCard.style.display = 'none';
    els.queue.innerHTML = '';
    renderBrandSub(); // fora do turno volta a ler "COZINHA"
    showOverlay('mainMenuOverlay');
}

export function togglePause() {
    if (!state.running) return;
    sfxClick();
    state.paused = !state.paused;
    els.pauseOverlay.classList.toggle('hidden', !state.paused);
}

/** Guarda o nome escrito no ecrã de preparação e devolve-o já normalizado. */
export function rememberPlayerName(raw) {
    state.playerName = (raw || '').trim() || DEFAULT_PLAYER_NAME;
    writeText(NAME_STORAGE_KEY, state.playerName);
    return state.playerName;
}

export const readStoredPlayerName = () => readText(NAME_STORAGE_KEY) || '';
