// Música de fundo da Memória Animal: uma melodia calma ao piano, com a mão
// esquerda em arpejos e uma bateria de vassouras a acompanhar.
//
// Tudo sintetizado, sem ficheiros de áudio (como os efeitos em audio.js):
//
// - Piano: uma corda de piano é quase um som harmónico, forte na fundamental e
//   com os harmónicos a enfraquecer — aqui uma onda periódica feita à medida,
//   em duas "cordas" ligeiramente desafinadas uma da outra (o coro das cordas
//   do mesmo martelo). O brilho do ataque apaga-se com um passa-baixo que vai
//   fechando, e o volume cai depressa logo a seguir ao martelo e depois devagar,
//   mais devagar nas notas graves. Um toque de ruído é o martelo na corda.
//   A mão esquerda deixa as notas soar até ao fim do meio compasso, como quem
//   tem o pedal carregado.
// - Bateria: bombo redondo e baixo, vassoura na tarola (ruído a entrar devagar,
//   em vez de um estalo), pratos de choque fechados e macios, e dois timbalões
//   a fechar as frases.
// - Um reverb feito com uma resposta ao impulso gerada (ruído a decair) dá a
//   sala. O piano manda mais para lá do que a bateria.
//
// A forma do tema (20 compassos, pouco mais de um minuto) repete-se: A, A',
// B, B' e uma secção calma de notas longas com a bateria a meio tempo — num
// jogo da memória está-se a pensar, e a música não pode puxar pela atenção.
//
// O agendamento é o padrão do Web Audio (o mesmo do Terras do Reino): um
// setTimeout grosseiro acorda de 30 em 30 ms e marca com precisão de amostra as
// notas dos próximos 150 ms, pelo relógio do AudioContext.

import { readText, writeText } from '/lib/arcade/storage.js';
import { audio } from './audio.js';

const STORAGE_KEY = 'memoriaAnimalMusic_v1';

const BPM = 76;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;

/** Volume mestre da música, por baixo dos efeitos sonoros. */
const VOLUME = 0.4;
const FADE_IN = 1.8;
const FADE_OUT = 0.5;

const SCHEDULE_AHEAD = 0.15;
const LOOKAHEAD_MS = 30;

// ---------- Partitura ----------

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Bb5" → MIDI 82. Aceita sustenidos (#) e bemóis (b). */
function midi(name) {
    const accidental = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
    return 12 * (Number(name.slice(-1)) + 1) + NOTE_INDEX[name[0]] + accidental;
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
 * Um acorde para a mão esquerda: "F", "Dm", "Bb"… A fundamental fica entre o
 * Lá 2 e o Sol 3, para os arpejos nunca subirem até à melodia.
 */
function chord(name) {
    const minor = name.endsWith('m');
    let root = midi(`${minor ? name.slice(0, -1) : name}3`);
    if (root > 56) root -= 12;
    return { root, third: minor ? 3 : 4 };
}

/**
 * Fá maior — o tom das canções de embalar. Cada secção tem quatro compassos;
 * `chords` dá o acorde de cada compasso (dois, separados por espaço, mudam a
 * meio) e `drums` o padrão da bateria.
 */
const SECTIONS = [
    {
        // A: a frase que fica no ouvido, a subir pelo acorde de Fá.
        melody: ['C5 2, F5 2, A5 3, G5 1', 'F5 2, D5 2, E5 1, F5 1, A5 2', 'Bb5 3, A5 1, G5 2, F5 2', 'G5 6, - 2'],
        chords: ['F', 'Dm', 'Bb', 'C'],
        drums: 'groove'
    },
    {
        // A': a mesma pergunta, mais alto, e volta a casa.
        melody: ['C5 2, F5 2, A5 3, G5 1', 'F5 2, A5 2, D6 3, C6 1', 'Bb5 2, D6 1, Bb5 1, G5 2, E5 2', 'F5 6, - 2'],
        chords: ['F', 'Dm', 'Bb C', 'F'],
        drums: 'groove'
    },
    {
        // B: começa lá em cima e desce devagar.
        melody: ['D6 3, C6 1, Bb5 2, F5 2', 'A5 3, G5 1, F5 2, C5 2', 'D5 2, G5 2, Bb5 2, A5 1, G5 1', 'E5 3, F5 1, G5 4'],
        chords: ['Bb', 'F', 'Gm', 'C'],
        drums: 'groove'
    },
    {
        // B': o ponto mais alto, e a descida até ao fá.
        melody: ['D6 3, C6 1, Bb5 2, D6 2', 'C6 3, A5 1, E5 2, A5 2', 'Bb5 2, A5 1, G5 1, E5 2, C5 2', 'F5 6, - 2'],
        chords: ['Bb', 'Am', 'Gm C', 'F'],
        drums: 'groove'
    },
    {
        // Calma: notas longas e graves, acordes em bloco e a bateria a meio
        // tempo — o descanso antes de o tema voltar.
        melody: ['A4 8', 'F5 4, D5 4', 'C5 4, A4 4', 'G4 6, - 2'],
        chords: ['Dm', 'Bb', 'F', 'C'],
        drums: 'calm'
    }
];

/** A partitura desdobrada por compasso: { melody: [...], chords: [meio 1, meio 2], drums, fill }. */
const BARS = SECTIONS.flatMap((section, si) =>
    section.melody.map((text, i) => {
        const names = section.chords[i].split(' ');
        const halves = names.map(chord);
        return {
            melody: bar(text),
            chords: [halves[0], halves[halves.length - 1]],
            drums: section.drums,
            // Os timbalões fecham a frase no fim de A' e de B' — as que voltam a casa.
            fill: i === 3 && (si === 1 || si === 3)
        };
    })
);

// ---------- Estado ----------

let enabled = readText(STORAGE_KEY) !== '0';
/** O jogo quer música agora (não está em pausa nem escondido)? */
let wanted = false;
let playing = false;
let timerId = null;
let step = 0;
let nextTime = 0;

/** Os nós fixos: mestre, compressor, reverb, ruído e o timbre do piano. Criados uma vez por contexto. */
let bus = null;

function buildBus(ctx) {
    const master = ctx.createGain();
    master.gain.value = 0;

    // Um compressor brando segura os picos quando os acordes se juntam ao bombo.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx, 2.8, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.85;

    reverb.connect(wet);
    wet.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    // Ruído branco, reutilizado pelo martelo do piano e pela bateria.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // O timbre da corda: a fundamental forte e os harmónicos a enfraquecer.
    // O passa-baixo de cada nota decide quantos deles se ouvem a cada instante.
    const partials = [0, 1, 0.6, 0.32, 0.22, 0.13, 0.08, 0.05, 0.035, 0.02];
    const pianoWave = ctx.createPeriodicWave(new Float32Array(partials.length), new Float32Array(partials));

    return { ctx, master, reverb, noise, pianoWave };
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
    // Cada som apanha o ruído num sítio diferente, para não soarem iguais.
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

/**
 * Uma nota de piano. `duration` é quanto tempo a tecla fica carregada: a nota
 * vai-se apagando sozinha e, ao largar, o abafador cala-a.
 */
function piano(time, m, duration, velocity, pan = 0) {
    const { ctx, pianoWave } = bus;
    const f = freq(m);
    // As cordas graves soam muito mais tempo do que as agudas.
    const ring = Math.min(1.6, Math.max(0.45, 1.25 - (m - 60) * 0.03));
    const end = time + Math.max(duration, 0.3);
    const stopAt = end + 0.45;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(velocity, time + 0.005);
    // Logo a seguir ao martelo cai depressa; depois vai-se apagando devagar.
    out.gain.setTargetAtTime(velocity * 0.42, time + 0.005, 0.09);
    out.gain.setTargetAtTime(0.0001, time + 0.25, ring);
    // O abafador.
    out.gain.setTargetAtTime(0, end, 0.08);

    // O brilho do martelo apaga-se primeiro: o filtro vai fechando.
    const bright = Math.min(f * (5 + velocity * 12), 9000);
    const tone = filter('lowpass', bright, 0.4);
    tone.frequency.setValueAtTime(bright, time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 220), time + 1.4);
    tone.connect(out);

    // Duas cordas por nota, uma nada acima e outra nada abaixo.
    for (const detune of [-3, 3.5]) {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(pianoWave);
        osc.frequency.value = f;
        osc.detune.value = detune;
        osc.connect(tone);
        osc.start(time);
        osc.stop(stopAt);
    }

    // O martelo: um toque curto de ruído à volta do tom.
    const hammer = noiseSource(time, time + 0.05);
    const hammerBand = filter('bandpass', Math.min(f * 3, 4000), 1.5);
    const hammerGain = ctx.createGain();
    hammerGain.gain.setValueAtTime(velocity * 0.18, time);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    hammer.connect(hammerBand);
    hammerBand.connect(hammerGain);
    hammerGain.connect(out);

    route(out, time, { pan, send: 0.38 });
}

function kick(time, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.42);
    route(g, time, { send: 0.06 });
}

/** Vassoura na tarola: o ruído entra devagar e varre, em vez de estalar. */
function brush(time, velocity) {
    const { ctx } = bus;
    const n = noiseSource(time, time + 0.32);
    const band = filter('bandpass', 2800, 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.018);
    g.gain.exponentialRampToValueAtTime(velocity * 0.3, time + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    n.connect(band);
    band.connect(g);

    // Um fio da pele por baixo, para não ser só ar.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(velocity * 0.35, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    osc.connect(og);
    osc.start(time);
    osc.stop(time + 0.15);

    const out = ctx.createGain();
    g.connect(out);
    og.connect(out);
    route(out, time, { pan: -0.12, send: 0.25 });
}

function hat(time, velocity) {
    const { ctx } = bus;
    const n = noiseSource(time, time + 0.08);
    const hp = filter('highpass', 7800, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    n.connect(hp);
    hp.connect(g);
    route(g, time, { pan: 0.25, send: 0.1 });
}

function tom(time, pitch, velocity) {
    const { ctx } = bus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.75, time + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.38);
    route(g, time, { pan: pitch > 140 ? 0.2 : -0.2, send: 0.22 });
}

// ---------- Mão esquerda ----------

/**
 * Arpejo em colcheias, de meio em meio compasso: fundamental, quinta, a terceira
 * uma oitava acima e de novo a quinta. Cada nota fica a soar até ao fim do meio
 * compasso, como com o pedal carregado. Na calma, o acorde em bloco.
 */
function playLeftHand(b, s, time) {
    const half = s < 8 ? 0 : 1;
    const c = b.chords[half];
    const human = () => 0.92 + Math.random() * 0.1;

    if (b.drums === 'calm') {
        if (s % 8 !== 0) return;
        const hold = STEP * 8;
        piano(time, c.root, hold, 0.12 * human(), -0.15);
        piano(time + 0.012, c.root + 7, hold, 0.08 * human(), -0.1);
        piano(time + 0.024, c.root + 12 + c.third, hold, 0.08 * human(), -0.05);
        return;
    }

    if (s % 2 !== 0) return;
    const pattern = [0, 7, 12 + c.third, 7];
    const i = (s % 8) / 2;
    const hold = STEP * (8 - (s % 8));
    // A fundamental a abrir cada meio compasso vai um pouco mais forte.
    const velocity = (i === 0 ? 0.13 : 0.085) * human();
    piano(time, c.root + pattern[i], hold, velocity, -0.15);
}

// ---------- Padrões da bateria ----------

/** O que toca em cada semicolcheia de um compasso. */
function playDrums(b, s, time) {
    const human = () => 0.88 + Math.random() * 0.24;

    if (b.drums === 'calm') {
        if (s === 0) kick(time, 0.4);
        if (s === 8) brush(time, 0.05 * human());
        if (s % 4 === 0) hat(time, 0.025 * human());
        return;
    }

    // Bombo no 1 e no 3 (e um mais leve antes do 3); vassoura no 2 e no 4.
    if (s === 0 || s === 8) kick(time, 0.5);
    if (s === 6 && !b.fill) kick(time, 0.22);
    if (s === 4 || (s === 12 && !b.fill)) brush(time, 0.09 * human());
    // Pratos em colcheias, com acento nos contratempos.
    if (s % 2 === 0) hat(time, (s % 4 === 2 ? 0.045 : 0.028) * human());

    // Os timbalões a fechar a frase, no último tempo.
    if (b.fill) {
        if (s === 12) tom(time, 175, 0.24);
        if (s === 14) tom(time, 131, 0.26);
    }
}

// ---------- Agendador ----------

function scheduleStep(n, time) {
    const b = BARS[Math.floor(n / STEPS_PER_BAR) % BARS.length];
    const s = n % STEPS_PER_BAR;

    for (const note of b.melody) {
        if (note.step !== s) continue;
        // A primeira nota de cada compasso vai um nadinha mais forte.
        const velocity = (s === 0 ? 0.24 : 0.2) * (0.92 + Math.random() * 0.1);
        piano(time, note.midi, note.steps * STEP * 0.95, velocity, 0.1);
    }

    playLeftHand(b, s, time);
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
