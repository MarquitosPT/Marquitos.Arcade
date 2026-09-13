// Efeitos sonoros da tasca. Ondas suaves (sine/triangle) para os acertos e
// serradas (sawtooth) para os erros — dá para perceber o que aconteceu sem olhar.

import { createAudio } from '/lib/arcade/audio.js';

// O ataque de 10 ms tira o "click" seco do arranque de cada nota, que numa
// cozinha cheia de bips seguidos se tornava incómodo.
export const audio = createAudio({ defaultType: 'sine', attack: 0.01 });

/** Tem de ser chamado a partir de um gesto do utilizador. */
export const resumeAudio = audio.resume;

const beep = (...args) => audio.beep(...args);

/** Ingrediente certo na travessa. */
export const sfxTap = () => beep(720, 0.08, 'sine', 0.12);

/** Ingrediente errado, ou campainha antes de o prato estar pronto. */
export const sfxWrong = () => {
    beep(190, 0.16, 'square', 0.13);
    beep(150, 0.18, 'square', 0.11, 0.06);
};

/** Prato servido: três notas a subir. */
export const sfxServe = () => {
    beep(660, 0.12, 'triangle', 0.16);
    beep(880, 0.14, 'triangle', 0.16, 0.1);
    beep(1100, 0.2, 'triangle', 0.16, 0.2);
};

/** Cliente foi-se embora: três notas a descer. */
export const sfxLoseLife = () => {
    beep(320, 0.22, 'sawtooth', 0.14);
    beep(240, 0.26, 'sawtooth', 0.14, 0.18);
    beep(170, 0.35, 'sawtooth', 0.14, 0.36);
};

/** Toque de interface (botões, separadores). */
export const sfxClick = () => beep(500, 0.05, 'sine', 0.1);

/** Fim do turno. */
export const sfxGameOver = () => {
    beep(400, 0.2, 'sawtooth', 0.14);
    beep(320, 0.2, 'sawtooth', 0.14, 0.2);
    beep(240, 0.28, 'sawtooth', 0.14, 0.4);
    beep(160, 0.4, 'sawtooth', 0.14, 0.6);
};
