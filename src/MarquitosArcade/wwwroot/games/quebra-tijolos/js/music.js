import { bar, createMusic, freq } from '/lib/arcade/music.js';
import { audio } from './audio.js';
import { MUSIC_STORAGE_KEY } from './config.js';

const LEAD = [
    bar('E5 2, G5 1, A5 1, B5 2, A5 2'),
    bar('G5 2, E5 2, D5 2, E5 2'),
    bar('A5 2, B5 1, D6 1, E6 2, D6 2'),
    bar('B5 2, A5 2, G5 2, E5 2')
];

const BASS = [
    bar('E3 2, - 2, E3 2, - 2'),
    bar('C3 2, - 2, D3 2, - 2'),
    bar('A2 2, - 2, A2 2, - 2'),
    bar('B2 2, - 2, E3 2, - 2')
];

function pulse(bus, time, midi, steps, volume, pan = 0) {
    const ctx = bus.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq(midi);
    const gain = ctx.createGain();
    const duration = steps * (60 / 132 / 4);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.04);
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + duration + 0.1);
    bus.route(gain, time, { pan, send: 0.14 });
}

function click(bus, time, tone, volume) {
    const ctx = bus.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(tone, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + 0.08);
    bus.route(gain, time, { pan: 0.12, send: 0.04 });
}

export const music = createMusic({
    audio,
    storageKey: MUSIC_STORAGE_KEY,
    bpm: 132,
    bars: LEAD.length,
    volume: 0.24,
    reverb: { seconds: 1.6, decay: 2.1, wet: 0.3 },
    onStep(barIndex, step, time, bus) {
        for (const note of LEAD[barIndex]) if (note.step === step) pulse(bus, time, note.midi, note.steps, 0.11, 0.16);
        for (const note of BASS[barIndex]) if (note.step === step) pulse(bus, time, note.midi, note.steps, 0.08, -0.16);
        if (step % 4 === 0) click(bus, time, 220 + barIndex * 12, 0.024);
        if (step % 4 === 2) click(bus, time, 420, 0.018);
    }
});
