// Efeitos sonoros da Memória Animal: notas de triângulo, redondas e baixas —
// é um jogo calmo, e as cartas viram-se muitas vezes.

import { createAudio } from '/lib/arcade/audio.js';

const audio = createAudio({ defaultType: 'triangle', defaultVolume: 0.14, attack: 0.008 });

/** Tem de ser chamado a partir de um gesto do utilizador (o botão de jogar). */
export const resumeAudio = audio.resume;

/** Cada par soa um pouco mais alto do que o anterior — ouve-se o tabuleiro a encher. */
const pairStep = (found, total) => 523 + Math.round((found / Math.max(1, total)) * 400);

export const sfx = {
    /** Uma carta virada. */
    flip: () => audio.beep(740, 0.04, 'triangle', 0.08),
    /** Par encontrado. */
    match: (found = 0, total = 1) => {
        const f = pairStep(found, total);
        audio.beep(f, 0.09, 'triangle', 0.15);
        audio.beep(f * 1.5, 0.14, 'triangle', 0.14, 0.08);
    },
    /** Duas cartas diferentes. */
    miss: () => audio.beep(220, 0.14, 'sine', 0.12),
    /** As cartas viram-se: começa o jogo. */
    go: () => {
        audio.beep(392, 0.07, 'triangle', 0.12);
        audio.beep(587, 0.12, 'triangle', 0.12, 0.07);
    },
    /** Nível concluído. */
    clear: () => {
        audio.beep(523, 0.1, 'triangle', 0.18);
        audio.beep(659, 0.1, 'triangle', 0.18, 0.1);
        audio.beep(784, 0.1, 'triangle', 0.18, 0.2);
        audio.beep(1047, 0.26, 'triangle', 0.18, 0.3);
    }
};
