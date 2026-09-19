// Geometria do campo: onde ficam as raquetes e como a bola volta ao centro.
//
// Corre a cada redimensionamento e a cada troca de modo, porque o campo ao alto
// (raquetes horizontais) e o campo ao comprido (raquetes verticais) não têm nada
// a ver um com o outro. Quem escolhe entre eles é a orientação do ecrã — ver
// `isSideField` em state.js.

import { TUNING } from './config.js';
import { isSideField, state } from './state.js';

export function layout() {
    const { width: W, height: H, topInset, safeArea } = state.view;
    const gap = TUNING.safeGap;

    if (isSideField()) {
        const t = TUNING.sideField;
        state.paddleLen = H * t.paddleLength;
        state.paddleThick = Math.max(10, W * t.paddleThickness);
        state.ballR = Math.max(6, H * t.ballRadius);

        // Ao comprido o notch passa para um dos lados, e é ali que a raquete
        // ficava escondida por baixo dele. A margem normal chega em quase todo o
        // lado; onde não chega, manda a área de sistema mais a folga.
        state.p1.x = Math.max(W * t.paddleMargin, safeArea.left + gap);
        state.p2.x = W - Math.max(W * t.paddleMargin, safeArea.right + gap) - state.paddleThick;

        state.p1.y = Math.max(H / 2 - state.paddleLen / 2, topInset);
        state.p2.y = Math.max(H / 2 - state.paddleLen / 2, topInset);
    } else {
        const t = TUNING.endField;
        state.paddleW = W * t.paddleWidth;
        state.paddleH = Math.max(10, H * t.paddleHeight);
        state.ballR = Math.max(6, W * t.ballRadius);

        state.player.x = W / 2 - state.paddleW / 2;
        // A folga é sempre somada, e não só onde há barra de gestos: com a
        // raquete colada ao fundo, o dedo que a arrasta acabava em cima da barra
        // do iOS e o gesto ia para o sistema em vez de ir para o jogo.
        state.player.y = H - Math.max(H * t.paddleMargin, safeArea.bottom) - gap - state.paddleH;

        state.ai.x = W / 2 - state.paddleW / 2;
        // Nunca por baixo da barra de topo, senão a raquete fica atrás dos botões.
        state.ai.y = Math.max(H * t.paddleMargin, topInset);
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

    if (isSideField()) {
        const speed = Math.max(TUNING.minBallSpeed, H * TUNING.sideField.ballSpeed);
        ball.vy = speed * Math.sin(angle);
        ball.vx = speed * Math.cos(angle) * towards;
    } else {
        const speed = Math.max(TUNING.minBallSpeed, W * TUNING.endField.ballSpeed);
        ball.vx = speed * Math.sin(angle);
        ball.vy = speed * Math.cos(angle) * towards;
    }
}
