// Elementos do ecrã e os ecrãs sobrepostos (menu, confirmação, boas-vindas, pausa).

import { byId, createOverlays, createTopBar } from '/lib/arcade/index.js';

export const els = byId(
    'game', 'startScreen', 'confirmScreen', 'welcomeScreen', 'pauseScreen',
    'playBtn', 'newBtn', 'confirmNewBtn', 'cancelNewBtn', 'welcomeBtn', 'welcomeSub', 'welcomeList',
    'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn', 'arcadeLink', 'scoresLink',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'saveCard', 'saveLine', 'saveSub', 'progressNote',
    'hud', 'dayPill', 'popPill', 'happyPill', 'speedBtn', 'resRow', 'questCard', 'questText',
    'toolbar', 'placeBanner', 'placeText', 'placeCancelBtn',
    'sheet', 'sheetIcon', 'sheetTitle', 'sheetSub', 'sheetBody', 'sheetCloseBtn',
    'toasts'
);

export const topBarEl = document.querySelector('.topBar');

export const overlays = createOverlays({
    start: els.startScreen,
    confirm: els.confirmScreen,
    welcome: els.welcomeScreen,
    pause: els.pauseScreen
}, 'flex');

export const topBar = createTopBar({
    arcadeLink: els.arcadeLink,
    scoresLink: els.scoresLink,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});

/** Aviso curto a meio do ecrã, que se vai embora sozinho. */
export function toast(text, tone = '') {
    const el = document.createElement('div');
    el.className = `toast${tone ? ` toast--${tone}` : ''}`;
    el.textContent = text;
    els.toasts.appendChild(el);
    // Nunca mais de três ao mesmo tempo: o mais antigo sai primeiro.
    while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
    setTimeout(() => el.remove(), 3800);
}
