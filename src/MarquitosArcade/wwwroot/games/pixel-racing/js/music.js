// Música de fundo do Pixel Racing: um tema alegre, em allegro, com guitarra,
// piano, baixo e bateria.
//
// Tudo sintetizado, sem ficheiros de áudio (como os efeitos em audio.js):
//
// - Guitarra: cordas dedilhadas pelo algoritmo de Karplus-Strong — um estalo de
//   ruído a dar voltas numa linha de atraso do tamanho de um período, com uma
//   média entre amostras vizinhas a cada volta, que é o que a corda faz ao
//   perder os agudos. Cada nota é calculada uma vez e guardada. A guitarra de
//   ritmo rasga acordes (as cordas uma a uma, de cima para baixo ou ao
//   contrário) com um pouco de saturação; no refrão faz "chug" abafado. A
//   guitarra solo usa cordas que soam mais tempo, mais saturação e vibrato.
// - Piano: onda periódica com os harmónicos de uma corda, em duas cordas
//   desafinadas, com um passa-baixo que fecha depois do martelo (o mesmo da
//   Memória Animal, mais brilhante). Leva a melodia e, quando é a guitarra a
//   cantar, bate os acordes nos contratempos.
// - Baixo: dente de serra e triângulo filtrados, em colcheias.
// - Bateria: bombo, tarola, pratos de choque fechados e abertos, prato de
//   ataque a abrir as secções e viradas de timbalões e de tarola.
//
// A forma (28 compassos, pouco menos de um minuto) repete-se: A com o piano,
// B com a guitarra solo, uma pausa de meio tempo que cresce num rufo, e o tema
// outra vez com piano e guitarra juntos, a toda a força.
//
// O motor — o bus com o reverb e o compressor, o agendador, ligar e desligar —
// é o da arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';

const BPM = 132;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;

// ---------- Partitura ----------

/**
 * Os acordes como se tocam numa guitarra, da corda mais grave para a mais
 * aguda. `root` é a fundamental para o baixo; `stab` o acorde do piano.
 */
const CHORDS = {
    G: { shape: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'], root: 'G2', stab: ['B4', 'D5', 'G5'] },
    D: { shape: ['D3', 'A3', 'D4', 'F#4'], root: 'D2', stab: ['A4', 'D5', 'F#5'] },
    Em: { shape: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'], root: 'E2', stab: ['B4', 'E5', 'G5'] },
    C: { shape: ['C3', 'E3', 'G3', 'C4', 'E4'], root: 'C2', stab: ['C5', 'E5', 'G5'] },
    Bm: { shape: ['B2', 'F#3', 'B3', 'D4', 'F#4'], root: 'B1', stab: ['B4', 'D5', 'F#5'] },
    Am: { shape: ['A2', 'E3', 'A3', 'C4', 'E4'], root: 'A1', stab: ['A4', 'C5', 'E5'] }
};

for (const c of Object.values(CHORDS)) {
    c.shape = c.shape.map(midi);
    c.root = midi(c.root);
    c.stab = c.stab.map(midi);
}

/** A frase de A, que volta no fim (D) com a guitarra a dobrar o piano. */
const THEME = [
    'D5 1, G5 1, B5 1, D6 2, B5 1, C6 1, D6 1',
    'A5 2, F#5 1, A5 1, - 1, D5 1, E5 1, F#5 1',
    'G5 1, E5 1, G5 1, B5 2, A5 1, G5 1, F#5 1',
    'E5 3, - 1, C5 1, D5 1, E5 1, G5 1',
    'D5 1, G5 1, B5 1, D6 2, B5 1, D6 1, E6 1',
    'F#6 2, E6 1, D6 1, - 1, A5 1, B5 1, C6 1',
    'E6 1, D6 1, C6 1, B5 1, A5 1, G5 1, E5 1, G5 1',
    'F#5 2, A5 2, D6 3, - 1'
];
const THEME_CHORDS = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'];

/**
 * Sol maior — o tom mais à mão numa guitarra, e dos mais luminosos. Cada secção
 * diz quem canta (`lead`: piano, guitarra ou os dois), como toca a guitarra de
 * ritmo (`rhythm`) e a bateria (`drums`).
 */
const SECTIONS = [
    {
        // A: o tema no piano, a guitarra a rasgar por baixo.
        melody: THEME,
        chords: THEME_CHORDS,
        lead: 'piano', rhythm: 'strum', drums: 'groove'
    },
    {
        // B: a guitarra solo canta, o ritmo passa a "chug" e o piano bate os contratempos.
        melody: [
            'E5 3, D5 1, E5 2, G5 2',
            'F#5 3, E5 1, D5 2, A4 2',
            'B4 2, D5 2, F#5 3, E5 1',
            'G5 5, E5 1, F#5 1, G5 1',
            'A5 3, G5 1, E5 2, C5 2',
            'D5 1, E5 1, F#5 1, A5 1, D6 2, C6 1, A5 1',
            'B5 3, A5 1, G5 2, D5 2',
            'F#5 1, G5 1, A5 1, B5 1, C6 2, A5 2'
        ],
        chords: ['C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'D'],
        lead: 'guitar', rhythm: 'chug', drums: 'groove'
    },
    {
        // C: meio tempo, acordes a soar, e um rufo a crescer para o regresso do tema.
        melody: ['B5 4, G5 4', 'C6 4, E5 4', 'D5 2, G5 2, B5 2, D6 2', 'C6 2, B5 2, A5 2, F#5 2'],
        chords: ['Em', 'C', 'G', 'D'],
        lead: 'piano', rhythm: 'ring', drums: 'half'
    },
    {
        // D: o tema outra vez, piano e guitarra juntos, com pratos em semicolcheias.
        melody: THEME,
        chords: THEME_CHORDS,
        lead: 'both', rhythm: 'strum', drums: 'drive'
    }
];

/** A partitura desdobrada por compasso. */
const BARS = SECTIONS.flatMap((section) =>
    section.melody.map((text, i) => ({
        melody: bar(text),
        chord: CHORDS[section.chords[i]],
        lead: section.lead,
        rhythm: section.rhythm,
        // O rufo no último compasso da pausa; uma virada no fim das frases de 8.
        drums: section.drums === 'half' && i === section.melody.length - 1 ? 'roll' : section.drums,
        fill: section.drums !== 'half' && i === section.melody.length - 1,
        crash: i === 0
    }))
);

/** A batida da guitarra de ritmo, em colcheias: B (baixo→cima), C (cima→baixo), - nada. */
const STRUM = 'B-BC-CBC';

// ---------- Bus ----------

/** O bus onde se está a tocar (o do jogo, ou um OfflineAudioContext a gravar): chega em cada passo. */
let bus = null;

const PIANO_PARTIALS = [0, 1, 0.7, 0.4, 0.28, 0.18, 0.12, 0.08, 0.05, 0.03];


/** Saturação (tanh), um passa-baixo que faz de coluna, e daí para a sala. */
function guitarChain({ ctx, master, reverb }, { drive, tone, pan, send, level }) {
    const input = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const cab = ctx.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = tone;
    cab.Q.value = 0.8;
    const out = ctx.createGain();
    out.gain.value = level;

    input.connect(shaper);
    shaper.connect(cab);
    cab.connect(out);
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


// ---------- Guitarra (Karplus-Strong) ----------

// Quanto de cada corda se calcula: o rasgado mais longo dura um meio compasso e
// a nota solo mais longa cinco colcheias. Mais do que isso era memória gasta.
const RHYTHM_SECONDS = 1.2;
const LEAD_SECONDS = 1.5;

/**
 * Uma corda dedilhada, calculada uma vez por nota e por tipo de corda.
 * `sustain` é quanto de cada volta sobrevive (mais perto de 1, soa mais tempo).
 * O período tem de ser um número inteiro de amostras e a média junta-lhe meia
 * amostra: o `rate` devolvido corrige a afinação que isso desvia.
 */
function pluck(m, sustain, seconds) {
    const key = `${m}:${sustain}`;
    let p = bus.plucks.get(key);
    if (p) return p;

    const { ctx } = bus;
    const sr = ctx.sampleRate;
    const period = sr / freq(m);
    const n = Math.max(2, Math.floor(period - 0.5));
    const buffer = ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    const out = buffer.getChannelData(0);

    // O estalo inicial: ruído já um pouco suavizado, para a palheta não arranhar.
    let prev = 0;
    for (let i = 0; i < n && i < out.length; i++) {
        const r = Math.random() * 2 - 1;
        out[i] = 0.5 * (r + prev);
        prev = r;
    }
    for (let i = n; i < out.length; i++) {
        out[i] = sustain * 0.5 * (out[i - n] + (i - n - 1 >= 0 ? out[i - n - 1] : 0));
    }

    p = { buffer, rate: period / (n + 0.5) };
    bus.plucks.set(key, p);
    return p;
}

/** Uma corda da guitarra de ritmo, que se cala em `until` (a mão a abafar). */
function rhythmString(time, m, until, velocity) {
    const { ctx } = bus;
    const p = pluck(m, 0.996, RHYTHM_SECONDS);
    const src = ctx.createBufferSource();
    src.buffer = p.buffer;
    src.playbackRate.value = p.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity, time);
    g.gain.setTargetAtTime(0, until, 0.03);
    src.connect(g);
    g.connect(bus.rhythmIn);
    src.start(time);
    src.stop(Math.min(until + 0.2, time + RHYTHM_SECONDS));
}

/** Um rasgado: as cordas uma a uma, com 9 ms entre cada. `up` vai de cima para baixo. */
function strum(time, chord, until, velocity, up = false) {
    // Na subida a palheta só apanha as cordas de cima.
    const strings = up ? chord.shape.slice(-4).reverse() : chord.shape;
    strings.forEach((m, i) => rhythmString(time + i * 0.009, m, until, velocity * (up ? 0.7 : 1)));
}

/** "Chug": fundamental e quinta, curtas e abafadas pela palma da mão. */
function chug(time, chord, velocity) {
    const root = chord.shape[0];
    const end = time + STEP * 1.3;
    rhythmString(time, root, end, velocity);
    rhythmString(time + 0.004, root + 7, end, velocity * 0.9);
}

/** Uma nota da guitarra solo: corda que soa mais tempo, saturada, e vibrato quando a nota é longa. */
function leadGuitar(time, m, duration, velocity) {
    const { ctx } = bus;
    const p = pluck(m, 0.9993, LEAD_SECONDS);
    const src = ctx.createBufferSource();
    src.buffer = p.buffer;
    src.playbackRate.value = p.rate;
    const end = time + duration;

    if (duration > 0.3) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.6;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, time);
        depth.gain.setValueAtTime(0, time + 0.15);
        depth.gain.linearRampToValueAtTime(p.rate * 0.008, time + 0.4);
        lfo.connect(depth);
        depth.connect(src.playbackRate);
        lfo.start(time);
        lfo.stop(end + 0.15);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity, time);
    g.gain.setTargetAtTime(0, end, 0.04);
    src.connect(g);
    g.connect(bus.leadIn);
    src.start(time);
    src.stop(Math.min(end + 0.15, time + LEAD_SECONDS));
}

// ---------- Piano, baixo e bateria ----------

function piano(time, m, duration, velocity, pan = 0) {
    const { ctx, pianoWave } = bus;
    const f = freq(m);
    const ring = Math.min(1.2, Math.max(0.35, 1 - (m - 60) * 0.03));
    const end = time + Math.max(duration, 0.2);
    const stopAt = end + 0.35;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(velocity, time + 0.004);
    out.gain.setTargetAtTime(velocity * 0.45, time + 0.004, 0.08);
    out.gain.setTargetAtTime(0.0001, time + 0.18, ring);
    out.gain.setTargetAtTime(0, end, 0.06);

    const bright = Math.min(f * (6 + velocity * 14), 10000);
    const tone = bus.filter('lowpass', bright, 0.4);
    tone.frequency.setValueAtTime(bright, time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 300), time + 1);
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

    const hammer = bus.noise(time, time + 0.04);
    const hammerBand = bus.filter('bandpass', Math.min(f * 3, 4500), 1.5);
    const hammerGain = ctx.createGain();
    hammerGain.gain.setValueAtTime(velocity * 0.2, time);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    hammer.connect(hammerBand);
    hammerBand.connect(hammerGain);
    hammerGain.connect(out);

    bus.route(out, time, { pan, send: 0.3 });
}

function bass(time, m, duration, velocity) {
    const { ctx } = bus;
    const f = freq(m);
    const lp = bus.filter('lowpass', 900, 1.2);
    lp.frequency.setValueAtTime(1600, time);
    lp.frequency.exponentialRampToValueAtTime(500, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.006);
    g.gain.setTargetAtTime(velocity * 0.6, time + 0.006, 0.1);
    g.gain.setTargetAtTime(0, time + duration, 0.03);
    for (const type of ['sawtooth', 'triangle']) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = f;
        osc.connect(lp);
        osc.start(time);
        osc.stop(time + duration + 0.15);
    }
    lp.connect(g);
    bus.route(g, time, { send: 0.04 });
}

function kick(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.33);

    // O batente: um clique curto por cima, para o bombo se ouvir no meio da guitarra.
    const click = bus.noise(time, time + 0.02);
    const band = bus.filter('bandpass', 3000, 1);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(velocity * 0.25, time);
    cg.gain.exponentialRampToValueAtTime(0.0001, time + 0.015);
    click.connect(band);
    band.connect(cg);

    const out = ctx.createGain();
    g.connect(out);
    cg.connect(out);
    bus.route(out, time, { send: 0.04 });
}

function snare(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(160, time + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(velocity * 0.6, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    osc.connect(og);
    osc.start(time);
    osc.stop(time + 0.12);

    const n = bus.noise(time, time + 0.22);
    const band = bus.filter('highpass', 1400, 0.7);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, time);
    ng.gain.linearRampToValueAtTime(velocity, time + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
    n.connect(band);
    band.connect(ng);

    const out = ctx.createGain();
    og.connect(out);
    ng.connect(out);
    bus.route(out, time, { pan: -0.08, send: 0.22 });
}

function hat(time, velocity, open = false) {
    const { ctx } = bus;
    const length = open ? 0.32 : 0.045;
    const n = bus.noise(time, time + length + 0.02);
    const hp = bus.filter('highpass', 7500, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + length);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: 0.3, send: 0.06 });
}

function crash(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 1.6);
    const hp = bus.filter('highpass', 4500, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.setTargetAtTime(0.0001, time + 0.004, 0.45);
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
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.3);
    bus.route(g, time, { pan: pitch > 150 ? 0.25 : -0.25, send: 0.15 });
}

// ---------- Partes ----------

const human = (spread = 0.2) => 1 - spread / 2 + Math.random() * spread;

function playMelody(b, s, time) {
    for (const note of b.melody) {
        if (note.step !== s) continue;
        const duration = note.steps * STEP * 0.92;
        const accent = s % 4 === 0 ? 1 : 0.88;
        if (b.lead === 'piano' || b.lead === 'both') {
            piano(time, note.midi, duration, 0.2 * accent * human(0.1), 0.12);
        }
        if (b.lead === 'guitar') leadGuitar(time, note.midi - 12, duration, 0.55 * accent * human(0.1));
        // No tema final a guitarra dobra o piano uma oitava abaixo.
        if (b.lead === 'both') leadGuitar(time, note.midi - 12, duration, 0.38 * accent * human(0.1));
    }
}

function playRhythm(b, s, time) {
    const c = b.chord;
    if (b.rhythm === 'ring') {
        if (s === 0 || s === 8) strum(time, c, time + STEP * 8, 0.3 * human(0.1));
        return;
    }
    if (b.rhythm === 'chug') {
        if (s % 2 === 0) chug(time, c, (s % 4 === 0 ? 0.4 : 0.3) * human(0.1));
        return;
    }
    if (s % 2 !== 0) return;
    const stroke = STRUM[s / 2];
    if (stroke === '-') return;
    // Cada rasgado soa até ao seguinte.
    let next = s / 2 + 1;
    while (next < STRUM.length && STRUM[next] === '-') next++;
    const until = time + (next * 2 - s) * STEP;
    strum(time, c, until, (s % 4 === 0 ? 0.3 : 0.24) * human(0.1), stroke === 'C');
}

/** Quando a guitarra canta, o piano bate os acordes nos contratempos. */
function playPianoComp(b, s, time) {
    if (b.lead !== 'guitar' || s % 4 !== 2) return;
    b.chord.stab.forEach((m, i) => piano(time + i * 0.004, m, STEP * 1.2, 0.09 * human(0.1), -0.15));
}

function playBass(b, s, time) {
    const root = b.chord.root;
    if (b.rhythm === 'ring') {
        if (s === 0 || s === 8) bass(time, root, STEP * 7.5, 0.13);
        return;
    }
    if (s % 2 !== 0) return;
    // Colcheias na fundamental, com um salto à oitava no fim de cada meio compasso.
    const jump = s === 6 || s === 14;
    bass(time, root + (jump ? 12 : 0), STEP * 1.7, (s % 8 === 0 ? 0.13 : 0.1) * human(0.1));
}

function playDrums(b, s, time) {
    if (b.crash && s === 0 && b.drums !== 'half') crash(time, 0.12);

    if (b.drums === 'half' || b.drums === 'roll') {
        if (s === 0) kick(time, 0.55);
        if (s % 4 === 0) hat(time, 0.04 * human());
        if (b.drums === 'roll') {
            // Rufo em semicolcheias, a crescer até ao tema.
            if (s >= 4) snare(time, (0.05 + (s / 15) * 0.13) * human(0.1));
            if (s === 14) kick(time, 0.45);
        } else if (s === 8) {
            snare(time, 0.14 * human(0.1));
        }
        return;
    }

    // Bombo no 1, no 3 e no "e" do 3; tarola no 2 e no 4.
    if (s === 0 || s === 8 || s === 10) kick(time, s === 10 ? 0.45 : 0.6);
    if (s === 4 || (s === 12 && !b.fill)) snare(time, 0.17 * human(0.1));

    if (b.fill) {
        // Virada no último tempo: tarola e dois timbalões.
        if (s === 12) snare(time, 0.14);
        if (s === 13) snare(time, 0.1);
        if (s === 14) tom(time, 180, 0.3);
        if (s === 15) tom(time, 120, 0.32);
        if (s < 12 && s % 2 === 0) hat(time, 0.05 * human());
        return;
    }

    if (b.drums === 'drive') {
        // Semicolcheias, com acento nas colcheias.
        hat(time, (s % 2 === 0 ? 0.06 : 0.03) * human());
    } else if (s % 2 === 0) {
        // Prato aberto no "e" do 4, fechado no resto.
        hat(time, (s % 4 === 2 ? 0.06 : 0.042) * human(), s === 14);
    }
}

// ---------- Agendador ----------

function scheduleStep(b, s, time) {
    playMelody(b, s, time);
    playRhythm(b, s, time);
    playPianoComp(b, s, time);
    playBass(b, s, time);
    playDrums(b, s, time);
}

export const music = createMusic({
    audio,
    storageKey: 'pixelRacingMusic_v1',
    bpm: BPM,
    bars: BARS.length,
    // Por baixo do motor e dos efeitos.
    volume: 0.3,
    fadeIn: 1.2,
    fadeOut: 0.4,
    lookaheadMs: 25,
    // Um compressor a segurar os picos (há muita coisa a bater ao mesmo tempo) e uma sala pequena.
    compressor: { threshold: -16, knee: 10, ratio: 3.5, attack: 0.006, release: 0.2 },
    reverb: { seconds: 1.6, decay: 3, wet: 0.7 },
    setup: (b) => ({
        pianoWave: b.ctx.createPeriodicWave(new Float32Array(PIANO_PARTIALS.length), new Float32Array(PIANO_PARTIALS)),
        plucks: new Map(),
        // A guitarra de ritmo à esquerda, pouco saturada; a solo à direita, mais.
        rhythmIn: guitarChain(b, { drive: 2.2, tone: 3600, pan: -0.4, send: 0.15, level: 0.4 }),
        leadIn: guitarChain(b, { drive: 5, tone: 3000, pan: 0.25, send: 0.35, level: 0.5 })
    }),
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});
