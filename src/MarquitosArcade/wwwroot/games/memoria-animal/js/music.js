// Música de fundo da Memória Animal: uma melodia calma na marimba (o xilofone
// de lâminas de madeira, mais grave e redondo), com a mão esquerda em arpejos e
// uma bateria de vassouras a acompanhar.
//
// Tudo sintetizado, sem ficheiros de áudio (como os efeitos em audio.js):
//
// - Marimba: cada lâmina soa quase só a fundamental, uma onda sinusoidal, com
//   um harmónico duas oitavas acima (a afinação da lâmina) e outro bem mais
//   alto que só se ouve na pancada da baqueta. Nada fica a sustentar: o som cai
//   logo a seguir à pancada, mais devagar nas notas graves — um som que
//   sustenta com muitos harmónicos soaria a metal. As notas longas da melodia
//   vão em rulo, com toques leves em colcheias.
// - Bateria: bombo redondo e baixo, vassoura na tarola (ruído a entrar devagar,
//   em vez de um estalo), pratos de choque fechados e macios, e dois timbalões
//   a fechar as frases.
// - Um reverb feito com uma resposta ao impulso gerada (ruído a decair) dá a
//   sala. A marimba manda mais para lá do que a bateria.
//
// A forma do tema (20 compassos, pouco mais de um minuto) repete-se: A, A',
// B, B' e uma secção calma de notas longas com a bateria a meio tempo — num
// jogo da memória está-se a pensar, e a música não pode puxar pela atenção.
//
// O motor — o bus com o reverb e o compressor, o agendador, ligar e desligar —
// é o da arcada (/lib/arcade/music.js); aqui ficam a partitura e os instrumentos.

import { bar, createMusic, freq, midi } from '/lib/arcade/music.js';
import { audio } from './audio.js';

const BPM = 76;
/** Duração de uma semicolcheia (o passo da grelha), em segundos. */
const STEP = 60 / BPM / 4;

// ---------- Partitura ----------

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

// ---------- Bus ----------

/** O bus onde se está a tocar (o do jogo, ou um OfflineAudioContext a gravar): chega em cada passo. */
let bus = null;

/**
 * As lâminas de uma marimba: a fundamental e os harmónicos que a afinação da
 * lâmina deixa ficar — [razão da frequência, força, quanto do decaimento dura].
 * Os de cima apagam-se muito antes da fundamental, e só dão a batida da baqueta.
 */
const BAR_PARTIALS = [
    [1, 1, 1],
    [4, 0.2, 0.28],
    [9.8, 0.05, 0.1]
];

// ---------- Instrumentos ----------

/**
 * Uma nota de marimba: ondas sinusoidais que decaem sozinhas desde a pancada,
 * sem sustentação (é isso que a afasta de um metal). `duration` é quanto tempo
 * a lâmina pode soar antes de a mão a abafar.
 */
function mallet(time, m, duration, velocity, pan = 0) {
    const { ctx } = bus;
    const f = freq(m);
    // As lâminas graves soam mais tempo do que as agudas.
    const ring = Math.min(0.85, Math.max(0.26, 0.55 - (m - 60) * 0.02));
    const end = time + Math.max(duration, 0.2);
    const stopAt = Math.min(end, time + ring * 5) + 0.3;

    const out = ctx.createGain();
    out.gain.setValueAtTime(1, time);
    // A mão abafa a lâmina.
    out.gain.setTargetAtTime(0, end, 0.05);

    for (const [ratio, level, decay] of BAR_PARTIALS) {
        if (f * ratio > 12000) continue;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(velocity * level, time + 0.003);
        g.gain.setTargetAtTime(0.0001, time + 0.003, ring * decay);
        osc.connect(g);
        g.connect(out);
        osc.start(time);
        osc.stop(stopAt);
    }

    bus.route(out, time, { pan, send: 0.3 });
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
    bus.route(g, time, { send: 0.06 });
}

/** Vassoura na tarola: o ruído entra devagar e varre, em vez de estalar. */
function brush(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.32);
    const band = bus.filter('bandpass', 2800, 0.6);
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
    bus.route(out, time, { pan: -0.12, send: 0.25 });
}

function hat(time, velocity) {
    const { ctx } = bus;
    const n = bus.noise(time, time + 0.08);
    const hp = bus.filter('highpass', 7800, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(velocity, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    n.connect(hp);
    hp.connect(g);
    bus.route(g, time, { pan: 0.25, send: 0.1 });
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
    bus.route(g, time, { pan: pitch > 140 ? 0.2 : -0.2, send: 0.22 });
}

// ---------- Mão esquerda ----------

/**
 * Arpejo em colcheias, de meio em meio compasso: fundamental, quinta, a terceira
 * uma oitava acima e de novo a quinta. Cada nota fica a soar até ao fim do meio
 * compasso (a lâmina apaga-se sozinha antes, se for aguda). Na calma, o acorde em bloco.
 */
function playLeftHand(b, s, time) {
    const half = s < 8 ? 0 : 1;
    const c = b.chords[half];
    const human = () => 0.92 + Math.random() * 0.1;

    if (b.drums === 'calm') {
        if (s % 8 !== 0) return;
        const hold = STEP * 8;
        mallet(time, c.root, hold, 0.16 * human(), -0.15);
        mallet(time + 0.012, c.root + 7, hold, 0.11 * human(), -0.1);
        mallet(time + 0.024, c.root + 12 + c.third, hold, 0.11 * human(), -0.05);
        return;
    }

    if (s % 2 !== 0) return;
    const pattern = [0, 7, 12 + c.third, 7];
    const i = (s % 8) / 2;
    const hold = STEP * (8 - (s % 8));
    // A fundamental a abrir cada meio compasso vai um pouco mais forte.
    const velocity = (i === 0 ? 0.16 : 0.11) * human();
    mallet(time, c.root + pattern[i], hold, velocity, -0.15);
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

function scheduleStep(b, s, time) {
    for (const note of b.melody) {
        if (note.step !== s) continue;
        // A primeira nota de cada compasso vai um nadinha mais forte.
        const velocity = (s === 0 ? 0.3 : 0.26) * (0.92 + Math.random() * 0.1);
        const length = note.steps * STEP * 0.95;
        mallet(time, note.midi, length, velocity, 0.1);
        // As notas longas em rulo, como na marimba: toques leves em colcheias.
        if (note.steps >= 6) {
            for (let r = 2; r < note.steps; r += 2) {
                mallet(time + r * STEP, note.midi, length - r * STEP, velocity * 0.45, 0.1);
            }
        }
    }

    playLeftHand(b, s, time);
    playDrums(b, s, time);
}

export const music = createMusic({
    audio,
    storageKey: 'memoriaAnimalMusic_v1',
    bpm: BPM,
    bars: BARS.length,
    volume: 0.22,
    reverb: { seconds: 2.8, decay: 2.4, wet: 0.85 },
    onStep(barIndex, s, time, b) {
        bus = b;
        scheduleStep(BARS[barIndex], s, time);
    }
});
