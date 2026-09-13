// Controlos: arrastar no ecrã (toque) e rato para testar no computador.
//
// A dois jogadores o ecrã divide-se ao meio: cada metade comanda a sua raquete, e
// os toques são processados em conjunto para os dois poderem jogar ao mesmo tempo.

import { isSinglePlayer, state } from './state.js';

export function attachControls(canvas) {
    const positionIn = (point) => {
        const rect = canvas.getBoundingClientRect();
        return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    };

    function movePaddles(points) {
        const { width: W, height: H, topInset } = state.view;

        if (isSinglePlayer()) {
            if (!points.length) return;
            const { x } = points[0];
            state.player.x = Math.min(W - state.paddleW, Math.max(0, x - state.paddleW / 2));
            return;
        }

        for (const { x, y } of points) {
            const side = x < W / 2 ? state.p1 : state.p2;
            side.y = Math.min(H - state.paddleLen, Math.max(topInset, y - state.paddleLen / 2));
        }
    }

    function onTouch(event) {
        if (!event.touches || !event.touches.length) return;
        // preventDefault trava o scroll-bounce do iOS durante o jogo.
        event.preventDefault();
        movePaddles(Array.from(event.touches, positionIn));
    }

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });

    let dragging = false;
    canvas.addEventListener('mousedown', (e) => {
        dragging = true;
        movePaddles([positionIn(e)]);
    });
    canvas.addEventListener('mouseup', () => {
        dragging = false;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (dragging) movePaddles([positionIn(e)]);
    });
}
