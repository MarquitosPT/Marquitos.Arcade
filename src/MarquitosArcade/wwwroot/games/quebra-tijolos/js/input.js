import { resumeAudio } from './audio.js';
import { game } from './state.js';

export function attachControls(canvas) {
    const keyMap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

    function pointerX(event) {
        const rect = canvas.getBoundingClientRect();
        const touch = event.touches?.[0] || event.changedTouches?.[0] || event;
        return touch.clientX - rect.left;
    }

    function syncPointer(event) {
        const value = pointerX(event);
        game.pointerX = value;
        game.touchMode = event.pointerType === 'touch' || event.type.startsWith('touch');
    }

    document.addEventListener('keydown', (event) => {
        if (event.key in keyMap) {
            game.input[keyMap[event.key]] = true;
            event.preventDefault();
        }
        if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'Enter') {
            game.input.launch = true;
            event.preventDefault();
        }
    });

    document.addEventListener('keyup', (event) => {
        if (event.key in keyMap) {
            game.input[keyMap[event.key]] = false;
            event.preventDefault();
        }
    });

    canvas.addEventListener('pointerdown', (event) => {
        resumeAudio();
        syncPointer(event);
        game.input.launch = true;
        canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', syncPointer);
    canvas.addEventListener('touchstart', (event) => {
        resumeAudio();
        syncPointer(event);
        game.input.launch = true;
    }, { passive: true });
    canvas.addEventListener('touchmove', syncPointer, { passive: true });
    canvas.addEventListener('mousemove', syncPointer);
}

export function consumeLaunch() {
    const launch = game.input.launch;
    game.input.launch = false;
    return launch;
}
