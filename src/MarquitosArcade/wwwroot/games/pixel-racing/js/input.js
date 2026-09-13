// Controlos: teclado no computador, botões desenhados no canvas no telemóvel.
//
// Os botões táteis não são elementos de HTML — são círculos pintados no canvas
// (ver render.js) e a deteção do toque é feita à mão contra os mesmos retângulos.
// Assim os controlos acompanham o tamanho do ecrã sem um segundo sistema de
// layout, e não há elementos de HTML por cima do canvas a roubar eventos.

import { resumeAudio } from './audio.js';
import { race } from './state.js';

export const keys = { left: false, right: false, drift: false, boost: false, brake: false };
export const touchState = { left: false, right: false, drift: false, boost: false };

/** Registado pelo main.js: a tecla Escape pede pausa. */
let onPauseRequested = () => {};
export function setPauseHandler(handler) {
    onPauseRequested = handler;
}

const LEFT_KEYS = ['ArrowLeft', 'a', 'A'];
const RIGHT_KEYS = ['ArrowRight', 'd', 'D'];
const BRAKE_KEYS = ['ArrowDown', 's', 'S'];

/** Retângulos dos quatro botões táteis, em coordenadas lógicas do canvas. */
export function buttonRects() {
    const { width: W, height: H } = race.view;
    const size = Math.min(84, W * 0.16);
    const gap = 10;
    const y = H - size - Math.max(18, H * 0.03);
    return {
        left: { x: 18, y, w: size, h: size },
        right: { x: 18 + size + gap, y, w: size, h: size },
        drift: { x: W - size * 2 - gap - 18, y, w: size, h: size },
        boost: { x: W - size - 18, y, w: size, h: size }
    };
}

const inRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/**
 * Recalcula os quatro botões a partir da lista de pontos ativos. É recalculado
 * do zero (e não alternado a cada evento) porque com vários dedos ao mesmo tempo
 * um `touchend` não diz quais é que ficaram — só sobra a lista atual.
 */
function recomputeTouch(points) {
    touchState.left = touchState.right = touchState.drift = touchState.boost = false;
    const rects = buttonRects();
    const bounds = race.view.canvas.getBoundingClientRect();
    for (const point of points) {
        const px = point.clientX - bounds.left;
        const py = point.clientY - bounds.top;
        if (inRect(px, py, rects.left)) touchState.left = true;
        if (inRect(px, py, rects.right)) touchState.right = true;
        if (inRect(px, py, rects.drift)) touchState.drift = true;
        if (inRect(px, py, rects.boost)) touchState.boost = true;
    }
}

export function attachControls(canvas) {
    window.addEventListener('keydown', (e) => {
        if (LEFT_KEYS.includes(e.key)) keys.left = true;
        if (RIGHT_KEYS.includes(e.key)) keys.right = true;
        if (BRAKE_KEYS.includes(e.key)) keys.brake = true;
        if (e.key === 'Shift') keys.drift = true;
        if (e.key === ' ') {
            keys.boost = true;
            e.preventDefault(); // senão a barra de espaços faz scroll à página
        }
        if (e.key === 'Escape') onPauseRequested();
    });

    window.addEventListener('keyup', (e) => {
        if (LEFT_KEYS.includes(e.key)) keys.left = false;
        if (RIGHT_KEYS.includes(e.key)) keys.right = false;
        if (BRAKE_KEYS.includes(e.key)) keys.brake = false;
        if (e.key === 'Shift') keys.drift = false;
        if (e.key === ' ') keys.boost = false;
    });

    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        canvas.addEventListener(type, (e) => {
            e.preventDefault();
            // O primeiro toque é também o gesto que autoriza o áudio.
            if (type === 'touchstart') resumeAudio();
            recomputeTouch(e.touches);
        }, { passive: false });
    }

    let mouseDown = false;
    canvas.addEventListener('mousedown', (e) => {
        mouseDown = true;
        resumeAudio();
        recomputeTouch([e]);
    });
    // No window e não no canvas: largar o rato fora do canvas deixaria o botão preso.
    window.addEventListener('mouseup', () => {
        mouseDown = false;
        recomputeTouch([]);
    });
    canvas.addEventListener('mousemove', (e) => {
        if (mouseDown) recomputeTouch([e]);
    });
}

/** Passa os controlos do jogador para o carro dele. */
export function applyPlayerInput() {
    const { player } = race;
    const left = keys.left || touchState.left;
    const right = keys.right || touchState.right;
    player.steerInput = (right ? 1 : 0) - (left ? 1 : 0);
    player.driftHold = keys.drift || touchState.drift;
    player.boostHold = keys.boost || touchState.boost;
    player.brakeHeld = keys.brake;
}
