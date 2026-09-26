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
// O agendamento é o padrão do Web Audio (o mesmo da Tasca do Zé): um setTimeout
// grosseiro acorda de 30 em 30 ms e marca com precisão de amostra as notas dos
// próximos 150 ms, pelo relógio do AudioContext.

import { readText, writeText } from '/lib/arcade/storage.js';
import { audio } from './audio.js';

const STORAGE_KEY = 'terrasDoReinoMusic_v1';

const BPM = 78;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;

/** Volume mestre da música, por baixo dos efeitos sonoros. */
const VOLUME = 0.42;
const FADE_IN = 1.8;
const FADE_OUT = 0.5;

const SCHEDULE_AHEAD = 0.15;
const LOOKAHEAD_MS = 30;

// ---------- Partitura ----------

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "D5" → MIDI 74. */
function midi(name) {
    return 12 * (Number(name.slice(-1)) + 1) + NOTE_INDEX[name[0]];
}

const freq = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * Um compasso de melodia: "nota colcheias" separadas por vírgulas, com "-" para
 * pausa. Cada compasso soma 8 colcheias.
 */
function bar(text) {
    const notes = [];
    let at = 0;
    for (const token of text.split(',')) {
        const [name, len] = token.trim().split(/\s+/);
        const eighths = Number(len);
        if (name !== '-') notes.push({ step: at * 2, midi: midi(name), steps: eighths * 2 });
        at += eighths;
    }
    return notes;
}

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

// ---------- Estado ----------

let enabled = readText(STORAGE_KEY) !== '0';
/** O jogo quer música agora (não está em pausa nem escondido)? */
let wanted = false;
let playing = false;
let timerId = null;
let step = 0;
let nextTime = 0;

/** Os nós fixos: mestre, compressor, reverb. Criados uma vez por contexto. */
let bus = null;

function buildBus(ctx) {
    const master = ctx.createGain();
    master.gain.value = 0;

    // Um compressor brando segura os picos quando bombo e flauta coincidem.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx, 2.4, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;

    reverb.connect(wet);
    wet.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    // Ruído branco, reutilizado por tudo o que sopra ou raspa.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    return { ctx, master, reverb, noise };
}

/** Uma sala: ruído estéreo a decair exponencialmente. */
function impulseResponse(ctx, seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const ir = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
    return ir;
}

function ensureBus() {
    const ctx = audio.context;
    if (!ctx) return null;
    if (!bus || bus.ctx !== ctx) bus = buildBus(ctx);
    return bus;
}

/** Liga `node` ao mestre (seco) e ao reverb (molhado), com o pan e o envio pedidos. */
function route(node, time, { pan = 0, send = 0.2 } = {}) {
    const { ctx, master, reverb } = bus;
    let out = node;
    if (pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.setValueAtTime(pan, time);
        node.connect(p);
        out = p;
    }
    out.connect(master);
    if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        out.connect(s);
        s.connect(reverb);
    }
}

function noiseSource(time, stopAt) {
    const src = bus.ctx.createBufferSource();
    src.buffer = bus.noise;
    src.loop = true;
    // Cada nota apanha o ruído num sítio diferente, para não soarem iguais.
    src.start(time, Math.random() * 1.5);
    src.stop(stopAt);
    return src;
}

function filter(type, frequency, q = 1) {
    const f = bus.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
}

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
    const soft = filter('lowpass', f * 2.5, 0.5);
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
    const breath = noiseSource(time, stopAt);
    const breathBand = filter('bandpass', Math.min(f * 2, 6000), 1.2);
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

    route(out, time, { pan: 0.08, send: 0.45 });
}

function bass(time, m, duration, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq(m), time);
    const lp = filter('lowpass', 700, 0.7);
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
    route(g, time, { send: 0.12 });
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
    route(g, time, { send: 0.08 });
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
    const n = noiseSource(time, time + 0.25);
    const band = filter('bandpass', 1900, 0.7);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, time);
    ng.gain.linearRampToValueAtTime(velocity, time + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    n.connect(band);
    band.connect(ng);

    const out = ctx.createGain();
    og.connect(out);
    ng.connect(out);
    route(out, time, { pan: -0.1, send: 0.22 });
}

function shaker(time, velocity) {
    const { ctx } = bus;
    const n = noiseSource(time, time + 0.1);
    const hp = filter('highpass', 6500, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    n.connect(hp);
    hp.connect(g);
    route(g, time, { pan: 0.3, send: 0.1 });
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
    route(g, time, { pan: pitch > 150 ? 0.2 : -0.2, send: 0.2 });
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

function scheduleStep(n, time) {
    const b = BARS[Math.floor(n / STEPS_PER_BAR) % BARS.length];
    const s = n % STEPS_PER_BAR;

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

function scheduler() {
    const ctx = audio.context;
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(step, nextTime);
        nextTime += STEP;
        step = (step + 1) % (BARS.length * STEPS_PER_BAR);
    }
    timerId = setTimeout(scheduler, LOOKAHEAD_MS);
}

function start() {
    if (playing || !ensureBus()) return;
    const { ctx, master } = bus;
    playing = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(VOLUME, now + FADE_IN);
    // Retoma do compasso onde ficou, mas sempre do início dele: uma frase
    // cortada a meio soa a erro.
    step -= step % STEPS_PER_BAR;
    nextTime = now + 0.08;
    scheduler();
}

function stop() {
    if (!playing) return;
    playing = false;
    clearTimeout(timerId);
    timerId = null;
    const { ctx, master } = bus;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + FADE_OUT);
}

function update() {
    if (enabled && wanted && audio.context) start();
    else stop();
}

/**
 * Diz à música se o jogo a quer agora. Só toca se, além disso, estiver ligada e
 * já houver AudioContext (ver `resumeAudio`).
 */
export function setMusicWanted(value) {
    wanted = !!value;
    update();
}

export function musicEnabled() {
    return enabled;
}

/** O botão da música: liga ou desliga, e fica lembrado neste aparelho. */
export function toggleMusic() {
    enabled = !enabled;
    writeText(STORAGE_KEY, enabled ? '1' : '0');
    update();
    return enabled;
}
