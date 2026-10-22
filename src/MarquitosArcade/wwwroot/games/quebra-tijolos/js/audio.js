// Efeitos sonoros do Quebra-Tijolos: bips de máquina de salão, secos e curtos.
//
// O tijolo soa mais agudo quanto mais acima estiver, e uma série de tijolos
// seguidos sem a bola voltar à raquete sobe a escala — ouve-se a jogada a correr bem.

import { createAudio } from '/lib/arcade/audio.js';

/** Partilhado com a música (js/music.js): um só AudioContext para o jogo todo. */
export const audio = createAudio({ defaultType: 'square', defaultVolume: 0.13, attack: 0.002 });

export const resumeAudio = audio.resume;

/** Lá menor pentatónica, para a escala dos tijolos seguidos. */
const CHAIN_SCALE = [440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

export const sfx = {
    paddle: (offset = 0) => {
        audio.beep(330 + Math.abs(offset) * 90, 0.06, 'square', 0.12);
        audio.beep(165, 0.05, 'triangle', 0.14);
    },
    wall: () => audio.beep(220, 0.03, 'square', 0.06),
    brick: (chain = 0) => {
        const f = CHAIN_SCALE[Math.min(CHAIN_SCALE.length - 1, chain)];
        audio.beep(f, 0.07, 'square', 0.11);
        audio.beep(f * 2, 0.04, 'triangle', 0.05, 0.01);
    },
    /** Golpe num tijolo que ainda não partiu (prata, titânio): metálico. */
    clank: () => {
        audio.beep(1480, 0.05, 'square', 0.08);
        audio.beep(2220, 0.08, 'triangle', 0.06, 0.005);
    },
    /** Ricochete no aço. */
    steel: () => {
        audio.beep(880, 0.04, 'square', 0.07);
        audio.beep(1320, 0.1, 'sine', 0.06, 0.01);
    },
    boom: () => {
        audio.beep(120, 0.32, 'sawtooth', 0.2);
        audio.beep(70, 0.42, 'square', 0.15, 0.02);
        audio.beep(45, 0.5, 'sine', 0.22, 0.04);
    },
    capsule: () => {
        [659, 880, 1175, 1568].forEach((f, i) => audio.beep(f, 0.08, 'triangle', 0.13, i * 0.05));
    },
    laser: () => audio.beep(1760, 0.05, 'sawtooth', 0.05),
    launch: () => {
        audio.beep(523, 0.05, 'square', 0.1);
        audio.beep(784, 0.08, 'square', 0.1, 0.04);
    },
    lost: () => {
        audio.beep(392, 0.12, 'square', 0.13);
        audio.beep(294, 0.14, 'square', 0.13, 0.11);
        audio.beep(196, 0.3, 'triangle', 0.16, 0.24);
    },
    clear: () => {
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => audio.beep(f, 0.12, 'square', 0.11, i * 0.08));
    },
    gameOver: () => {
        [392, 370, 349, 330].forEach((f, i) => audio.beep(f, 0.22, 'square', 0.12, i * 0.2));
        audio.beep(165, 0.6, 'triangle', 0.18, 0.8);
    }
};
