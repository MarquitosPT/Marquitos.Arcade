// Música de fundo da Tasca do Zé: um vira, como os dos ranchos folclóricos —
// em três tempos, rápido, com acordeão, bandolim, cavaquinho e a bateria de
// rancho (bombo, caixa e ferrinhos).
//
// A melodia do acordeão parte do motivo da música antiga da tasca (ré, fá, sol,
// fá, lá, sol, fá, ré), agora a dançar: a primeira frase em ré menor, a segunda
// no fá maior ao lado, como tantas modas populares, e o Lá maior (com o dó
// sustenido) a trazer tudo de volta ao ré.
//
// Tudo sintetizado, sem ficheiros de áudio:
//
// - Acordeão: três palhetas em dente de serra, uma afinada e duas ligeiramente
//   acima e abaixo — o "musette", o batimento que faz o acordeão tremer — mais
//   uma palheta uma oitava abaixo para dar corpo, por um filtro que faz de caixa.
// - Bandolim e cavaquinho: cordas dedilhadas pelo algoritmo de Karplus-Strong
//   (um estalo de ruído a dar voltas numa linha de atraso do tamanho de um
//   período, a perder os agudos a cada volta). O bandolim faz trémulo nas notas
//   longas — a mesma nota em semicolcheias, como se toca; o cavaquinho rasga o
//   "pá-pá" do segundo e terceiro tempos.
// - Baixo: a nota grave no primeiro tempo, a alternar entre a fundamental e a
//   quinta, como uma viola baixo.
// - Bateria de rancho: o bombo no primeiro tempo, a caixa no segundo e no
//   terceiro, e os ferrinhos (um triângulo) em colcheias.
//
// A forma (32 compassos, pouco mais de meio minuto) repete-se: A e B com o
// acordeão, A outra vez com o bandolim a cantar, e B com os dois juntos.
//
// O motor — o bus com o reverb e o compressor, o agendador, ligar e desligar —
// é o da arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';
import { state } from './state.js';

const BPM = 168;
/** Semicolcheias num compasso de três tempos. */
const STEPS_PER_BAR = 12;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;

// ---------- Partitura ----------

/**
 * Os acordes: `strum` como se tocam no cavaquinho (quatro cordas), `bass` a
 * fundamental e a quinta para o baixo alternar.
 */
const CHORDS = {
    Dm: { strum: ['D4', 'F4', 'A4', 'D5'], bass: ['D2', 'A2'] },
    A: { strum: ['C#4', 'E4', 'G4', 'A4'], bass: ['A2', 'E2'] },
    F: { strum: ['C4', 'F4', 'A4', 'C5'], bass: ['F2', 'C3'] },
    C: { strum: ['C4', 'E4', 'G4', 'C5'], bass: ['C3', 'G2'] },
    Bb: { strum: ['D4', 'F4', 'Bb4', 'D5'], bass: ['Bb2', 'F2'] }
};
for (const c of Object.values(CHORDS)) {
    c.strum = c.strum.map(midi);
    c.bass = c.bass.map(midi);
}

/** A: o motivo da tasca, em ré menor. Cada compasso soma 6 colcheias. */
const A = {
    melody: [
        'D5 1, F5 1, G5 1, F5 1, A5 2',
        'G5 1, F5 1, E5 1, D5 1, A4 2',
        'C#5 1, E5 1, G5 1, F5 1, E5 2',
        'E5 1, D5 1, C#5 1, D5 1, E5 2',
        'D5 1, F5 1, G5 1, F5 1, A5 2',
        'D6 2, C6 1, A5 1, F5 2',
        'G5 1, F5 1, E5 1, D5 1, C#5 2',
        'D5 4, - 2'
    ],
    chords: ['Dm', 'Dm', 'A', 'A', 'Dm', 'Dm', 'A', 'Dm']
};

/** B: a volta ao fá maior, mais aberta, e o Lá a puxar para o início. */
const B = {
    melody: [
        'A5 1, C6 1, A5 1, F5 1, C5 2',
        'G5 1, A5 1, G5 1, E5 1, C5 2',
        'E5 1, F5 1, G5 1, A5 1, Bb5 2',
        'A5 3, G5 1, F5 2',
        'F5 1, Bb5 1, D6 1, Bb5 1, F5 2',
        'A5 1, C6 1, A5 1, F5 1, C5 2',
        'E5 1, G5 1, C6 1, Bb5 1, G5 2',
        'E5 1, G5 1, F5 1, E5 1, C#5 2'
    ],
    chords: ['F', 'C', 'C', 'F', 'Bb', 'F', 'C', 'A']
};

/** Quem canta em cada volta: o acordeão, o bandolim, ou os dois (o bandolim uma oitava abaixo). */
const SECTIONS = [
    { ...A, lead: 'accordion' },
    { ...B, lead: 'accordion' },
    { ...A, lead: 'mandolin' },
    { ...B, lead: 'both' }
];

const BARS = SECTIONS.flatMap((section) =>
    section.melody.map((text, i) => ({
        melody: bar(text),
        chord: CHORDS[section.chords[i]],
        lead: section.lead,
        // Uma virada da caixa a fechar cada volta de oito compassos.
        fill: i === section.melody.length - 1,
        // O bombo com mais força no compasso que abre cada secção.
        downbeat: i === 0,
        // Compassos pares e ímpares alternam a nota do baixo.
        alt: i % 2 === 1
    }))
);

// ---------- Bus ----------

/** O bus onde se está a tocar (o do jogo, ou um OfflineAudioContext a gravar): chega em cada passo. */
let bus = null;

// ---------- Cordas (Karplus-Strong) ----------

/** Quanto de cada corda se calcula: as notas mais longas do bandolim são trémulo, e o resto é curto. */
const PLUCK_SECONDS = 1;

/**
 * Uma corda dedilhada, calculada uma vez por nota e guardada no bus. O período
 * tem de ser um número inteiro de amostras e a média junta-lhe meia amostra: o
 * `rate` devolvido corrige a afinação que isso desvia.
 */
function pluck(m) {
    let p = bus.plucks.get(m);
    if (p) return p;

    const { ctx } = bus;
    const sr = ctx.sampleRate;
    const period = sr / freq(m);
    const n = Math.max(2, Math.floor(period - 0.5));
    const buffer = ctx.createBuffer(1, Math.floor(sr * PLUCK_SECONDS), sr);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < n && i < out.length; i++) out[i] = Math.random() * 2 - 1;
    for (let i = n; i < out.length; i++) {
        out[i] = 0.996 * 0.5 * (out[i - n] + (i - n - 1 >= 0 ? out[i - n - 1] : 0));
    }

    p = { buffer, rate: period / (n + 0.5) };
    bus.plucks.set(m, p);
    return p;
}

/** Uma corda, abafada em `until`, para a entrada que se pedir (bandolim ou cavaquinho). */
function string(time, m, until, velocity, input) {
    const { ctx } = bus;
    const p = pluck(m);
    const src = ctx.createBufferSource();
    src.buffer = p.buffer;
    src.playbackRate.value = p.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity, time);
    g.gain.setTargetAtTime(0, until, 0.025);
    src.connect(g);
    g.connect(input);
    src.start(time);
    src.stop(Math.min(until + 0.15, time + PLUCK_SECONDS));
}

/** Bandolim: as notas curtas dedilhadas, as longas em trémulo (a nota a cada semicolcheia). */
function mandolin(time, m, steps, velocity) {
    if (steps <= 2) {
        string(time, m, time + steps * STEP * 0.95, velocity, bus.mandolinIn);
        string(time + 0.004, m, time + steps * STEP * 0.95, velocity * 0.6, bus.mandolinIn);
        return;
    }
    for (let k = 0; k < steps; k++) {
        const t = time + k * STEP;
        // Palheta para baixo e para cima: a que desce soa um pouco mais.
        const v = velocity * (k % 2 === 0 ? 1 : 0.72) * (k === 0 ? 1.15 : 1);
        string(t, m, t + STEP * 1.05, v, bus.mandolinIn);
    }
}

/** Cavaquinho: um rasgado curto, as quatro cordas quase juntas. */
function cavaquinho(time, chord, velocity, up = false) {
    const strings = up ? [...chord.strum].reverse() : chord.strum;
    const until = time + STEP * 1.6;
    strings.forEach((m, i) => string(time + i * 0.006, m + 12, until, velocity * (up ? 0.75 : 1), bus.cavaquinhoIn));
}

/** Uma cadeia para um instrumento de cordas: um passa-banda que faz de tampo, e daí para a sala. */
function bodyChain({ ctx, master, reverb }, { low, high, pan, send, level }) {
    const input = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = low;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = high;
    const out = ctx.createGain();
    out.gain.value = level;
    input.connect(hp);
    hp.connect(lp);
    lp.connect(out);
    let last = out;
    if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        out.connect(p);
        last = p;
    }
    last.connect(master);
    const s = ctx.createGain();
    s.gain.value = send;
    last.connect(s);
    s.connect(reverb);
    return input;
}

// ---------- Acordeão, baixo e bateria ----------

/** Acordeão: três palhetas desafinadas entre si (o musette) e uma oitava abaixo. */
function accordion(time, m, duration, velocity) {
    const { ctx } = bus;
    const f = freq(m);
    const end = time + duration;
    const stopAt = end + 0.12;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    // O fole: entra depressa mas não de estalo, e a nota incha um nadinha.
    out.gain.linearRampToValueAtTime(velocity * 0.85, time + 0.025);
    out.gain.linearRampToValueAtTime(velocity, time + Math.min(0.2, duration * 0.6));
    out.gain.setValueAtTime(velocity, end);
    out.gain.linearRampToValueAtTime(0, end + 0.06);

    // A caixa do acordeão: corta o áspero do dente de serra e acentua o meio.
    const box = bus.filter('lowpass', Math.min(f * 6, 5200), 0.7);
    const nasal = bus.filter('peaking', 1400, 1.2);
    nasal.gain.value = 5;
    box.connect(nasal);
    nasal.connect(out);

    for (const [ratio, detune, level] of [[1, 0, 0.32], [1, 11, 0.26], [1, -10, 0.26], [0.5, 0, 0.22]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f * ratio;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g);
        g.connect(box);
        osc.start(time);
        osc.stop(stopAt);
    }

    bus.route(out, time, { pan: 0.12, send: 0.25 });
}

function bass(time, m, duration, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq(m);
    const lp = bus.filter('lowpass', 900, 0.8);
    lp.frequency.setValueAtTime(1500, time);
    lp.frequency.exponentialRampToValueAtTime(350, time + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.006);
    g.gain.exponentialRampToValueAtTime(velocity * 0.3, time + 0.25);
    g.gain.setTargetAtTime(0, time + duration, 0.03);
    osc.connect(lp);
    lp.connect(g);
    osc.start(time);
    osc.stop(time + duration + 0.12);
    bus.route(g, time, { send: 0.05 });
}

/** O bombo de rancho: grande e grave, com a pele a soar um pouco. */
function bombo(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(52, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.5);

    // A maceta na pele.
    const n = bus.noise(time, time + 0.04);
    const band = bus.filter('bandpass', 700, 1);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(velocity * 0.3, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    n.connect(band);
    band.connect(ng);

    const out = ctx.createGain();
    g.connect(out);
    ng.connect(out);
    bus.route(out, time, { send: 0.12 });
}

/** A caixa: bordão seco e curto — o "chá" do "pum-chá-chá". */
function caixa(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.14);
    const hp = bus.filter('bandpass', 2600, 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    n.connect(hp);
    hp.connect(g);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, time);
    osc.frequency.exponentialRampToValueAtTime(180, time + 0.04);
    const og = ctx.createGain();
    og.gain.setValueAtTime(velocity * 0.45, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(og);
    osc.start(time);
    osc.stop(time + 0.08);

    const out = ctx.createGain();
    g.connect(out);
    og.connect(out);
    bus.route(out, time, { pan: -0.15, send: 0.18 });
}

/** Os ferrinhos: um triângulo de ferro, parciais inarmónicos agudos a tilintar. */
function ferrinhos(time, velocity, open = false) {
    const { ctx } = bus;
    const length = open ? 0.5 : 0.12;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(velocity, time + 0.002);
    out.gain.exponentialRampToValueAtTime(0.0001, time + length);
    for (const [ratio, level] of [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.93, 0.15]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1760 * ratio;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g);
        g.connect(out);
        osc.start(time);
        osc.stop(time + length + 0.02);
    }
    bus.route(out, time, { pan: 0.35, send: 0.15 });
}

// ---------- Partes ----------

const human = (spread = 0.2) => 1 - spread / 2 + Math.random() * spread;

function playMelody(b, s, time) {
    for (const note of b.melody) {
        if (note.step !== s) continue;
        const accent = s === 0 ? 1 : s % 4 === 0 ? 0.92 : 0.85;
        if (b.lead === 'accordion' || b.lead === 'both') {
            accordion(time, note.midi, note.steps * STEP * 0.9, 0.3 * accent * human(0.08));
        }
        if (b.lead === 'mandolin') mandolin(time, note.midi, note.steps, 0.5 * accent * human(0.08));
        if (b.lead === 'both') mandolin(time, note.midi - 12, note.steps, 0.34 * accent * human(0.08));
    }
}

/** O "pum-chá-chá": baixo no primeiro tempo, cavaquinho no segundo e no terceiro (e um contratempo no fim). */
function playAccompaniment(b, s, time) {
    const c = b.chord;
    if (s === 0) bass(time, c.bass[b.alt ? 1 : 0], STEP * 3.5, 0.2);
    if (s === 4 || s === 8) cavaquinho(time, c, 0.3 * human(0.1));
    if (s === 10) cavaquinho(time, c, 0.18 * human(0.1), true);
}

function playDrums(b, s, time) {
    if (s === 0) bombo(time, b.downbeat ? 0.45 : 0.36);

    if (b.fill && s >= 6) {
        // Virada: a caixa em semicolcheias a fechar a volta.
        caixa(time, (0.05 + (s - 6) * 0.009) * human(0.1));
        if (s === 8) bombo(time, 0.26);
        return;
    }

    if (s === 4 || s === 8) caixa(time, 0.09 * human(0.1));
    // Ferrinhos em colcheias, com acento em cada tempo; aberto no fim do compasso.
    if (s % 2 === 0) ferrinhos(time, (s % 4 === 0 ? 0.032 : 0.02) * human(), s === 10 && b.alt);
}

// ---------- Agendador ----------

function scheduleStep(b, s, time) {
    playMelody(b, s, time);
    playAccompaniment(b, s, time);
    playDrums(b, s, time);
}

export const music = createMusic({
    audio,
    storageKey: 'tascaDoZeMusic_v1',
    bpm: BPM,
    stepsPerBar: STEPS_PER_BAR,
    bars: BARS.length,
    // Por baixo dos efeitos: a campainha e os pratos servidos têm de se ouvir.
    volume: 0.4,
    fadeIn: 1.2,
    fadeOut: 0.4,
    lookaheadMs: 25,
    compressor: { threshold: -16, knee: 10, ratio: 3.5, attack: 0.006, release: 0.2 },
    // Uma tasca: sala pequena, paredes de azulejo.
    reverb: { seconds: 1.3, decay: 3.2, wet: 0.6 },
    setup: (b) => ({
        plucks: new Map(),
        // O bandolim à direita, brilhante; o cavaquinho à esquerda, mais fino ainda.
        mandolinIn: bodyChain(b, { low: 200, high: 5200, pan: 0.3, send: 0.25, level: 1.1 }),
        cavaquinhoIn: bodyChain(b, { low: 350, high: 4800, pan: -0.35, send: 0.15, level: 0.32 })
    }),
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});

/**
 * Toca nos menus e no turno; cala-se na pausa, com o som todo desligado (o 🔊
 * do cabeçalho) e com a página escondida.
 */
export function syncMusic() {
    music.setWanted(!state.paused && !audio.muted && document.visibilityState === 'visible');
}
