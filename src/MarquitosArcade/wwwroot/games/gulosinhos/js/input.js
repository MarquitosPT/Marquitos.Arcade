// Controlos: teclado no computador, três botões desenhados no telemóvel.
//
// Como no Pixel Racing, os botões táteis não são elementos de HTML: são
// círculos pintados no canvas (ver `drawTouchControls` em render.js) e o
// toque é testado à mão contra os mesmos retângulos (`buttonRects`, aqui).
// Recalcula-se tudo a partir da lista de dedos no ecrã a cada evento: com
// dois dedos ao mesmo tempo (correr e saltar), um `touchend` não diz qual
// saiu — só sobra a lista dos que ficaram.
//
// O salto guarda o momento em que foi carregado (`jumpPressed`), além de
// estar carregado ou não: o salto é um gesto, e quem o pede um instante antes
// de aterrar tem de o ver acontecer (ver `JUMP_BUFFER` em config.js).

import { resumeAudio } from './audio.js';
import { game } from './state.js';

export const input = { left: false, right: false, jump: false, jumpPressed: false };

const keys = { left: false, right: false, jump: false };
const touch = { left: false, right: false, jump: false };

const LEFT_KEYS = ['ArrowLeft', 'a', 'A'];
const RIGHT_KEYS = ['ArrowRight', 'd', 'D'];
const JUMP_KEYS = [' ', 'ArrowUp', 'w', 'W', 'z', 'Z', 'k', 'K'];
const PAUSE_KEYS = ['Escape', 'p', 'P'];

let onPauseRequested = () => {};
export function setPauseHandler(handler) {
    onPauseRequested = handler;
}

/**
 * Os três botões, em píxeis lógicos do canvas: as setas à esquerda e o salto,
 * maior, à direita — onde estão os polegares. Ao alto ficam na faixa de baixo
 * (a câmara deixa-a livre, ver camera.js); ao comprido, por cima do mundo.
 */
export function buttonRects() {
    const { width: W, height: H, safeArea } = game.view;
    const band = game.controlsBand;
    const size = band ? Math.min(band * 0.62, W * 0.2, 92) : Math.min(84, H * 0.2);
    const bottom = H - Math.max(safeArea.bottom, 10) - (band ? (band - size) / 2 - 4 : 14);
    const y = bottom - size;
    const left = Math.max(safeArea.left, 12) + 4;
    const right = W - Math.max(safeArea.right, 12) - 4;
    const jumpSize = size * 1.18;
    return {
        left: { x: left, y, w: size, h: size },
        right: { x: left + size + 12, y, w: size, h: size },
        jump: { x: right - jumpSize, y: bottom - jumpSize, w: jumpSize, h: jumpSize }
    };
}

/** O toque conta um pouco para lá do botão desenhado: o polegar não aponta, carrega. */
const SLACK = 14;
const inRect = (px, py, r) => px >= r.x - SLACK && px <= r.x + r.w + SLACK && py >= r.y - SLACK && py <= r.y + r.h + SLACK;

function recomputeTouch(points) {
    const wasJump = touch.jump;
    touch.left = touch.right = touch.jump = false;
    const rects = buttonRects();
    const bounds = game.view.canvas.getBoundingClientRect();
    for (const point of points) {
        const px = point.clientX - bounds.left;
        const py = point.clientY - bounds.top;
        if (inRect(px, py, rects.jump)) touch.jump = true;
        else if (inRect(px, py, rects.left)) touch.left = true;
        else if (inRect(px, py, rects.right)) touch.right = true;
    }
    if (touch.jump && !wasJump) input.jumpPressed = true;
    sync();
}

function sync() {
    input.left = keys.left || touch.left;
    input.right = keys.right || touch.right;
    input.jump = keys.jump || touch.jump;
}

/** Larga tudo — ao pausar, ao sair, ao perder o foco. Nada fica "preso" a correr. */
export function releaseAll() {
    keys.left = keys.right = keys.jump = false;
    touch.left = touch.right = touch.jump = false;
    input.jumpPressed = false;
    sync();
}

export function attachControls(canvas, { onTouchMode } = {}) {
    window.addEventListener('keydown', (event) => {
        if (PAUSE_KEYS.includes(event.key)) {
            onPauseRequested();
            return;
        }
        // Nas caixas de texto (o nome) as teclas são do texto.
        if (event.target instanceof HTMLInputElement) return;
        let used = true;
        if (LEFT_KEYS.includes(event.key)) keys.left = true;
        else if (RIGHT_KEYS.includes(event.key)) keys.right = true;
        else if (JUMP_KEYS.includes(event.key)) {
            if (!keys.jump && !event.repeat) input.jumpPressed = true;
            keys.jump = true;
        } else used = false;
        if (!used) return;
        // As setas e o espaço fazem scroll à página; num jogo em ecrã inteiro só atrapalha.
        if (game.phase !== 'menu' && game.phase !== 'result') event.preventDefault();
        resumeAudio();
        sync();
    });

    window.addEventListener('keyup', (event) => {
        if (LEFT_KEYS.includes(event.key)) keys.left = false;
        if (RIGHT_KEYS.includes(event.key)) keys.right = false;
        if (JUMP_KEYS.includes(event.key)) keys.jump = false;
        sync();
    });

    window.addEventListener('blur', releaseAll);

    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        canvas.addEventListener(type, (event) => {
            event.preventDefault();
            if (type === 'touchstart') {
                resumeAudio();
                if (!game.touchMode) {
                    game.touchMode = true;
                    onTouchMode?.();
                }
            }
            recomputeTouch(event.touches);
        }, { passive: false });
    }

    // Com o rato também se carrega nos botões, quando estão à vista.
    let mouseDown = false;
    canvas.addEventListener('mousedown', (event) => {
        if (!game.touchMode) return;
        mouseDown = true;
        resumeAudio();
        recomputeTouch([event]);
    });
    window.addEventListener('mouseup', () => {
        if (!mouseDown) return;
        mouseDown = false;
        recomputeTouch([]);
    });
    canvas.addEventListener('mousemove', (event) => {
        if (mouseDown) recomputeTouch([event]);
    });
}
