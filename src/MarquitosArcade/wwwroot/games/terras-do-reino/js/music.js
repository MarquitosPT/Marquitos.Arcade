// Música de fundo do Terras do Reino: uma melodia calma em flauta de pã,
// acompanhada por uma batida de bateria suave e um baixo dedilhado.
//
// Tudo sintetizado, sem ficheiros de áudio (como os efeitos em audio.js):
//
// - Flauta de pã: um tubo fechado só tem harmónicos ímpares, fracos — é quase
//   o espectro de uma onda triangular, que aqui se suaviza com um passa-baixo e
//   se engrossa com um seno na fundamental. O que a faz soar a sopro é o ruído:
//   um "chiff" curto no ataque e um fio de ar durante a nota, filtrados à volta
//   do tom. A nota entra ligeiramente abaixo da afinação e só ganha vibrato
//   depois de assentar, como quem sopra.
// - Bateria: bombo (seno com a altura a cair depressa), tarola abafada (ruído
//   num passa-banda com um corpo de seno), shaker (ruído agudo muito curto) e
//   timbalões nas viradas do fim de cada frase.
// - Um reverb feito com uma resposta ao impulso gerada (ruído a decair) dá a
//   sala. A flauta manda mais para lá do que a bateria.
//
// A forma do tema (20 compassos, pouco mais de um minuto) repete-se: A, A',
// B, B' e uma secção calma de notas longas com a bateria a meio tempo — um jogo
// de economia ouve-se durante horas e a música não pode cansar.
//
// O motor — o bus com o reverb e o compressor, o agendador, ligar e desligar —
// é o da arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';

const BPM = 78;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;

// ---------- Partitura ----------

/**
 * Ré dórico — o modo das canções de feira — com o Si natural a dar-lhe o ar
 * antigo. Cada secção tem quatro compassos; `bass` é a fundamental de cada um e
 * `drums` o padrão da bateria.
 */
const SECTIONS = [
    {
        // A: a frase que fica no ouvido.
        melody: ['D5 3, E5 1, F5 2, A5 2', 'G5 3, F5 1, E5 2, C5 2', 'D5 2, F5 2, E5 1, D5 1, C5 2', 'A4 6, - 2'],
        bass: ['D3', 'C3', 'D3', 'A2'],
        drums: 'groove'
    },
    {
        // A': a mesma pergunta, outra resposta, e volta a casa.
        melody: ['D5 3, E5 1, F5 2, A5 2', 'C6 3, A5 1, G5 2, E5 2', 'G5 2, F5 1, E5 1, D5 2, E5 2', 'D5 6, - 2'],
        bass: ['D3', 'C3', 'G2', 'D3'],
        drums: 'groove'
    },
    {
        // B: sobe um pouco mais.
        melody: ['A5 2, C6 2, A5 2, G5 2', 'G5 3, E5 1, C5 4', 'D5 2, G5 2, B5 2, A5 1, G5 1', 'A5 6, - 2'],
        bass: ['F2', 'C3', 'G2', 'A2'],
        drums: 'groove'
    },
    {
        // B': o ponto mais alto, a descer até ao ré.
        melody: ['A5 2, C6 2, D6 2, C6 1, A5 1', 'G5 3, E5 1, G5 2, C6 2', 'A5 2, F5 1, E5 1, D5 2, C5 2', 'D5 6, - 2'],
        bass: ['F2', 'C3', 'D3', 'D3'],
        drums: 'groove'
    },
    {
        // Calma: notas longas, graves, e a bateria a meio tempo — o descanso
        // antes de o tema voltar.
        melody: ['A4 8', 'C5 8', 'D5 4, E5 4', 'D5 6, - 2'],
        bass: ['D3', 'F2', 'G2', 'D3'],
        drums: 'calm'
    }
];

/** A partitura desdobrada por compasso: { melody: [...], bass, drums, fill }. */
const BARS = SECTIONS.flatMap((section) =>
    section.melody.map((text, i) => ({
        melody: bar(text),
        bass: midi(section.bass[i]),
        drums: section.drums,
        // Uma virada nos timbalões a fechar cada frase (menos na calma).
        fill: i === 3 && section.drums === 'groove'
    }))
);

// ---------- Bus ----------

/** O bus onde se está a tocar (o do jogo, ou um OfflineAudioContext a gravar): chega em cada passo. */
let bus = null;

// ---------- Instrumentos ----------

function panFlute(time, m, duration, velocity) {
    const { ctx } = bus;
    const f = freq(m);
    const release = 0.22;
    const end = time + duration;
    const stopAt = end + release + 0.05;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(velocity, time + 0.07);
    // Depois do ataque o sopro assenta um pouco abaixo.
    out.gain.linearRampToValueAtTime(velocity * 0.82, time + 0.3);
    out.gain.setValueAtTime(velocity * 0.82, end);
    out.gain.exponentialRampToValueAtTime(0.0001, end + release);

    // Tom: triângulo suavizado + seno na fundamental.
    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    const body = ctx.createOscillator();
    body.type = 'sine';
    for (const osc of [tone, body]) {
        osc.frequency.setValueAtTime(f * 0.985, time);
        osc.frequency.exponentialRampToValueAtTime(f, time + 0.06);
    }
    const soft = bus.filter('lowpass', f * 2.5, 0.5);
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.55;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.5;
    tone.connect(soft);
    soft.connect(toneGain);
    toneGain.connect(out);
    body.connect(bodyGain);
    bodyGain.connect(out);

    // Vibrato só nas notas longas, e só depois de a nota assentar.
    if (duration > 0.45) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5 + Math.random() * 0.6;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, time);
        depth.gain.setValueAtTime(0, time + 0.3);
        depth.gain.linearRampToValueAtTime(14, time + 0.8); // cêntimos
        lfo.connect(depth);
        depth.connect(tone.detune);
        depth.connect(body.detune);
        lfo.start(time);
        lfo.stop(stopAt);
    }

    // Sopro: um "chiff" no ataque e um fio de ar durante a nota.
    const breath = bus.noise(time, stopAt);
    const breathBand = bus.filter('bandpass', Math.min(f * 2, 6000), 1.2);
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0, time);
    breathGain.gain.linearRampToValueAtTime(0.5, time + 0.015);
    breathGain.gain.exponentialRampToValueAtTime(0.09, time + 0.14);
    breathGain.gain.setValueAtTime(0.09, end);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, end + release);
    breath.connect(breathBand);
    breathBand.connect(breathGain);
    breathGain.connect(out);

    tone.start(time);
    body.start(time);
    tone.stop(stopAt);
    body.stop(stopAt);

    bus.route(out, time, { pan: 0.08, send: 0.45 });
}

function bass(time, m, duration, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq(m), time);
    const lp = bus.filter('lowpass', 700, 0.7);
    lp.frequency.setValueAtTime(1400, time);
    lp.frequency.exponentialRampToValueAtTime(380, time + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.012);
    g.gain.exponentialRampToValueAtTime(velocity * 0.35, time + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(lp);
    lp.connect(g);
    osc.start(time);
    osc.stop(time + duration + 0.05);
    bus.route(g, time, { send: 0.12 });
}

function kick(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.46);
    bus.route(g, time, { send: 0.08 });
}

function snare(time, velocity) {
    const { ctx } = bus;
    // Corpo: um seno curto, como a pele de uma caixa abafada.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(140, time + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(velocity * 0.7, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(og);
    osc.start(time);
    osc.stop(time + 0.18);

    // Esteira: ruído num passa-banda largo.
    const n = bus.noise(time, time + 0.25);
    const band = bus.filter('bandpass', 1900, 0.7);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, time);
    ng.gain.linearRampToValueAtTime(velocity, time + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    n.connect(band);
    band.connect(ng);

    const out = ctx.createGain();
    og.connect(out);
    ng.connect(out);
    bus.route(out, time, { pan: -0.1, send: 0.22 });
}

function shaker(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.1);
    const hp = bus.filter('highpass', 6500, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: 0.3, send: 0.1 });
}

function tom(time, pitch, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, time + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.36);
    bus.route(g, time, { pan: pitch > 150 ? 0.2 : -0.2, send: 0.2 });
}

// ---------- Padrões da bateria ----------

/** O que toca em cada semicolcheia de um compasso. */
function playDrums(b, s, time) {
    const human = () => 0.9 + Math.random() * 0.2;

    if (b.drums === 'calm') {
        if (s === 0) kick(time, 0.5);
        if (s === 8) snare(time, 0.07 * human());
        if (s % 4 === 2) shaker(time, 0.05 * human());
        return;
    }

    // Groove: bombo no 1, no "e" do 2 e no 3; tarola no 2 e no 4.
    if (s === 0 || s === 8) kick(time, 0.62);
    if (s === 6 || (s === 11 && !b.fill)) kick(time, 0.32);
    if (s === 4 || (s === 12 && !b.fill)) snare(time, 0.13 * human());
    // Shaker em semicolcheias, com acento nos contratempos.
    const accent = s % 4 === 2 ? 0.07 : s % 2 === 0 ? 0.045 : 0.025;
    shaker(time, accent * human());

    // Virada: três timbalões a descer no último tempo.
    if (b.fill) {
        if (s === 12) tom(time, 196, 0.32);
        if (s === 13) tom(time, 165, 0.3);
        if (s === 14) tom(time, 131, 0.34);
        if (s === 15) tom(time, 110, 0.26);
    }
}

// ---------- Agendador ----------

function scheduleStep(b, s, time) {
    for (const note of b.melody) {
        if (note.step !== s) continue;
        // A primeira nota de cada compasso vai um nadinha mais forte.
        const velocity = (s === 0 ? 0.2 : 0.17) * (0.93 + Math.random() * 0.1);
        panFlute(time, note.midi, note.steps * STEP * 0.96, velocity);
    }

    // Baixo: fundamental no 1 e quinta no 3 (na calma, só a fundamental).
    if (s === 0) bass(time, b.bass, STEP * (b.drums === 'calm' ? 14 : 7), 0.2);
    if (s === 8 && b.drums !== 'calm') bass(time, b.bass + 7, STEP * 7, 0.14);

    playDrums(b, s, time);
}

export const music = createMusic({
    audio,
    storageKey: 'terrasDoReinoMusic_v1',
    bpm: BPM,
    bars: BARS.length,
    volume: 0.42,
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});
