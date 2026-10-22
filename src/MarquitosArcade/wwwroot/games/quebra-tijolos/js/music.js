// Música de fundo do Quebra-Tijolos: um tema de salão de jogos dos anos 80,
// em synthwave — lá menor, a 136 BPM, com a energia de quem não quer deixar
// cair a bola.
//
// Tudo sintetizado, sem ficheiros de áudio (como os efeitos em audio.js):
//
// - Baixo: dois dentes de serra desafinados por um passa-baixo que abre e
//   fecha a cada nota, em colcheias a saltar à oitava — o motor da música.
// - Arpejo: onda quadrada curtinha, em semicolcheias, a correr as notas do
//   acorde para cima e para baixo, com eco à esquerda e à direita.
// - Solo: três osciladores (dois dentes de serra desafinados e uma quadrada
//   uma oitava abaixo) por um filtro, com vibrato nas notas longas. No fim,
//   dobrado à oitava.
// - Pad: acordes de dentes de serra com ataque lento, na pausa.
// - Bateria: bombo a quatro tempos, tarola com corpo, pratos de choque em
//   colcheias (abertos no contratempo do 4), prato de ataque a abrir as
//   secções e um rufo de tarola a fechar a pausa.
//
// A forma (32 compassos, perto de um minuto) repete-se: introdução com o
// arpejo e o baixo, o tema (A), a segunda parte mais acima (B), uma pausa sem
// bombo a crescer num rufo, e o tema outra vez com o solo dobrado.
//
// O motor — o bus com o reverb e o compressor, o agendador, ligar e desligar —
// é o da arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';
import { MUSIC_STORAGE_KEY } from './config.js';

const BPM = 136;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;

// ---------- Partitura ----------

/** Fundamental do baixo e as três notas do arpejo de cada acorde. */
const CHORDS = Object.fromEntries(Object.entries({
    Am: ['A2', 'A4', 'C5', 'E5'],
    F: ['F2', 'F4', 'A4', 'C5'],
    C: ['C3', 'G4', 'C5', 'E5'],
    G: ['G2', 'G4', 'B4', 'D5'],
    E: ['E2', 'G#4', 'B4', 'E5'],
    Dm: ['D3', 'F4', 'A4', 'D5']
}).map(([name, [root, ...tones]]) => [name, { root: midi(root), tones: tones.map(midi) }]));

const THEME = [
    'A4 1, C5 1, E5 1, A5 2, G5 1, E5 1, C5 1',
    'F5 3, E5 1, C5 2, A4 2',
    'G4 1, C5 1, E5 1, G5 2, F5 1, E5 1, D5 1',
    'D5 3, B4 1, G4 2, - 2',
    'A4 1, C5 1, E5 1, A5 2, B5 1, C6 1, A5 1',
    'C6 2, A5 1, F5 1, - 1, F5 1, G5 1, A5 1',
    'B5 2, G5 1, D5 1, - 1, D5 1, E5 1, F5 1',
    'G#5 3, E5 1, B4 2, E5 2'
];
const THEME_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'];

/**
 * Cada secção diz quem toca: `lead` (nada, solo, ou solo dobrado à oitava),
 * `drums` (só pratos, a toda a força, ou a pausa) e se há `pad`.
 */
const SECTIONS = [
    {
        // Introdução: o arpejo e o baixo a arrancar, o bombo entra a meio.
        melody: ['- 8', '- 8', '- 8', '- 4, E5 1, G5 1, A5 1, B5 1'],
        chords: ['Am', 'F', 'C', 'G'],
        lead: 'solo', drums: 'intro', pad: false
    },
    {
        // A: o tema.
        melody: THEME,
        chords: THEME_CHORDS,
        lead: 'solo', drums: 'full', pad: false
    },
    {
        // B: mais acima, a subir até ao mi.
        melody: [
            'C6 2, A5 2, F5 2, A5 2',
            'B5 2, G5 2, D5 2, G5 2',
            'C6 1, B5 1, A5 2, E5 2, A5 2',
            'E6 4, D6 2, C6 2',
            'A5 2, C6 2, F6 2, E6 1, D6 1',
            'D6 2, B5 2, G5 2, B5 1, D6 1',
            'E6 3, D6 1, C6 1, B5 1, A5 1, G#5 1',
            'B5 4, - 2, E5 1, G#5 1'
        ],
        chords: ['F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
        lead: 'solo', drums: 'full', pad: false
    },
    {
        // Pausa: sem bombo, com o pad por baixo, e um rufo para o regresso.
        melody: ['- 8', '- 8', '- 8', '- 8'],
        chords: ['F', 'C', 'Dm', 'E'],
        lead: 'solo', drums: 'break', pad: true
    },
    {
        // A': o tema com o solo dobrado à oitava.
        melody: THEME,
        chords: THEME_CHORDS,
        lead: 'double', drums: 'full', pad: false
    }
];

/** A partitura desdobrada por compasso. */
const BARS = SECTIONS.flatMap((section) =>
    section.melody.map((text, i) => ({
        melody: bar(text),
        chord: CHORDS[section.chords[i]],
        lead: section.lead,
        drums: section.drums,
        pad: section.pad,
        index: i,
        last: i === section.melody.length - 1,
        crash: i === 0 && section.drums === 'full'
    }))
);

/** O desenho do arpejo em semicolcheias: índices nas notas do acorde (3 = a primeira, oitava acima). */
const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

// ---------- Instrumentos ----------

/** O bus onde se está a tocar (o do jogo, ou um OfflineAudioContext a gravar). */
let bus = null;

function envelope(gain, time, peak, attack, decayTo, decay, release, end) {
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, decayTo), time + attack + decay);
    gain.gain.setValueAtTime(Math.max(0.0001, decayTo), end);
    gain.gain.exponentialRampToValueAtTime(0.0001, end + release);
}

function osc(type, frequency, time, stopAt, detune = 0) {
    const o = bus.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(frequency, time);
    o.detune.setValueAtTime(detune, time);
    o.start(time);
    o.stop(stopAt);
    return o;
}

function bass(time, m, velocity) {
    const { ctx } = bus;
    const end = time + STEP * 1.7;
    const lp = bus.filter('lowpass', 400, 6);
    lp.frequency.setValueAtTime(2400, time);
    lp.frequency.exponentialRampToValueAtTime(380, time + 0.16);
    const g = ctx.createGain();
    envelope(g, time, velocity, 0.004, velocity * 0.6, 0.08, 0.05, end);
    for (const detune of [-8, 8]) osc('sawtooth', freq(m), time, end + 0.1, detune).connect(lp);
    // Um seno uma oitava abaixo dá o peso que o filtro tira.
    const sub = osc('sine', freq(m) / 2, time, end + 0.1);
    const sg = ctx.createGain();
    envelope(sg, time, velocity * 0.5, 0.004, velocity * 0.4, 0.08, 0.05, end);
    sub.connect(sg);
    lp.connect(g);
    const out = ctx.createGain();
    g.connect(out);
    sg.connect(out);
    bus.route(out, time, { pan: 0, send: 0.04 });
}

function arp(time, m, velocity, pan) {
    const { ctx } = bus;
    const end = time + STEP * 0.8;
    const lp = bus.filter('lowpass', 3200, 2);
    lp.frequency.setValueAtTime(5200, time);
    lp.frequency.exponentialRampToValueAtTime(1400, time + 0.1);
    const g = ctx.createGain();
    envelope(g, time, velocity, 0.003, velocity * 0.4, 0.06, 0.06, end);
    osc('square', freq(m), time, end + 0.1).connect(lp);
    lp.connect(g);
    bus.route(g, time, { pan, send: 0.35 });
}

function lead(time, m, steps, velocity, pan = 0.05) {
    const { ctx } = bus;
    const length = steps * STEP;
    const end = time + Math.max(0.08, length - 0.02);
    const f = freq(m);
    const lp = bus.filter('lowpass', 3800, 1.5);
    lp.frequency.setValueAtTime(7000, time);
    lp.frequency.exponentialRampToValueAtTime(3800, time + 0.18);
    const g = ctx.createGain();
    envelope(g, time, velocity, 0.012, velocity * 0.72, 0.12, 0.12, end);

    const voices = [
        osc('sawtooth', f, time, end + 0.2, -9),
        osc('sawtooth', f, time, end + 0.2, 9),
        osc('square', f / 2, time, end + 0.2)
    ];
    const squareLevel = ctx.createGain();
    squareLevel.gain.value = 0.45;
    voices[2].connect(squareLevel);
    squareLevel.connect(lp);
    voices[0].connect(lp);
    voices[1].connect(lp);

    // Vibrato só nas notas longas, e só depois do ataque.
    if (length >= STEP * 5) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.6;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, time);
        depth.gain.linearRampToValueAtTime(14, time + 0.25);
        lfo.connect(depth);
        for (const v of voices) depth.connect(v.detune);
        lfo.start(time);
        lfo.stop(end + 0.2);
    }

    lp.connect(g);
    bus.route(g, time, { pan, send: 0.3 });
}

function pad(time, chord, seconds) {
    const { ctx } = bus;
    const end = time + seconds;
    const lp = bus.filter('lowpass', 1300, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.05, time + 0.6);
    g.gain.setValueAtTime(0.05, end - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, end + 0.3);
    for (const tone of chord.tones) {
        for (const detune of [-12, 12]) osc('sawtooth', freq(tone - 12), time, end + 0.4, detune).connect(lp);
    }
    lp.connect(g);
    bus.route(g, time, { pan: 0, send: 0.6 });
}

function kick(time, velocity) {
    const { ctx } = bus;
    const body = osc('sine', 150, time, time + 0.4);
    body.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(velocity, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.36);
    body.connect(g);
    // O estalo do batente, para o bombo se ouvir também em colunas pequenas.
    const click = osc('triangle', 1200, time, time + 0.03);
    click.frequency.exponentialRampToValueAtTime(200, time + 0.025);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(velocity * 0.35, time);
    cg.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
    click.connect(cg);
    const out = ctx.createGain();
    g.connect(out);
    cg.connect(out);
    bus.route(out, time, { send: 0.03 });
}

function snare(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.25);
    const band = bus.filter('bandpass', 2400, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(velocity, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    n.connect(band);
    band.connect(g);
    const body = osc('triangle', 230, time, time + 0.12);
    body.frequency.exponentialRampToValueAtTime(160, time + 0.08);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(velocity * 0.8, time);
    bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    body.connect(bg);
    const out = ctx.createGain();
    g.connect(out);
    bg.connect(out);
    bus.route(out, time, { pan: 0.06, send: 0.22 });
}

function hat(time, velocity, open = false) {
    const { ctx } = bus;
    const length = open ? 0.22 : 0.04;
    const n = bus.noise(time, time + length + 0.02);
    const hp = bus.filter('highpass', 7600, 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(velocity, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + length);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: -0.22, send: 0.08 });
}

function crash(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 1.6);
    const hp = bus.filter('highpass', 4200, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 1.5);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: 0.25, send: 0.35 });
}

// ---------- Agendador ----------

function scheduleStep(b, s, time) {
    const human = () => 0.92 + Math.random() * 0.12;
    const { chord } = b;

    // Baixo em colcheias, à oitava; na pausa só a fundamental, no tempo.
    if (b.drums === 'break') {
        if (s % 8 === 0) bass(time, chord.root + 12, 0.22);
    } else if (s % 2 === 0) {
        bass(time, chord.root + (s % 4 === 2 ? 12 : 0), (s % 4 === 0 ? 0.3 : 0.24) * human());
    }

    // Arpejo em todas as secções, com o eco a saltar de lado.
    const tones = chord.tones;
    const idx = ARP[s];
    const note = idx === 3 ? tones[0] + 12 : tones[idx];
    arp(time, note, (s % 4 === 0 ? 0.12 : 0.09) * human(), s % 2 ? 0.35 : -0.35);

    if (b.pad && s === 0) pad(time, chord, STEP * 16);

    // Solo.
    for (const n of b.melody) {
        if (n.step !== s) continue;
        lead(time, n.midi, n.steps, 0.22 * human());
        if (b.lead === 'double') lead(time, n.midi + 12, n.steps, 0.09 * human(), -0.15);
    }

    // Bateria.
    if (b.crash && s === 0) crash(time, 0.12);
    switch (b.drums) {
        case 'intro':
            if (b.index >= 2 && s % 4 === 0) kick(time, 0.55);
            if (s % 2 === 0) hat(time, (s % 4 === 2 ? 0.07 : 0.04) * human());
            if (b.last && s >= 12) snare(time, 0.1 + (s - 12) * 0.03);
            break;
        case 'break':
            if (s % 4 === 2) hat(time, 0.035 * human());
            if (b.last) {
                // O rufo: semicolcheias de tarola a crescer até ao regresso do tema.
                if (s >= 4) snare(time, 0.06 + (s / 16) * 0.16);
            } else if (s === 8) {
                snare(time, 0.12);
            }
            break;
        default:
            if (s % 4 === 0) kick(time, 0.6);
            if (s === 4 || s === 12) snare(time, 0.24 * human());
            if (s % 2 === 0) hat(time, (s % 4 === 2 ? 0.12 : 0.07) * human(), s === 14);
            else hat(time, 0.04 * human());
            if (b.last && s >= 13) snare(time, 0.14);
    }
}

export const music = createMusic({
    audio,
    storageKey: MUSIC_STORAGE_KEY,
    bpm: BPM,
    bars: BARS.length,
    volume: 0.26,
    compressor: { threshold: -16, knee: 10, ratio: 4, attack: 0.006, release: 0.2 },
    reverb: { seconds: 1.9, decay: 2.6, wet: 0.55 },
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});
