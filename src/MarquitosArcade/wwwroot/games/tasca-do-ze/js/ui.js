// Elementos do ecrã, ecrãs sobrepostos e avisos passageiros.

import { byId } from '/lib/arcade/dom.js';
import { TUNING } from './config.js';
import { state } from './state.js';

export const els = byId(
    'queue', 'hearts', 'score',
    'orderCard', 'orderEmoji', 'orderName', 'orderFor', 'reqList', 'bellBtn',
    'benchWrap', 'tabSavory', 'tabSweet',
    'toast', 'brandSub',
    'mainMenuOverlay', 'setupOverlay', 'leaderboardOverlay', 'pauseOverlay', 'overOverlay',
    'finalScore', 'overReason', 'overPlayerLine',
    'menuGrid', 'nameInput', 'leaderboardList',
    'muteBtn', 'pauseBtn'
);

const OVERLAY_IDS = ['mainMenuOverlay', 'setupOverlay', 'leaderboardOverlay', 'pauseOverlay', 'overOverlay'];

export function hideAllOverlays() {
    for (const id of OVERLAY_IDS) els[id].classList.add('hidden');
}

export function showOverlay(id) {
    hideAllOverlays();
    els[id].classList.remove('hidden');
}

let toastTimer = null;

/** Aviso curto no fundo do ecrã. Um novo aviso substitui o anterior. */
export function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), TUNING.toastMs);
}

export function renderHearts() {
    const full = '❤️'.repeat(Math.max(0, state.lives));
    const empty = '🤍'.repeat(Math.max(0, TUNING.lives - state.lives));
    els.hearts.textContent = full + empty;
}

export function renderScore() {
    els.score.textContent = state.score;
}

/** Subtítulo da marca: durante o turno mostra quem está na cozinha; fora dele, "COZINHA". */
export function renderBrandSub() {
    els.brandSub.textContent = state.running && state.playerName ? state.playerName.toUpperCase() : 'COZINHA';
}

/**
 * Reinicia a animação de uma classe de CSS que já esteja aplicada. Sem o
 * `offsetWidth` pelo meio o browser junta o remove+add num só reflow e a
 * animação não volta a correr.
 */
export function replayAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}
