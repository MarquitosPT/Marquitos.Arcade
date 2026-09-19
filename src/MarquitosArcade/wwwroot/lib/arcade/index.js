// SDK da Marquitos Arcade — o que os jogos partilham entre si.
//
// Importar a partir daqui puxa o SDK todo:
//     import { createAudio, createViewport } from '/lib/arcade/index.js';
//
// ou, para carregar só o que se usa, direto do módulo:
//     import { createAudio } from '/lib/arcade/audio.js';

export { createAudio } from './audio.js';
export { $, $$, byId, escapeHtml, createOverlays, createButtonGroup } from './dom.js';
export { createLoop } from './loop.js';
export { clamp, lerp, lerpAngle, normAngle, pick, rand, shuffle } from './math.js';
export { createProgressClient } from './progress.js';
export { bindPlayerNameInput, createScoreClient, fetchAccountDisplayName } from './scores.js';
export { createSplash } from './splash.js';
export { readJson, readSessionText, readText, writeJson, writeSessionText, writeText } from './storage.js';
export { createTopBar } from './topbar.js';
export { createViewport } from './viewport.js';
