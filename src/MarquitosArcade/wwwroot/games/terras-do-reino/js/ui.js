// Elementos do ecrã e os ecrãs sobrepostos (menu, confirmação, pausa).

import { byId, createAboutDialog, createOverlays, createTopBar } from '/lib/arcade/index.js';
import { ABOUT } from './config.js';

export const els = byId(
    'game', 'startScreen', 'confirmScreen', 'pauseScreen',
    'playBtn', 'newBtn', 'confirmNewBtn', 'cancelNewBtn',
    'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn', 'arcadeLink', 'aboutBtn', 'scoresLink',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'saveCard', 'saveLine', 'saveSub', 'progressNote',
    'hud', 'dayPill', 'popPill', 'happyPill', 'speedBtn', 'rotateBtn', 'resRow', 'questCard', 'questText',
    'toolbar', 'placeBanner', 'placeText', 'placeCancelBtn', 'placeHideBtn', 'placeConfirm', 'placeNoBtn', 'placeYesBtn',
    'sheet', 'sheetIcon', 'sheetTitle', 'sheetSub', 'sheetBody', 'sheetCloseBtn',
    'toasts'
);

export const topBarEl = document.querySelector('.topBar');

export const overlays = createOverlays({
    start: els.startScreen,
    confirm: els.confirmScreen,
    pause: els.pauseScreen
}, 'flex');

export const topBar = createTopBar({
    arcadeLink: els.arcadeLink,
    aboutBtn: els.aboutBtn,
    scoresLink: els.scoresLink,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});

/** Janela "Acerca", aberta pelo botão da barra de topo. */
export const about = createAboutDialog(ABOUT, { opener: els.aboutBtn });

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
