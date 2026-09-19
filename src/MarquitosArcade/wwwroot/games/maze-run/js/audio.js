// Efeitos sonoros do Maze Run: ondas quadradas, como nos labirintos de moeda.

import { createAudio } from '/lib/arcade/audio.js';

const audio = createAudio({ defaultType: 'square', defaultVolume: 0.14 });

/** Tem de ser chamado a partir de um gesto do utilizador (o botão de arranque). */
export const resumeAudio = audio.resume;

/** Cada cristal soa um pouco mais alto do que o anterior — ouve-se o nível a encher. */
const crystalStep = (index, total) => 520 + Math.round((index / Math.max(1, total)) * 420);

export const sfx = {
    /** Cristal apanhado. */
    crystal: (index = 0, total = 1) => audio.beep(crystalStep(index, total), 0.06, 'square', 0.13),
    /** Todos os cristais apanhados: a saída abriu. */
    exitOpen: () => {
        audio.beep(420, 0.1, 'triangle', 0.16);
        audio.beep(630, 0.14, 'triangle', 0.16, 0.09);
    },
    /** Cristal de gelo: escala a subir, cristalina. */
    freeze: () => {
        audio.beep(880, 0.08, 'triangle', 0.15);
        audio.beep(1174, 0.1, 'triangle', 0.15, 0.07);
        audio.beep(1568, 0.16, 'triangle', 0.13, 0.15);
    },
    /** O gelo derreteu: os guardas voltam a andar. */
    thaw: () => audio.beep(300, 0.14, 'triangle', 0.11),
    /** Chave apanhada: a porta destrancou-se. */
    unlock: () => {
        audio.beep(392, 0.08, 'square', 0.16);
        audio.beep(587, 0.16, 'square', 0.16, 0.08);
    },
    /** Apanhado por um guarda. */
    caught: () => {
        audio.beep(180, 0.16, 'sawtooth', 0.2);
        audio.beep(110, 0.26, 'sawtooth', 0.18, 0.12);
    },
    /** Nível concluído. */
    clear: () => {
        audio.beep(523, 0.1, 'triangle', 0.18);
        audio.beep(659, 0.1, 'triangle', 0.18, 0.1);
        audio.beep(880, 0.22, 'triangle', 0.18, 0.2);
    },
    /** Tempo esgotado ou vidas esgotadas. */
    fail: () => {
        audio.beep(300, 0.18, 'square', 0.16);
        audio.beep(200, 0.3, 'square', 0.15, 0.16);
    },
    /** Cada número da contagem decrescente. */
    tick: () => audio.beep(330, 0.07, 'square', 0.12),
    /** O "vai!". */
    go: () => audio.beep(660, 0.16, 'square', 0.16),
    /** Os últimos dez segundos do relógio. */
    hurry: () => audio.beep(240, 0.05, 'square', 0.1)
};
