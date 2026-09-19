// Elementos do ecrã e os ecrãs sobrepostos (menu, níveis, pausa, resultados).

import { byId, createOverlays, createTopBar } from '/lib/arcade/index.js';

export const els = byId(
    'game', 'startScreen', 'levelsScreen', 'pauseScreen', 'resultScreen', 'resultBody',
    'playBtn', 'chooseBtn', 'backBtn', 'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn',
    'levelsCarousel', 'levelViewport', 'levelGrid', 'levelDots', 'prevPageBtn', 'nextPageBtn',
    'levelsTitle', 'levelsSub', 'progressLine', 'progressBar', 'progressNote',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'arcadeLink', 'scoresLink'
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
    scoresLink: els.scoresLink,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});
