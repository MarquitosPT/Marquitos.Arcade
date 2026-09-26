// Elementos do ecrã e os ecrãs sobrepostos (menu, níveis, pausa, resultados).

import { byId, createAboutDialog, createOverlays, createTopBar } from '/lib/arcade/index.js';
import { ABOUT } from './config.js';

export const els = byId(
    'game', 'startScreen', 'levelsScreen', 'pauseScreen', 'resultScreen', 'resultBody',
    'playBtn', 'chooseBtn', 'backBtn', 'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn',
    'levelsCarousel', 'levelViewport', 'levelGrid', 'levelDots', 'prevPageBtn', 'nextPageBtn',
    'levelsTitle', 'levelsSub', 'progressLine', 'progressBar', 'progressNote',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'arcadeLink', 'aboutBtn', 'scoresLink'
);

export const topBarEl = document.querySelector('.topBar');

export const overlays = createOverlays({
    start: els.startScreen,
    levels: els.levelsScreen,
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
