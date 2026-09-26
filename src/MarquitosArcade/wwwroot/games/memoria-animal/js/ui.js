// Elementos do ecrã e os ecrãs sobrepostos (menu, níveis, como jogar, pausa, resultados).

import { byId, createAboutDialog, createOverlays, createTopBar } from '/lib/arcade/index.js';
import { ABOUT } from './config.js';

export const els = byId(
    'playArea', 'stage', 'board', 'banner', 'hud', 'hudLevel', 'hudTime', 'hudPairs', 'hudErrors',
    'startScreen', 'levelsScreen', 'howtoScreen', 'pauseScreen', 'resultScreen', 'resultBody',
    'playBtn', 'chooseBtn', 'howtoBtn', 'backBtn', 'howtoBackBtn', 'resumeBtn', 'quitBtn', 'pauseBtn', 'endBtn',
    'levelGrid', 'levelsSub', 'progressLine', 'progressBar', 'progressNote',
    'animalGallery', 'howtoLastLevel',
    'nameSlot', 'nameRow', 'accountRow', 'accountName', 'accountInitial', 'playerNameInput',
    'arcadeLink', 'aboutBtn'
);

export const overlays = createOverlays({
    start: els.startScreen,
    levels: els.levelsScreen,
    howto: els.howtoScreen,
    pause: els.pauseScreen,
    result: els.resultScreen
});

export const topBar = createTopBar({
    arcadeLink: els.arcadeLink,
    aboutBtn: els.aboutBtn,
    pauseBtn: els.pauseBtn,
    endBtn: els.endBtn
});

/** Janela "Acerca", aberta pelo botão da barra de topo. */
export const about = createAboutDialog(ABOUT, { opener: els.aboutBtn });
