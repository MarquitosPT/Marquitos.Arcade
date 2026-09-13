// Elementos do ecrã e os ecrãs sobrepostos (menu, pista, pausa, resultados).

import { byId, createOverlays, createTopBar } from '/lib/arcade/index.js';

export const els = byId(
    'game', 'startScreen', 'setupScreen', 'pauseScreen', 'resultScreen', 'resultBody',
    'startBtn', 'backBtn', 'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn',
    'modeRow', 'trackRow', 'colorRow', 'diffRow', 'setupTitle', 'setupSub',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'arcadeLink', 'scoresLink'
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
    scoresLink: els.scoresLink,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});
