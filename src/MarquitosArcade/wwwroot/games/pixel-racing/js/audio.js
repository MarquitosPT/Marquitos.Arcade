// Som do Pixel Racing: bips de interface mais um motor sintetizado contínuo.
//
// O motor é um oscilador em dente de serra a passar por um filtro passa-baixo.
// Não se liga e desliga — fica sempre a tocar com ganho zero, e a rotação e o
// brilho acompanham a velocidade. Arrancar e parar o oscilador a cada mudança
// daria estalidos.

import { createAudio } from '/lib/arcade/audio.js';

const audio = createAudio({ defaultType: 'square' });

let engineOsc = null;
let engineFilter = null;
let engineGain = null;

/** Tem de ser chamado a partir de um gesto do utilizador (clique ou toque). */
export function resumeAudio() {
    const created = !audio.context;
    const ctx = audio.resume();
    if (!ctx || !created) return ctx;

    engineOsc = ctx.createOscillator();
    engineFilter = ctx.createBiquadFilter();
    engineGain = ctx.createGain();

    engineOsc.type = 'sawtooth';
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 400;
    engineGain.gain.value = 0;

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();

    return ctx;
}

const beep = (...args) => audio.beep(...args);

export const sfx = {
    /** Cada número da contagem decrescente. */
    tick: () => beep(520, 0.12, 'square', 0.2),
    /** Partida. */
    go: () => {
        beep(660, 0.1, 'square', 0.22);
        beep(880, 0.16, 'square', 0.22, 0.12);
        beep(1180, 0.22, 'square', 0.24, 0.26);
    },
    /** Passagem por uma almofada de boost. */
    pad: () => {
        beep(920, 0.08, 'sine', 0.2);
        beep(1300, 0.12, 'sine', 0.18, 0.05);
    },
    boost: () => {
        for (let i = 0; i < 6; i++) beep(300 + i * 90, 0.06, 'sawtooth', 0.1, i * 0.02);
    },
    /** Drift longo o suficiente para dar boost cheio. */
    driftPerfect: () => {
        beep(700, 0.08, 'triangle', 0.2);
        beep(1050, 0.14, 'triangle', 0.2, 0.08);
    },
    /** Encontrão noutro carro. */
    bump: () => beep(110, 0.1, 'square', 0.2),
    /** Embate na parede. */
    wall: () => beep(90, 0.12, 'sawtooth', 0.18),
    lap: () => {
        beep(600, 0.08, 'square', 0.16);
        beep(900, 0.1, 'square', 0.16, 0.09);
    },
    finish: () => {
        [660, 880, 990, 1320].forEach((f, i) => beep(f, 0.16, 'square', 0.22, i * 0.14));
    }
};

/**
 * Acompanha o motor à velocidade do carro do jogador.
 * @param {number} speedFrac 0 parado, 1 na velocidade máxima.
 * @param {boolean} boosting Com boost, sobe mais a rotação e o volume.
 */
export function updateEngineSound(speedFrac, boosting) {
    if (!engineGain) return;
    const now = audio.context.currentTime;
    // Rampas curtas em vez de saltos: o valor muda a cada frame e uma atribuição
    // direta ouvir-se-ia como estalido.
    engineGain.gain.linearRampToValueAtTime(0.05 + speedFrac * 0.05 + (boosting ? 0.04 : 0), now + 0.05);
    engineOsc.frequency.linearRampToValueAtTime(70 + speedFrac * 180 + (boosting ? 60 : 0), now + 0.05);
    engineFilter.frequency.linearRampToValueAtTime(300 + speedFrac * 900, now + 0.05);
}

/** Cala o motor (pausa, fim de corrida, menu). */
export function muteEngine() {
    if (engineGain) engineGain.gain.linearRampToValueAtTime(0, audio.context.currentTime + 0.1);
}
