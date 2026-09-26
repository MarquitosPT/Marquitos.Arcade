// Música de fundo do Maze Run: uma perseguição contra o relógio, ao piano, com
// bateria a acompanhar.
//
// Ré menor, com o Lá maior (e o seu Dó sustenido) a fechar cada frase, que é o
// acorde que deixa tudo em suspenso. O piano tem dois papéis: a mão esquerda
// num ostinato em semicolcheias que nunca pára — o relógio a andar — e a direita
// numa melodia curta e sincopada, de quem espreita à esquina. A bateria tem o
// bombo deslocado (no 1, no "e" do 1 e no 3), como passos a correr.
//
// A música segue o jogo (`setMusicMood`):
// - menu     — o ostinato, a melodia e o baixo, com um prato de choque a marcar os tempos;
// - correr   — entra a bateria toda e o baixo em colcheias;
// - pressa   — os últimos dez segundos: a música acelera, os pratos passam a
//              semicolcheias e a tarola ganha notas fantasma;
// - gelo     — os guardas congelados: bateria e baixo calam-se, e um sino de
//              vidro dobra a melodia duas oitavas acima;
// - suspenso — apanhado, ou o nível a acabar: só o ostinato.
//
// Piano: onda periódica com os harmónicos de uma corda, em duas cordas
// desafinadas, com um passa-baixo que fecha depois do martelo — curto e seco,
// para o ostinato não embaciar.
//
// O motor — o bus com o reverb e o compressor, o agendador, ligar e desligar —
// é o da arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';

const BPM = 126;
/** Nos últimos segundos do relógio a música aperta. */
const HURRY_BPM = 142;

// ---------- Partitura ----------

/** Tríade de cada acorde, na oitava do ostinato (entre Sib 3 e Mi 4). */
const CHORDS = {
    Dm: ['D4', 'F4', 'A4'],
    Bb: ['Bb3', 'D4', 'F4'],
    C: ['C4', 'E4', 'G4'],
    Gm: ['G3', 'Bb3', 'D4'],
    A: ['A3', 'C#4', 'E4']
};
for (const [name, notes] of Object.entries(CHORDS)) CHORDS[name] = notes.map(midi);

/**
 * Cada secção tem oito compassos (a pausa, quatro): a melodia (em colcheias,
 * 0.5 é uma semicolcheia), o acorde de cada compasso e a bateria.
 */
const SECTIONS = [
    {
        // A: a frase que se ouve do menu ao fim do nível.
        melody: [
            'D5 1.5, F5 1.5, A5 1, - 1, G5 0.5, F5 0.5, E5 1, F5 1',
            'D5 3, - 1, A4 1, C5 1, D5 1, E5 1',
            'F5 1.5, D5 1.5, Bb4 1, - 1, C5 1, D5 1, F5 1',
            'E5 1.5, G5 1.5, C6 2, Bb5 1, A5 1, G5 1',
            'D5 1.5, F5 1.5, A5 1, - 1, G5 0.5, F5 0.5, E5 1, F5 1',
            'A5 3, - 1, G5 1, F5 1, E5 1, D5 1',
            'Bb5 1.5, A5 1.5, G5 1, - 1, D5 1, E5 1, F5 1',
            'E5 1.5, C#5 1.5, A4 2, C#5 1, E5 1, - 1'
        ],
        chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'],
        drums: 'run'
    },
    {
        // B: mais alto e mais depressa, notas repetidas a empurrar.
        melody: [
            'D6 1, D6 0.5, C6 0.5, Bb5 1, F5 1, - 1, F5 1, G5 1, A5 1',
            'G5 1, G5 0.5, F5 0.5, E5 1, C5 1, - 1, C5 1, D5 1, E5 1',
            'F5 1.5, E5 1.5, D5 1, A5 2, F5 1, D5 1',
            'D5 6, - 2',
            'G5 1.5, Bb5 1.5, D6 1, - 1, C6 1, Bb5 1, A5 1',
            'Bb5 1.5, F5 1.5, D5 1, - 1, D5 1, E5 1, F5 1',
            'E5 1, F5 1, G5 1, A5 1, Bb5 1, A5 1, G5 1, F5 1',
            'E5 2, C#5 2, A4 2, - 2'
        ],
        chords: ['Bb', 'C', 'Dm', 'Dm', 'Gm', 'Bb', 'A', 'A'],
        drums: 'run'
    },
    {
        // C: a respiração — notas longas, timbalões, e um rufo a trazer o tema de volta.
        melody: ['A5 8', 'F5 8', 'G5 8', 'E5 4, C#5 4'],
        chords: ['Dm', 'Bb', 'Gm', 'A'],
        drums: 'toms'
    }
];

const BARS = SECTIONS.flatMap((section) =>
    section.melody.map((text, i) => ({
        melody: bar(text),
        chord: CHORDS[section.chords[i]],
        drums: section.drums,
        fill: section.drums === 'run' && i === section.melody.length - 1,
        roll: section.drums === 'toms' && i === section.melody.length - 1,
        crash: i === 0
    }))
);

/**
 * O ostinato: índices na tríade (0 fundamental, 1 terceira, 2 quinta, 3 a
 * fundamental uma oitava acima), um por semicolcheia, repetido a cada meio
 * compasso. Sobe e desce sem parar, como um ponteiro.
 */
const OSTINATO = [0, 2, 3, 2, 1, 2, 3, 2];

// ---------- Humor ----------

/** @typedef {'menu'|'run'|'hurry'|'frozen'|'hold'} Mood */

/** @type {Mood} */
let mood = 'menu';

/**
 * Diz à música o que se passa no jogo; muda na semicolcheia seguinte (o
 * andamento, no compasso seguinte). Pode chamar-se a cada frame.
 * @param {Mood} value
 */
export function setMusicMood(value) {
    if (value === mood) return;
    const wasHurry = mood === 'hurry';
    mood = value;
    if (wasHurry !== (mood === 'hurry')) music.setBpm(mood === 'hurry' ? HURRY_BPM : BPM);
}

// ---------- Bus ----------

/** O bus onde se está a tocar (o do jogo, ou um OfflineAudioContext a gravar): chega em cada passo. */
let bus = null;

const PIANO_PARTIALS = [0, 1, 0.65, 0.38, 0.25, 0.16, 0.1, 0.07, 0.045, 0.03];

/** Duração de uma semicolcheia agora (com pressa, mais curta). */
const step = () => music.stepSeconds;

// ---------- Instrumentos ----------

function piano(time, m, duration, velocity, pan = 0, send = 0.28) {
    const { ctx, pianoWave } = bus;
    const f = freq(m);
    const ring = Math.min(1.1, Math.max(0.35, 0.95 - (m - 60) * 0.03));
    const end = time + Math.max(duration, 0.08);
    const stopAt = end + 0.3;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(velocity, time + 0.004);
    out.gain.setTargetAtTime(velocity * 0.4, time + 0.004, 0.07);
    out.gain.setTargetAtTime(0.0001, time + 0.15, ring);
    // O abafador.
    out.gain.setTargetAtTime(0, end, 0.05);

    const bright = Math.min(f * (5 + velocity * 14), 9000);
    const tone = bus.filter('lowpass', bright, 0.4);
    tone.frequency.setValueAtTime(bright, time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(f * 1.8, 260), time + 0.8);
    tone.connect(out);

    for (const detune of [-3, 3.5]) {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(pianoWave);
        osc.frequency.value = f;
        osc.detune.value = detune;
        osc.connect(tone);
        osc.start(time);
        osc.stop(stopAt);
    }

    // O martelo.
    const hammer = bus.noise(time, time + 0.04);
    const hammerBand = bus.filter('bandpass', Math.min(f * 3, 4500), 1.5);
    const hammerGain = ctx.createGain();
    hammerGain.gain.setValueAtTime(velocity * 0.2, time);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    hammer.connect(hammerBand);
    hammerBand.connect(hammerGain);
    hammerGain.connect(out);

    bus.route(out, time, { pan, send });
}

/** Sino de vidro para o gelo: dois senos inarmónicos, a ressoar. */
function glass(time, m, velocity) {
    const { ctx } = bus;
    const f = freq(m);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(velocity, time + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);
    for (const [ratio, level] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * ratio;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g);
        g.connect(out);
        osc.start(time);
        osc.stop(time + 1.45);
    }
    bus.route(out, time, { pan: 0.3, send: 0.6 });
}

function bass(time, m, duration, velocity) {
    const { ctx } = bus;
    const lp = bus.filter('lowpass', 700, 1.4);
    lp.frequency.setValueAtTime(1400, time);
    lp.frequency.exponentialRampToValueAtTime(380, time + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.005);
    g.gain.setTargetAtTime(velocity * 0.55, time + 0.005, 0.08);
    g.gain.setTargetAtTime(0, time + duration, 0.025);
    for (const type of ['sawtooth', 'triangle']) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq(m);
        osc.connect(lp);
        osc.start(time);
        osc.stop(time + duration + 0.12);
    }
    lp.connect(g);
    bus.route(g, time, { send: 0.04 });
}

function kick(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.35);
    bus.route(g, time, { send: 0.04 });
}

function snare(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(velocity * 0.6, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    osc.connect(og);
    osc.start(time);
    osc.stop(time + 0.12);

    const n = bus.noise(time, time + 0.2);
    const hp = bus.filter('highpass', 1500, 0.7);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, time);
    ng.gain.linearRampToValueAtTime(velocity, time + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    n.connect(hp);
    hp.connect(ng);

    const out = ctx.createGain();
    og.connect(out);
    ng.connect(out);
    bus.route(out, time, { pan: -0.08, send: 0.2 });
}

function hat(time, velocity, open = false) {
    const { ctx } = bus;
    const length = open ? 0.28 : 0.04;
    const n = bus.noise(time, time + length + 0.02);
    const hp = bus.filter('highpass', 7800, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + length);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: 0.3, send: 0.05 });
}

function crash(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 1.5);
    const hp = bus.filter('highpass', 4500, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.setTargetAtTime(0.0001, time + 0.004, 0.4);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: -0.3, send: 0.3 });
}

function tom(time, pitch, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, time + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.32);
    bus.route(g, time, { pan: pitch > 120 ? 0.25 : -0.25, send: 0.18 });
}

// ---------- Partes ----------

const human = (spread = 0.2) => 1 - spread / 2 + Math.random() * spread;

function playOstinato(b, s, time) {
    const [root, third, fifth] = b.chord;
    const notes = [root, third, fifth, root + 12];
    const m = notes[OSTINATO[s % 8]];
    // Acento no início de cada tempo; no suspenso, mais baixinho.
    const velocity = (s % 4 === 0 ? 0.1 : 0.068) * (mood === 'hold' ? 0.75 : 1) * human(0.12);
    piano(time, m, step() * 0.9, velocity, -0.2, 0.2);
}

function playMelody(b, s, time) {
    if (mood === 'hold') return;
    for (const note of b.melody) {
        if (note.step !== s) continue;
        const duration = note.steps * step() * 0.85;
        const accent = s % 4 === 0 ? 1 : 0.9;
        piano(time, note.midi, duration, 0.2 * accent * human(0.1), 0.15);
        if (mood === 'frozen') glass(time, note.midi + 24, 0.05 * human(0.1));
    }
}

function playBass(b, s, time) {
    if (mood === 'frozen' || mood === 'hold') return;
    const root = b.chord[0] - 24;
    if (mood === 'menu' || b.drums === 'toms') {
        if (s === 0) bass(time, root, step() * 15, 0.11);
        return;
    }
    // Colcheias (com pressa, semicolcheias) na fundamental, a oitava no fim de cada tempo.
    const every = mood === 'hurry' ? 1 : 2;
    if (s % every !== 0) return;
    const up = s % 4 === 3 || (every === 2 && s % 8 === 6);
    bass(time, root + (up ? 12 : 0), step() * every * 0.8, (s % 4 === 0 ? 0.12 : 0.09) * human(0.1));
}

function playDrums(b, s, time) {
    if (mood === 'frozen' || mood === 'hold') return;

    if (mood === 'menu') {
        if (s % 4 === 0) hat(time, 0.03 * human());
        return;
    }

    if (b.crash && s === 0) crash(time, 0.1);

    if (b.drums === 'toms') {
        // Timbalões em colcheias, graves; no fim, o rufo de tarola a crescer.
        if (s === 0) kick(time, 0.5);
        if (b.roll) {
            if (s >= 4) snare(time, (0.04 + (s / 15) * 0.12) * human(0.1));
        } else if (s % 2 === 0) {
            tom(time, s % 8 === 0 ? 98 : s % 4 === 0 ? 131 : 110, (s % 4 === 0 ? 0.26 : 0.17) * human(0.1));
        }
        return;
    }

    const hurry = mood === 'hurry';
    // Passos a correr: bombo no 1, no "e" do 1 e no 3 (com pressa, também no "e" do 3).
    if (s === 0 || s === 3 || s === 8 || (hurry && s === 11)) kick(time, s === 3 || s === 11 ? 0.4 : 0.58);
    if (s === 4 || (s === 12 && !b.fill)) snare(time, 0.16 * human(0.1));
    // Notas fantasma na tarola, só com pressa.
    if (hurry && (s === 7 || s === 15) && !b.fill) snare(time, 0.045 * human());

    if (b.fill && s >= 12) {
        if (s === 12) snare(time, 0.13);
        if (s === 13) snare(time, 0.09);
        if (s === 14) tom(time, 150, 0.28);
        if (s === 15) tom(time, 105, 0.3);
        return;
    }

    if (hurry) hat(time, (s % 2 === 0 ? 0.055 : 0.03) * human());
    else if (s % 2 === 0) hat(time, (s % 4 === 2 ? 0.055 : 0.038) * human(), s === 14);
}

// ---------- Agendador ----------

function scheduleStep(b, s, time) {
    playOstinato(b, s, time);
    playMelody(b, s, time);
    playBass(b, s, time);
    playDrums(b, s, time);
}

export const music = createMusic({
    audio,
    storageKey: 'mazeRunMusic_v1',
    bpm: BPM,
    bars: BARS.length,
    // Por baixo dos efeitos: o "tic" dos últimos segundos tem de se ouvir.
    volume: 0.32,
    fadeIn: 1.2,
    fadeOut: 0.4,
    lookaheadMs: 25,
    compressor: { threshold: -16, knee: 10, ratio: 3.5, attack: 0.006, release: 0.2 },
    // Uma sala escura e não muito grande: corredores de pedra.
    reverb: { seconds: 1.8, decay: 2.8, wet: 0.75 },
    setup: ({ ctx }) => ({
        pianoWave: ctx.createPeriodicWave(new Float32Array(PIANO_PARTIALS.length), new Float32Array(PIANO_PARTIALS))
    }),
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});
