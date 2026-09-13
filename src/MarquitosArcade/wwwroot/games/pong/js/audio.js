// Efeitos sonoros do Pong: ondas quadradas, como na arcada original.

import { createAudio } from '/lib/arcade/audio.js';

const audio = createAudio({ defaultType: 'square' });

/** Tem de ser chamado a partir de um gesto do utilizador (o botão JOGAR). */
export const resumeAudio = audio.resume;

export const sfx = {
    /** Raquetada. */
    paddle: () => audio.beep(440, 0.07, 'square', 0.18),
    /** Bola na parede lateral. */
    wall: () => audio.beep(220, 0.06, 'square', 0.14),
    /** Ponto marcado: duas notas a descer. */
    score: () => {
        audio.beep(160, 0.12, 'square', 0.2);
        audio.beep(100, 0.18, 'square', 0.18, 0.09);
    }
};
