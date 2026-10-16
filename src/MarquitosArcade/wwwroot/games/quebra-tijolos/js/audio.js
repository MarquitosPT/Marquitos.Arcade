import { createAudio } from '/lib/arcade/audio.js';

export const audio = createAudio({ defaultType: 'triangle', defaultVolume: 0.14, attack: 0.008 });
export const resumeAudio = audio.resume;

export const sfx = {
    launch: () => {
        audio.beep(392, 0.05, 'triangle', 0.1);
        audio.beep(523, 0.08, 'triangle', 0.1, 0.05);
    },
    paddle: () => audio.beep(680, 0.035, 'triangle', 0.09),
    wall: () => audio.beep(420, 0.025, 'square', 0.055),
    brick(hit = 1) {
        const base = hit === 3 ? 250 : hit === 2 ? 330 : 420;
        audio.beep(base, 0.045, 'square', 0.09);
        if (hit > 1) audio.beep(base * 1.5, 0.07, 'triangle', 0.06, 0.025);
    },
    steel: () => audio.beep(180, 0.05, 'sawtooth', 0.06),
    life: () => {
        audio.beep(240, 0.12, 'sine', 0.12);
        audio.beep(180, 0.2, 'sine', 0.08, 0.08);
    },
    clear: () => {
        audio.beep(523, 0.09, 'triangle', 0.14);
        audio.beep(659, 0.09, 'triangle', 0.14, 0.09);
        audio.beep(784, 0.12, 'triangle', 0.14, 0.18);
        audio.beep(1047, 0.28, 'triangle', 0.16, 0.28);
    },
    fail: () => {
        audio.beep(392, 0.12, 'sine', 0.12);
        audio.beep(311, 0.15, 'sine', 0.1, 0.09);
        audio.beep(208, 0.24, 'sine', 0.12, 0.18);
    }
};
