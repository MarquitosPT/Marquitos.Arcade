// Motor de música de fundo dos jogos: tudo sintetizado, sem ficheiros de áudio.
//
// O jogo traz a partitura e os instrumentos; o motor dá o resto:
//
// - A escrita da partitura: `midi('F#5')`, `freq(m)` e `bar('D5 3, E5 1, …')`.
// - O "bus": mestre (com os fades), um compressor brando, um reverb com uma
//   resposta ao impulso gerada (ruído a decair) e um buffer de ruído branco
//   para tudo o que sopra, raspa ou bate. Mais `route`, `noise` e `filter`, os
//   três gestos que qualquer instrumento repete.
// - O agendador, no padrão do Web Audio: um setTimeout grosseiro acorda de
//   tantos em tantos ms e marca com precisão de amostra as notas dos próximos
//   150 ms, pelo relógio do AudioContext. O jogo só diz o que toca em cada
//   semicolcheia (`onStep`).
// - Ligar e desligar: lembrado no aparelho, e a tocar só quando o jogo a quer
//   (fora da pausa, com a página à vista) e já há AudioContext.
//
// Um exemplo mínimo:
//
//     import { bar, createMusic } from '/lib/arcade/music.js';
//     import { audio } from './audio.js';
//
//     const BARS = ['C5 4, E5 4', 'G5 8'].map(bar);
//
//     export const music = createMusic({
//         audio, storageKey: 'oMeuJogoMusic_v1', bpm: 90, bars: BARS.length,
//         onStep(barIndex, s, time, bus) {
//             for (const note of BARS[barIndex]) if (note.step === s) flute(bus, time, note);
//         }
//     });
//
// E, no main.js, `music.setWanted(...)`, `bindMusicButton(...)` e
// `unlockAudioOnGesture(...)` (mais abaixo), que arranca a música mal o ecrã
// de arranque sai, se o browser deixar, ou no primeiro gesto.
//
// Para ouvir sem abrir o jogo, `music.schedule(offlineContext)` marca uma volta
// inteira num OfflineAudioContext (é o que faz o tools/games/render-music.mjs).

import { readText, writeText } from './storage.js';

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#5" → MIDI 78, "Bb4" → 70. Aceita sustenidos (#) e bemóis (b). */
export function midi(name) {
    const accidental = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
    return 12 * (Number(name.slice(-1)) + 1) + NOTE_INDEX[name[0]] + accidental;
}

/** Frequência de uma nota MIDI, com o Lá 4 a 440 Hz. */
export const freq = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * Um compasso de melodia: "nota colcheias" separadas por vírgulas, com "-" para
 * pausa (`'D5 3, E5 1, F5 2, - 2'`). Com a grelha em semicolcheias, cada
 * colcheia são dois passos e 0.5 é uma semicolcheia; um compasso de 4/4 soma 8.
 * @returns {{ step: number, midi: number, steps: number }[]}
 */
export function bar(text) {
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

/**
 * @typedef {object} MusicBus
 * @property {BaseAudioContext} ctx
 * @property {GainNode} master Volume mestre (é aqui que vivem os fades).
 * @property {ConvolverNode} reverb Entrada do reverb.
 * @property {AudioBuffer} noiseBuffer Dois segundos de ruído branco.
 * @property {(node: AudioNode, time: number, opts?: { pan?: number, send?: number }) => void} route
 *   Liga `node` ao mestre (seco) e ao reverb (molhado), com o pan e o envio pedidos.
 * @property {(time: number, stopAt: number) => AudioBufferSourceNode} noise
 *   Uma fonte de ruído a tocar de `time` a `stopAt`, cada uma num sítio diferente do buffer.
 * @property {(type: BiquadFilterType, frequency: number, q?: number) => BiquadFilterNode} filter
 */

function buildBus(ctx, { compressor, reverb: room }) {
    const master = ctx.createGain();
    master.gain.value = 0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = compressor.threshold;
    comp.knee.value = compressor.knee;
    comp.ratio.value = compressor.ratio;
    comp.attack.value = compressor.attack;
    comp.release.value = compressor.release;

    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(ctx, room.seconds, room.decay);
    const wet = ctx.createGain();
    wet.gain.value = room.wet;

    reverb.connect(wet);
    wet.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    /** @type {MusicBus} */
    const bus = {
        ctx, master, reverb, noiseBuffer,

        route(node, time, { pan = 0, send = 0.2 } = {}) {
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
        },

        noise(time, stopAt) {
            const src = ctx.createBufferSource();
            src.buffer = noiseBuffer;
            src.loop = true;
            src.start(time, Math.random() * 1.5);
            src.stop(stopAt);
            return src;
        },

        filter(type, frequency, q = 1) {
            const f = ctx.createBiquadFilter();
            f.type = type;
            f.frequency.value = frequency;
            f.Q.value = q;
            return f;
        }
    };
    return bus;
}

/**
 * @param {object} options
 * @param {{ context: AudioContext|null }} options.audio O motor de `createAudio` do jogo: a música usa o mesmo AudioContext.
 * @param {string} options.storageKey Onde fica lembrado se a música está ligada.
 * @param {number} options.bars Compassos da partitura; depois do último volta ao primeiro.
 * @param {(barIndex: number, step: number, time: number, bus: MusicBus) => void} options.onStep
 *   O que toca na semicolcheia `step` (0 a stepsPerBar-1) do compasso `barIndex`, à hora `time`, no `bus`.
 * @param {(bus: MusicBus) => object|void} [options.setup] Chamado uma vez por bus montado (um por
 *   AudioContext): o que devolver junta-se ao bus — os nós fixos e os timbres dos instrumentos do jogo.
 * @param {number} options.bpm Tempos (semínimas) por minuto.
 * @param {number} [options.stepsPerBar=16] Semicolcheias por compasso: 16 num 4/4, 12 num 3/4.
 * @param {number} [options.volume=0.4] Volume mestre, por baixo dos efeitos sonoros.
 * @param {number} [options.fadeIn=1.8]
 * @param {number} [options.fadeOut=0.5]
 * @param {number} [options.lookaheadMs=30] De quanto em quanto tempo o agendador acorda.
 * @param {number} [options.scheduleAhead=0.15] Quantos segundos à frente marca as notas.
 * @param {object} [options.compressor] threshold, knee, ratio, attack, release.
 * @param {object} [options.reverb] seconds, decay (do impulso) e wet (quanto volta ao mestre).
 */
export function createMusic({
    audio,
    storageKey,
    bpm,
    bars,
    onStep,
    setup = () => {},
    stepsPerBar = 16,
    volume = 0.4,
    fadeIn = 1.8,
    fadeOut = 0.5,
    lookaheadMs = 30,
    scheduleAhead = 0.15,
    compressor = {},
    reverb = {}
}) {
    // O passo é sempre a semicolcheia (quatro por tempo), seja o compasso de 4/4 ou de 3/4.
    const secondsPerStep = (beatsPerMinute) => 60 / beatsPerMinute / 4;
    /** Duração de um passo da grelha, em segundos — muda com `setBpm`. */
    let stepSeconds = secondsPerStep(bpm);
    /** Um andamento pedido a meio de um compasso, à espera do compasso seguinte. */
    let pendingStepSeconds = null;
    const loopSteps = bars * stepsPerBar;
    const busOptions = {
        compressor: { threshold: -18, knee: 12, ratio: 3, attack: 0.01, release: 0.25, ...compressor },
        reverb: { seconds: 2.4, decay: 2.6, wet: 0.9, ...reverb }
    };

    let enabled = readText(storageKey) !== '0';
    /** O jogo quer música agora (não está em pausa nem escondido)? */
    let wanted = false;
    let playing = false;
    let timerId = null;
    let step = 0;
    let nextTime = 0;
    /** @type {MusicBus|null} */
    let bus = null;

    function makeBus(ctx) {
        const b = buildBus(ctx, busOptions);
        Object.assign(b, setup(b));
        return b;
    }

    function useBus(ctx) {
        if (!bus || bus.ctx !== ctx) bus = makeBus(ctx);
        return bus;
    }

    function scheduleStep(n, time, target) {
        onStep(Math.floor(n / stepsPerBar) % bars, n % stepsPerBar, time, target);
    }

    function scheduler() {
        const ctx = audio.context;
        while (nextTime < ctx.currentTime + scheduleAhead) {
            // O andamento só muda no início de um compasso: a meio, soa a tropeção.
            if (pendingStepSeconds !== null && step % stepsPerBar === 0) {
                stepSeconds = pendingStepSeconds;
                pendingStepSeconds = null;
            }
            scheduleStep(step, nextTime, bus);
            nextTime += stepSeconds;
            step = (step + 1) % loopSteps;
        }
        timerId = setTimeout(scheduler, lookaheadMs);
    }

    function start() {
        if (playing || !audio.context) return;
        const { ctx, master } = useBus(audio.context);
        playing = true;
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(volume, now + fadeIn);
        // Retoma do compasso onde ficou, mas sempre do início dele: uma frase
        // cortada a meio soa a erro.
        step -= step % stepsPerBar;
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
        master.gain.linearRampToValueAtTime(0, now + fadeOut);
    }

    function update() {
        if (enabled && wanted && audio.context) start();
        else stop();
    }

    return {
        /** Duração de um passo da grelha, em segundos, ao andamento atual. */
        get stepSeconds() {
            return stepSeconds;
        },
        /** Duração de uma volta inteira da partitura, em segundos, ao andamento de partida. */
        loopSeconds: loopSteps * secondsPerStep(bpm),

        /**
         * Muda o andamento — para a música apertar quando o jogo aperta. A tocar,
         * muda no início do compasso seguinte; parada, muda já.
         */
        setBpm(value) {
            const seconds = secondsPerStep(value);
            if (playing) pendingStepSeconds = seconds;
            else {
                stepSeconds = seconds;
                pendingStepSeconds = null;
            }
        },

        /**
         * Diz à música se o jogo a quer agora. Só toca se, além disso, estiver
         * ligada e já houver AudioContext (o primeiro gesto do jogador).
         */
        setWanted(value) {
            wanted = !!value;
            update();
        },

        get enabled() {
            return enabled;
        },

        /** O botão da música: liga ou desliga, e fica lembrado neste aparelho. */
        toggle() {
            enabled = !enabled;
            writeText(storageKey, enabled ? '1' : '0');
            update();
            return enabled;
        },

        /**
         * Marca a partitura noutro contexto, a partir de `at` segundos, ao
         * andamento atual — para gravar a música num OfflineAudioContext. Por
         * omissão, `loops` voltas inteiras; com `bars`, só esses compassos a
         * partir de `fromBar` (para gravar em pedaços, a mudar o que o jogo
         * pede entre eles). Devolve a hora a que acaba. Não mexe no que está a
         * tocar no jogo.
         */
        schedule(ctx, { loops = 1, at = 0.1, fromBar = 0, bars: count = null } = {}) {
            const offline = makeBus(ctx);
            offline.master.gain.value = volume;
            const first = fromBar * stepsPerBar;
            const total = count === null ? loopSteps * loops : count * stepsPerBar;
            for (let n = 0; n < total; n++) scheduleStep(first + n, at + n * stepSeconds, offline);
            return at + total * stepSeconds;
        }
    };
}

/**
 * O botão Música da barra de topo: `aria-pressed`, título e o traço por cima da
 * nota (o CSS esconde o `.musicSlash` com `aria-pressed="true"`).
 *
 * @param {HTMLElement} button
 * @param {ReturnType<typeof createMusic>} music
 * @param {object} [options]
 * @param {() => unknown} [options.resume] Destranca o áudio (o clique é um gesto).
 * @param {() => void} [options.onToggle] Depois de mudar — em geral, voltar a dizer à música se é querida.
 */
export function bindMusicButton(button, music, { resume = () => {}, onToggle = () => {} } = {}) {
    function refresh() {
        const on = music.enabled;
        button.setAttribute('aria-pressed', String(on));
        const label = on ? 'Desligar a música' : 'Ligar a música';
        button.title = label;
        button.setAttribute('aria-label', label);
    }

    button.addEventListener('click', () => {
        resume();
        music.toggle();
        refresh();
        onToggle();
    });
    refresh();
}

/**
 * O browser só deixa soar depois de um gesto — mas nem sempre: quem chega de
 * outra página da arcada com um clique (o portal, o guia) ou já a usa muito
 * costuma poder ouvir logo. Por isso, assim que o ecrã de arranque sai da
 * frente (`window.__arcadeSplash.done`, ou já, se não houver ecrã), tenta-se
 * sem gesto: se o AudioContext nascer a tocar, chama `onUnlock` e a música
 * começa no menu. Se não, fica à espera do primeiro toque ou tecla, onde quer
 * que seja (até a escrever o nome), que chama `resume`; quando ele devolver um
 * AudioContext, chama `onUnlock` e deixa de ouvir.
 *
 * @param {() => AudioContext|null|undefined} resume
 * @param {() => void} onUnlock
 */
export function unlockAudioOnGesture(resume, onUnlock) {
    let unlocked = false;

    function finish() {
        if (unlocked) return;
        unlocked = true;
        document.removeEventListener('pointerup', unlock, true);
        document.removeEventListener('keydown', unlock, true);
        onUnlock();
    }

    function unlock() {
        if (resume()) finish();
    }

    /** Sem gesto: só conta se o browser deixar o AudioContext a tocar. */
    function tryWithoutGesture() {
        if (unlocked) return;
        // Onde o browser já diz que não (Firefox), nem se cria o contexto.
        if (navigator.getAutoplayPolicy?.('audiocontext') === 'disallowed') return;
        const ctx = resume();
        if (!ctx) return;
        if (ctx.state === 'running') {
            finish();
            return;
        }
        // O `resume()` pode estar a meio: se acabar a tocar, também serve.
        const onChange = () => {
            if (ctx.state !== 'running') return;
            ctx.removeEventListener('statechange', onChange);
            finish();
        };
        ctx.addEventListener('statechange', onChange);
    }

    document.addEventListener('pointerup', unlock, true);
    document.addEventListener('keydown', unlock, true);

    const splashDone = window.__arcadeSplash?.done ?? Promise.resolve();
    splashDone.then(tryWithoutGesture);
}
