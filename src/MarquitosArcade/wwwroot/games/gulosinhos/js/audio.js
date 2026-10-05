// Efeitos sonoros dos Gulosinhos: bips redondos (triângulo e seno), para soar
// a desenho animado e não a máquina de moedas.

import { createAudio } from '/lib/arcade/audio.js';

/** Partilhado com a música (js/music.js): um só AudioContext para o jogo todo. */
export const audio = createAudio({ defaultType: 'triangle', defaultVolume: 0.14, attack: 0.004 });

export const resumeAudio = audio.resume;

/** Cada guloseima seguida soa um pouco mais alto, até cair outra vez ao fim de uma pausa. */
let candyStreak = 0;
let candyStreakAt = 0;
const CANDY_SCALE = [784, 880, 988, 1047, 1175, 1319, 1397, 1568];

export const sfx = {
    jump: () => {
        audio.beep(392, 0.07, 'square', 0.06);
        audio.beep(587, 0.09, 'triangle', 0.1, 0.03);
    },
    land: () => audio.beep(160, 0.05, 'sine', 0.08),
    candy: () => {
        const now = performance.now();
        candyStreak = now - candyStreakAt < 700 ? Math.min(CANDY_SCALE.length - 1, candyStreak + 1) : 0;
        candyStreakAt = now;
        audio.beep(CANDY_SCALE[candyStreak], 0.07, 'triangle', 0.12);
        audio.beep(CANDY_SCALE[candyStreak] * 2, 0.05, 'sine', 0.05, 0.03);
    },
    bigCandy: () => {
        audio.beep(784, 0.08, 'triangle', 0.15);
        audio.beep(1047, 0.08, 'triangle', 0.15, 0.08);
        audio.beep(1319, 0.08, 'triangle', 0.15, 0.16);
        audio.beep(1568, 0.2, 'triangle', 0.15, 0.24);
    },
    stomp: () => {
        audio.beep(520, 0.05, 'square', 0.1);
        audio.beep(260, 0.12, 'triangle', 0.14, 0.04);
    },
    spring: () => {
        audio.beep(300, 0.06, 'triangle', 0.14);
        audio.beep(600, 0.08, 'triangle', 0.14, 0.05);
        audio.beep(1200, 0.12, 'sine', 0.1, 0.1);
    },
    hurt: () => {
        audio.beep(330, 0.1, 'square', 0.12);
        audio.beep(220, 0.18, 'square', 0.12, 0.08);
    },
    fall: () => {
        audio.beep(600, 0.12, 'triangle', 0.13);
        audio.beep(400, 0.14, 'triangle', 0.13, 0.12);
        audio.beep(250, 0.22, 'triangle', 0.13, 0.26);
    },
    /** A bomba a contar: um tique por segundo. */
    tick: (last = false) => audio.beep(last ? 1320 : 990, 0.05, 'square', 0.09),
    boom: () => {
        audio.beep(110, 0.35, 'sawtooth', 0.2);
        audio.beep(70, 0.45, 'square', 0.16, 0.03);
        audio.beep(55, 0.5, 'sine', 0.2, 0.06);
    },
    checkpoint: () => {
        audio.beep(523, 0.09, 'triangle', 0.14);
        audio.beep(784, 0.16, 'triangle', 0.14, 0.09);
    },
    clear: () => {
        [523, 659, 784, 1047, 1319].forEach((f, i) => audio.beep(f, 0.14, 'triangle', 0.16, i * 0.09));
    },
    fail: () => {
        audio.beep(392, 0.16, 'triangle', 0.15);
        audio.beep(311, 0.18, 'triangle', 0.15, 0.15);
        audio.beep(262, 0.34, 'triangle', 0.15, 0.32);
    },
    count: () => audio.beep(523, 0.08, 'triangle', 0.13),
    go: () => audio.beep(1047, 0.18, 'triangle', 0.15)
};
