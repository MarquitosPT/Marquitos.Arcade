// Controlos do tabuleiro: arrastar para andar, beliscar ou rodar a roda para
// aproximar, tocar para escolher uma casa.
//
// Um toque só conta como toque se o dedo quase não se mexeu — senão é um
// arrasto, e largar o dedo no fim de um arrasto não pode construir nada por
// engano. Com dois dedos é sempre zoom.

import { camera, panBy, pickTile, zoomAt } from './iso.js';
import { game, ui } from './state.js';
import { idx } from './world.js';

/** Quanto o dedo se pode mexer (px) e ainda contar como toque. */
const TAP_SLOP = 8;
const KEY_PAN = 14;

let handlers = { tap() {}, cancel() {} };

export function setInputHandlers(next) {
    handlers = { ...handlers, ...next };
}

const elevAt = (x, y) => Math.max(0, game.world.elev[idx(x, y)]);

export function attachControls(canvas) {
    const pointers = new Map();
    let dragged = false;
    let startX = 0;
    let startY = 0;
    let pinchDistance = 0;

    const pos = (event) => {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    canvas.addEventListener('pointerdown', (event) => {
        if (game.phase !== 'playing') return;
        canvas.setPointerCapture?.(event.pointerId);
        const p = pos(event);
        pointers.set(event.pointerId, p);
        if (pointers.size === 1) {
            dragged = false;
            startX = p.x;
            startY = p.y;
        } else if (pointers.size === 2) {
            dragged = true;
            const [a, b] = [...pointers.values()];
            pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        }
    });

    canvas.addEventListener('pointermove', (event) => {
        if (game.phase !== 'playing') return;
        const p = pos(event);

        // Rato por cima do tabuleiro em modo de construção: mostra onde fica.
        if (!pointers.size && event.pointerType === 'mouse' && ui.placing) {
            ui.hover = pickTile(p.x, p.y, elevAt);
            return;
        }

        const prev = pointers.get(event.pointerId);
        if (!prev) return;
        pointers.set(event.pointerId, p);

        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchDistance > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / pinchDistance);
            pinchDistance = distance;
            // Os dois dedos arrastam também, pelo ponto do meio.
            panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2);
            return;
        }

        if (!dragged && Math.hypot(p.x - startX, p.y - startY) > TAP_SLOP) dragged = true;
        if (dragged) panBy(p.x - prev.x, p.y - prev.y);
    });

    const release = (event) => {
        if (!pointers.has(event.pointerId)) return;
        const p = pos(event);
        pointers.delete(event.pointerId);
        if (pointers.size === 0 && !dragged && event.type === 'pointerup') {
            const tile = pickTile(p.x, p.y, elevAt);
            if (tile) handlers.tap(tile);
        }
        if (pointers.size < 2) pinchDistance = 0;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('wheel', (event) => {
        if (game.phase !== 'playing') return;
        event.preventDefault();
        const p = pos(event);
        // Trackpads mandam deltas pequenos e muitos; a roda, poucos e grandes.
        const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018));
        zoomAt(p.x, p.y, factor);
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
        if (game.phase !== 'playing' || event.target.closest?.('input')) return;
        switch (event.key) {
            case 'ArrowLeft': case 'a': case 'A': panBy(KEY_PAN * 3, 0); break;
            case 'ArrowRight': case 'd': case 'D': panBy(-KEY_PAN * 3, 0); break;
            case 'ArrowUp': case 'w': case 'W': panBy(0, KEY_PAN * 3); break;
            case 'ArrowDown': case 's': case 'S': panBy(0, -KEY_PAN * 3); break;
            case '+': case '=': zoomAt(camera.width / 2, camera.height / 2, 1.15); break;
            case '-': case '_': zoomAt(camera.width / 2, camera.height / 2, 1 / 1.15); break;
            case 'Escape': handlers.cancel(); break;
            default: return;
        }
        event.preventDefault();
    });
}
