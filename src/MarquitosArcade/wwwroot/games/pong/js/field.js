// Geometria do campo: onde ficam as raquetes e como a bola volta ao centro.
//
// Corre a cada redimensionamento e a cada troca de modo, porque o campo do modo a
// um jogador (raquetes horizontais) e o de dois (raquetes verticais) não têm nada
// a ver um com o outro.

import { TUNING } from './config.js';
import { isSinglePlayer, state } from './state.js';

export function layout() {
    const { width: W, height: H, topInset } = state.view;

    if (isSinglePlayer()) {
        const t = TUNING.single;
        state.paddleW = W * t.paddleWidth;
        state.paddleH = Math.max(10, H * t.paddleHeight);
        state.ballR = Math.max(6, W * t.ballRadius);

        state.player.x = W / 2 - state.paddleW / 2;
        state.player.y = H - H * t.paddleMargin - state.paddleH;

        state.ai.x = W / 2 - state.paddleW / 2;
        // Nunca por baixo da barra de topo, senão a raquete fica atrás dos botões.
        state.ai.y = Math.max(H * t.paddleMargin, topInset);
    } else {
        const t = TUNING.two;
        state.paddleLen = H * t.paddleLength;
        state.paddleThick = Math.max(10, W * t.paddleThickness);
        state.ballR = Math.max(6, H * t.ballRadius);

        state.p1.x = W * t.paddleMargin;
        state.p1.y = Math.max(H / 2 - state.paddleLen / 2, topInset);

        state.p2.x = W - W * t.paddleMargin - state.paddleThick;
        state.p2.y = Math.max(H / 2 - state.paddleLen / 2, topInset);
    }

    resetBall();
}

/**
 * Recoloca a bola no centro com direção aleatória, mas sempre num cone estreito
 * (±0.3 rad) para o lado de quem joga — uma saída quase paralela à raquete daria
 * uma troca interminável.
 */
export function resetBall() {
    const { width: W, height: H } = state.view;
    const { ball } = state;

    ball.x = W / 2;
    ball.y = H / 2;

    const angle = Math.random() * 0.6 - 0.3;
    const towards = Math.random() < 0.5 ? 1 : -1;

    if (isSinglePlayer()) {
        const speed = Math.max(TUNING.minBallSpeed, W * TUNING.single.ballSpeed);
        ball.vx = speed * Math.sin(angle);
        ball.vy = speed * Math.cos(angle) * towards;
    } else {
        const speed = Math.max(TUNING.minBallSpeed, H * TUNING.two.ballSpeed);
        ball.vy = speed * Math.sin(angle);
        ball.vx = speed * Math.cos(angle) * towards;
    }
}
