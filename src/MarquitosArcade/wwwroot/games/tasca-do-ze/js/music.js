// Música de fundo, gerada nota a nota com osciladores.
//
// Sem ficheiros de áudio: não pesa no carregamento do jogo nem depende de
// licenças de samples. Toca em loop enquanto o turno decorre.
//
// O agendamento é o padrão do Web Audio: um setTimeout grosseiro acorda de 30 em
// 30 ms e marca com precisão de amostra todas as notas dos próximos 120 ms. O
// relógio do setTimeout é irregular demais para servir de metrónomo; o do
// AudioContext não é.

import { audio } from './audio.js';

const BPM = 104;
/** Duração de uma colcheia, em segundos. */
const STEP_DUR = 60 / BPM / 2;
/** O ganho mestre só liga/desliga (mudo); o volume real vem do `vol` de cada nota. */
const VOLUME = 1;

/** Ré menor pentatónica: D4 F4 G4 A4 C5 D5. */
const SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
/** Índices na escala; -1 é pausa. */
const MELODY = [
    0, 1, 2, 1, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0, -1,
    1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 1, 2, 1, 0, -1
];
const BASS = [0, 1, 2, 0, 1, 2, 3, 0];

/** Quanto tempo de música se marca à frente do relógio, em segundos. */
const SCHEDULE_AHEAD = 0.12;
/** De quanto em quanto tempo o agendador acorda, em ms. */
const LOOKAHEAD_MS = 30;

let gainNode = null;
let playing = false;
let timerId = null;
let step = 0;
let nextNoteTime = 0;

function ensureGain() {
    const ctx = audio.context;
    if (!ctx) return null;
    if (!gainNode) {
        gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);
    }
    gainNode.gain.value = audio.muted ? 0 : VOLUME;
    return gainNode;
}

function playNote(freq, time, duration, type, volume) {
    const ctx = audio.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(gainNode);
    osc.start(time);
    osc.stop(time + duration + 0.05);
}

function scheduler() {
    const ctx = audio.context;
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
        const index = step % MELODY.length;
        const melodyNote = MELODY[index];
        if (melodyNote >= 0) {
            playNote(SCALE[melodyNote], nextNoteTime, STEP_DUR * 0.9, 'triangle', 0.09);
        }
        // O baixo entra a cada semínima (quatro colcheias), uma oitava abaixo.
        if (index % 4 === 0) {
            const bassNote = BASS[Math.floor(index / 4) % BASS.length];
            playNote(SCALE[bassNote] / 2, nextNoteTime, STEP_DUR * 4 * 0.85, 'sine', 0.07);
        }
        nextNoteTime += STEP_DUR;
        step += 1;
    }
    timerId = setTimeout(scheduler, LOOKAHEAD_MS);
}

export function startMusic() {
    if (!audio.context || playing) return;
    ensureGain();
    playing = true;
    step = 0;
    nextNoteTime = audio.context.currentTime + 0.05;
    scheduler();
}

export function stopMusic() {
    playing = false;
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
}

/** Acompanha o botão de som: o ganho mestre da música vai a zero quando está mudo. */
export function applyMute() {
    if (gainNode) gainNode.gain.value = audio.muted ? 0 : VOLUME;
}
