// Elementos do ecrã e os três ecrãs sobrepostos (menu, pausa, resultados).

import { byId, createOverlays, createTopBar } from '/lib/arcade/index.js';

export const els = byId(
    'game', 'startScreen', 'pauseScreen', 'resultScreen', 'resultBody',
    'startBtn', 'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn',
    'modeRow', 'trackRow', 'diffRow', 'playerNameInput',
    'arcadeLink', 'scoresLink'
);

export const topBarEl = document.querySelector('.topBar');

export const overlays = createOverlays({
    start: els.startScreen,
    pause: els.pauseScreen,
    result: els.resultScreen
});

export const topBar = createTopBar({
    arcadeLink: els.arcadeLink,
    scoresLink: els.scoresLink,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});
