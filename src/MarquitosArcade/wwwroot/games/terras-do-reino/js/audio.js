// Efeitos sonoros do Terras do Reino: notas de triângulo, suaves, como um
// alaúde de feira — um jogo de economia ouve-se durante horas e não pode picar.

import { createAudio } from '/lib/arcade/audio.js';

const audio = createAudio({ defaultType: 'triangle', defaultVolume: 0.12, attack: 0.01 });

/** Tem de ser chamado a partir de um gesto do utilizador (o botão de arranque). */
export const resumeAudio = audio.resume;

export const sfx = {
    /** Um edifício novo. */
    build: () => {
        audio.beep(220, 0.08, 'square', 0.08);
        audio.beep(330, 0.12, 'triangle', 0.12, 0.07);
    },
    /** Semear um campo. */
    plant: () => audio.beep(520, 0.08, 'triangle', 0.1),
    /** Colher: duas notas a subir. */
    harvest: () => {
        audio.beep(587, 0.08, 'triangle', 0.12);
        audio.beep(784, 0.12, 'triangle', 0.12, 0.07);
    },
    /** Moedas a entrar (venda no mercado). */
    coins: () => {
        audio.beep(988, 0.05, 'square', 0.06);
        audio.beep(1319, 0.09, 'square', 0.06, 0.05);
    },
    /** O castelo subiu de nível. */
    upgrade: () => {
        [392, 523, 659, 784].forEach((f, i) => audio.beep(f, 0.18, 'triangle', 0.14, i * 0.1));
    },
    /** Objetivo cumprido. */
    quest: () => {
        audio.beep(659, 0.1, 'triangle', 0.13);
        audio.beep(880, 0.18, 'triangle', 0.13, 0.1);
    },
    /** Não se pode. */
    nope: () => audio.beep(160, 0.14, 'square', 0.08),
    /** Toque num botão ou numa casa. */
    click: () => audio.beep(700, 0.03, 'triangle', 0.06)
};
