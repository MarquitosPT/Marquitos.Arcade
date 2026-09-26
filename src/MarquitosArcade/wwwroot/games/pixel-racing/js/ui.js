// Elementos do ecrã e os ecrãs sobrepostos (menu, pista, pausa, resultados).

import { byId, createAboutDialog, createOverlays, createTopBar } from '/lib/arcade/index.js';
import { ABOUT } from './config.js';

export const els = byId(
    'game', 'startScreen', 'setupScreen', 'pauseScreen', 'resultScreen', 'resultBody',
    'startBtn', 'backBtn', 'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn',
    'modeRow', 'cupField', 'cupRow', 'trackRow', 'colorRow', 'diffRow', 'setupTitle', 'setupSub',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'arcadeLink', 'aboutBtn', 'scoresLink'
);

export const topBarEl = document.querySelector('.topBar');

export const overlays = createOverlays({
    start: els.startScreen,
    setup: els.setupScreen,
    pause: els.pauseScreen,
    result: els.resultScreen
});

export const topBar = createTopBar({
    arcadeLink: els.arcadeLink,
    aboutBtn: els.aboutBtn,
    scoresLink: els.scoresLink,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});

/** Janela "Acerca", aberta pelo botão da barra de topo. */
export const about = createAboutDialog(ABOUT, { opener: els.aboutBtn });
