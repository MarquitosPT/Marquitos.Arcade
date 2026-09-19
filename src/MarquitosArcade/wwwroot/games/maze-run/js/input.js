// Controlos: setas (ou WASD) no computador, arrasto no telemóvel.
//
// Num labirinto só há quatro direções, por isso não há botões desenhados no
// ecrã como no Pixel Racing: arrasta-se o dedo na direção para onde se quer ir.
// O arrasto é contínuo — cada troço a partir de um limiar vale uma direção
// nova, e a origem vai andando com o dedo. Assim faz-se uma curva atrás da
// outra sem levantar o dedo, que é o que faz falta numa fuga.

import { resumeAudio } from './audio.js';
import { DIRS } from './walker.js';

/** Píxeis de arrasto que valem uma mudança de direção. */
const SWIPE_THRESHOLD = 22;

const KEY_DIRS = {
    ArrowUp: DIRS.up, w: DIRS.up, W: DIRS.up,
    ArrowRight: DIRS.right, d: DIRS.right, D: DIRS.right,
    ArrowDown: DIRS.down, s: DIRS.down, S: DIRS.down,
    ArrowLeft: DIRS.left, a: DIRS.left, A: DIRS.left
};

const PAUSE_KEYS = ['Escape', 'p', 'P'];

let onSteer = () => {};
let onPauseRequested = () => {};

/** Registados pelo main.js. */
export function setInputHandlers({ steer, pause }) {
    if (steer) onSteer = steer;
    if (pause) onPauseRequested = pause;
}

export function attachControls(canvas) {
    window.addEventListener('keydown', (event) => {
        if (PAUSE_KEYS.includes(event.key)) {
            onPauseRequested();
            return;
        }

        const dir = KEY_DIRS[event.key];
        if (!dir) return;
        // As setas fazem scroll à página; num jogo em ecrã inteiro isso só
        // atrapalha (e, num ecrã com o painel a rolar, saltava para o fundo).
        event.preventDefault();
        resumeAudio();
        onSteer(dir);
    });

    let origin = null;

    const start = (x, y) => {
        origin = { x, y };
        resumeAudio();
    };

    /**
     * Cada troço a partir do limiar vale uma direção; a origem passa a ser o
     * ponto atual, para o arrasto seguinte contar do zero. Só conta o eixo
     * dominante — em diagonal, ninguém sabe qual das duas queria.
     */
    const move = (x, y) => {
        if (!origin) return;
        const dx = x - origin.x;
        const dy = y - origin.y;
        if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

        onSteer(Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? DIRS.right : DIRS.left)
            : (dy > 0 ? DIRS.down : DIRS.up));
        origin = { x, y };
    };

    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        if (touch) start(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        if (touch) move(touch.clientX, touch.clientY);
    }, { passive: false });

    for (const type of ['touchend', 'touchcancel']) {
        canvas.addEventListener(type, (event) => {
            event.preventDefault();
            origin = null;
        }, { passive: false });
    }

    // O mesmo gesto com o rato, para se poder jogar sem teclado no computador.
    canvas.addEventListener('mousedown', (event) => start(event.clientX, event.clientY));
    canvas.addEventListener('mousemove', (event) => {
        if (origin) move(event.clientX, event.clientY);
    });
    // No window e não no canvas: largar o rato fora do canvas deixava o arrasto preso.
    window.addEventListener('mouseup', () => { origin = null; });
}
