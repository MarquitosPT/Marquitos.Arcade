// Controlos: teclado, rato e dedo.
//
// - Teclado: setas ou A/D movem a raquete, espaço ou ↑ lança a bola, P ou Esc
//   pausa. Só fora das caixas de texto: as teclas que se escrevem no nome são
//   do nome (era assim que o A e o D desapareciam do campo do nome).
// - Rato: a raquete segue o ponteiro por cima do campo; o clique lança.
// - Dedo: arrastar em qualquer sítio do ecrã move a raquete pelo mesmo tanto
//   que o dedo andou — não salta para debaixo do dedo, que assim nunca a tapa
//   nem tapa a bola. Um toque curto, sem arrastar, lança.
//
// Aqui só se recolhe o que o jogador pediu; quem mexe na raquete é o
// js/level.js, a cada passo.

import { resumeAudio } from './audio.js';
import { clientToFieldX, pxToField } from './field.js';
import { game } from './state.js';

export const input = {
    left: false,
    right: false,
    /** Pedido de lançamento, gasto por quem o usar (`consumeLaunch`). */
    launch: false,
    /** Onde está o rato, em X do campo; null quando quem manda é o teclado ou o dedo. */
    pointerX: null,
    /** Quanto o dedo andou desde o último passo, em unidades do campo. */
    dragDx: 0
};

const LEFT_KEYS = ['ArrowLeft', 'a', 'A'];
const RIGHT_KEYS = ['ArrowRight', 'd', 'D'];
const LAUNCH_KEYS = [' ', 'ArrowUp', 'w', 'W'];
const PAUSE_KEYS = ['Escape', 'p', 'P'];

/** Um toque conta como "toque" (e lança) se o dedo andar menos do que isto, em px. */
const TAP_SLOP = 12;
const TAP_MS = 350;

const IN_LEVEL = ['playing', 'lost'];

let onPauseRequested = () => {};
export function setPauseHandler(handler) {
    onPauseRequested = handler;
}

export function consumeLaunch() {
    const launch = input.launch;
    input.launch = false;
    return launch;
}

/** Larga tudo — ao pausar, ao sair, ao perder o foco. Nada fica preso a andar. */
export function releaseAll() {
    input.left = input.right = input.launch = false;
    input.dragDx = 0;
}

const isTyping = (event) => event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

export function attachControls(canvas, { onTouchMode } = {}) {
    window.addEventListener('keydown', (event) => {
        if (isTyping(event)) return;
        if (PAUSE_KEYS.includes(event.key)) {
            onPauseRequested();
            return;
        }
        let used = true;
        if (LEFT_KEYS.includes(event.key)) input.left = true;
        else if (RIGHT_KEYS.includes(event.key)) input.right = true;
        else if (LAUNCH_KEYS.includes(event.key)) {
            if (!event.repeat) input.launch = true;
        } else used = false;
        if (!used) return;
        // O teclado manda até o rato se voltar a mexer.
        input.pointerX = null;
        // As setas e o espaço fazem scroll ou carregam no botão com foco; a
        // jogar, só atrapalham. No menu ficam com o browser.
        if (IN_LEVEL.includes(game.phase)) event.preventDefault();
    });

    window.addEventListener('keyup', (event) => {
        if (LEFT_KEYS.includes(event.key)) input.left = false;
        if (RIGHT_KEYS.includes(event.key)) input.right = false;
    });

    window.addEventListener('blur', releaseAll);

    // ---------- Rato ----------

    canvas.addEventListener('mousemove', (event) => {
        if (game.touchMode || !game.layout) return;
        input.pointerX = clientToFieldX(event.clientX);
    });
    canvas.addEventListener('mousedown', (event) => {
        if (game.touchMode || event.button !== 0) return;
        resumeAudio();
        input.launch = true;
    });

    // ---------- Dedo ----------

    let lastX = 0;
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let fingerId = null;

    const find = (list) => [...list].find((t) => t.identifier === fingerId);

    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        resumeAudio();
        if (!game.touchMode) {
            game.touchMode = true;
            input.pointerX = null;
            onTouchMode?.();
        }
        // Só conta um dedo: um segundo dedo no ecrã não rouba a raquete ao primeiro.
        if (fingerId !== null && find(event.touches)) return;
        const touch = event.changedTouches[0];
        fingerId = touch.identifier;
        lastX = startX = touch.clientX;
        startY = touch.clientY;
        startAt = performance.now();
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();
        const touch = find(event.changedTouches);
        if (!touch || !game.layout) return;
        input.dragDx += pxToField(touch.clientX - lastX);
        lastX = touch.clientX;
    }, { passive: false });

    const end = (event) => {
        const touch = find(event.changedTouches);
        if (!touch) return;
        fingerId = null;
        const moved = Math.hypot(touch.clientX - startX, touch.clientY - startY);
        if (moved < TAP_SLOP && performance.now() - startAt < TAP_MS) input.launch = true;
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', (event) => {
        if (find(event.changedTouches)) fingerId = null;
    });
}
