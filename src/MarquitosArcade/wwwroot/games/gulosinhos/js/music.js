// Música de fundo dos Gulosinhos: uma marcha saltitona de desenho animado.
//
// Tudo sintetizado, sem ficheiros de áudio (como os efeitos em audio.js):
//
// - Melodia num "pizzicato" de brinquedo: onda quadrada abafada por um filtro
//   que fecha logo a seguir ao ataque, mais um seno uma oitava acima que lhe
//   dá o brilho de caixinha de música.
// - Baixo aos saltos (fundamental e quinta, em semínimas e bem curtas) e
//   acordes de cavaquinho nos contratempos — o "pum-tchá" de quem anda aos
//   pulos.
// - Bateria leve: bombo, tarola de ruído e pratos de choque fechados.
//
// Dó maior a 132 BPM, 20 compassos (pouco mais de meio minuto) em loop: A, A',
// B, B' e uma ponte mais calma, só com o bombo, antes de o tema voltar.
//
// O motor — bus, reverb, compressor, agendador, ligar e desligar — é o da
// arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';
import { MUSIC_STORAGE_KEY } from './config.js';

const BPM = 132;
const STEP = 60 / BPM / 4;

// ---------- Partitura ----------

function chord(name) {
    const minor = name.endsWith('m');
    let root = midi(`${minor ? name.slice(0, -1) : name}3`);
    if (root > 52) root -= 12;
    return { root, third: minor ? 3 : 4 };
}

const SECTIONS = [
    {
        // A: sobe ao dó de cima e desce aos saltinhos.
        melody: ['E5 1, G5 1, C6 2, B5 1, A5 1, G5 2', 'A5 1, G5 1, E5 2, F5 1, E5 1, D5 2', 'E5 1, G5 1, C6 2, D6 1, C6 1, A5 2', 'G5 3, E5 1, D5 4'],
        chords: ['C', 'F', 'Am', 'G'],
        drums: 'bounce'
    },
    {
        // A': a mesma pergunta, mais acima, e a resposta em casa.
        melody: ['E5 1, G5 1, C6 2, B5 1, A5 1, G5 2', 'A5 1, C6 1, F6 2, E6 1, D6 1, C6 2', 'B5 1, C6 1, D6 2, G5 1, A5 1, B5 2', 'C6 4, - 2, G5 1, G5 1'],
        chords: ['C', 'F', 'G', 'C'],
        drums: 'bounce'
    },
    {
        // B: arpejos largos, a respirar.
        melody: ['F5 2, A5 2, C6 2, A5 2', 'E5 2, G5 2, C6 2, G5 2', 'D5 2, F5 2, A5 1, G5 1, F5 2', 'E5 1, F5 1, G5 2, - 4'],
        chords: ['F', 'C', 'Dm', 'G'],
        drums: 'bounce'
    },
    {
        // B': a subida até ao mi de cima e a descida até ao dó.
        melody: ['F5 2, A5 2, C6 2, D6 2', 'E6 2, D6 1, C6 1, G5 4', 'A5 1, B5 1, C6 1, D6 1, E6 2, D6 2', 'C6 6, - 2'],
        chords: ['F', 'C', 'Am G', 'C'],
        drums: 'bounce'
    },
    {
        // Ponte: notas longas, só bombo e pratos — a montra da pastelaria.
        melody: ['G5 4, E5 4', 'F5 4, A5 4', 'G5 2, F5 2, E5 2, D5 2', 'C5 6, - 2'],
        chords: ['C', 'F', 'G', 'C'],
        drums: 'calm'
    }
];

const BARS = SECTIONS.flatMap((section) =>
    section.melody.map((text, i) => {
        const halves = section.chords[i].split(' ').map(chord);
        return { melody: bar(text), chords: [halves[0], halves[halves.length - 1]], drums: section.drums };
    })
);

// ---------- Instrumentos ----------

let bus = null;

function pluck(time, m, duration, velocity) {
    const { ctx } = bus;
    const f = freq(m);
    const end = time + Math.min(duration, 0.5);

    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.value = f;
    const lp = bus.filter('lowpass', 900, 1.2);
    lp.frequency.setValueAtTime(4200, time);
    lp.frequency.exponentialRampToValueAtTime(900, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(velocity * 0.35, time + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    sq.connect(lp);
    lp.connect(g);

    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.value = f * 2;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, time);
    bg.gain.linearRampToValueAtTime(velocity * 0.35, time + 0.003);
    bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
    bell.connect(bg);

    const out = ctx.createGain();
    g.connect(out);
    bg.connect(out);
    for (const osc of [sq, bell]) {
        osc.start(time);
        osc.stop(end + 0.2);
    }
    bus.route(out, time, { pan: 0.08, send: 0.22 });
}

function bass(time, m, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.24);
    bus.route(g, time, { pan: -0.05, send: 0.05 });
}

/** Um acorde de cavaquinho, curtinho, no contratempo. */
function strum(time, c, velocity) {
    const { ctx } = bus;
    const lp = bus.filter('lowpass', 2200, 0.7);
    const out = ctx.createGain();
    out.gain.value = 1;
    lp.connect(out);
    [12, 12 + c.third, 19].forEach((interval, i) => {
        const t = time + i * 0.008;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq(c.root + interval + 12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(velocity, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        osc.connect(g);
        g.connect(lp);
        osc.start(t);
        osc.stop(t + 0.16);
    });
    bus.route(out, time, { pan: -0.25, send: 0.15 });
}

function kick(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.3);
    bus.route(g, time, { send: 0.04 });
}

function snare(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.18);
    const band = bus.filter('bandpass', 1900, 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    n.connect(band);
    band.connect(g);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(240, time);
    body.frequency.exponentialRampToValueAtTime(170, time + 0.06);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(velocity * 0.5, time);
    bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    body.connect(bg);
    body.start(time);
    body.stop(time + 0.1);
    const out = ctx.createGain();
    g.connect(out);
    bg.connect(out);
    bus.route(out, time, { pan: 0.1, send: 0.18 });
}

function hat(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.06);
    const hp = bus.filter('highpass', 8000, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: 0.3, send: 0.06 });
}

// ---------- Agendador ----------

function scheduleStep(b, s, time) {
    const human = () => 0.9 + Math.random() * 0.15;
    for (const note of b.melody) {
        if (note.step === s) pluck(time, note.midi, note.steps * STEP, (s % 4 === 0 ? 0.2 : 0.17) * human());
    }

    const c = b.chords[s < 8 ? 0 : 1];
    if (s % 4 === 0) bass(time, c.root + (s % 8 === 0 ? 0 : 7), 0.32 * human());
    if (b.drums === 'bounce' && s % 4 === 2) strum(time, c, 0.05 * human());

    if (b.drums === 'calm') {
        if (s === 0 || s === 8) kick(time, 0.3);
        if (s % 4 === 0) hat(time, 0.02 * human());
        return;
    }
    if (s === 0 || s === 8 || s === 10) kick(time, s === 10 ? 0.22 : 0.42);
    if (s === 4 || s === 12) snare(time, 0.11 * human());
    if (s % 2 === 0) hat(time, (s % 4 === 2 ? 0.035 : 0.022) * human());
}

export const music = createMusic({
    audio,
    storageKey: MUSIC_STORAGE_KEY,
    bpm: BPM,
    bars: BARS.length,
    volume: 0.24,
    reverb: { seconds: 1.8, decay: 2.8, wet: 0.7 },
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});
