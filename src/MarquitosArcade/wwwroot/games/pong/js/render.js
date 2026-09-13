// Desenho do campo. Tudo em coordenadas lógicas — o viewport do SDK já pôs a
// transformação do devicePixelRatio no contexto.

import { isSinglePlayer, state } from './state.js';

const BACKGROUND = '#000';
const FOREGROUND = '#fff';
const CENTER_LINE = 'rgba(255,255,255,0.35)';
const SCORE_COLOR = 'rgba(255,255,255,0.85)';

export function draw() {
    const { ctx, width: W, height: H } = state.view;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, W, H);

    drawCenterLine(ctx, W, H);
    drawPaddles(ctx);
    drawBall(ctx);
    drawScores(ctx, W, H);
}

function drawCenterLine(ctx, W, H) {
    ctx.strokeStyle = CENTER_LINE;
    ctx.lineWidth = 2;
    ctx.setLineDash([H * 0.02, H * 0.02]);
    ctx.beginPath();
    if (isSinglePlayer()) {
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
    } else {
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawPaddles(ctx) {
    const { player, ai, p1, p2, paddleW, paddleH, paddleLen, paddleThick } = state;
    ctx.fillStyle = FOREGROUND;
    if (isSinglePlayer()) {
        ctx.fillRect(player.x, player.y, paddleW, paddleH);
        ctx.fillRect(ai.x, ai.y, paddleW, paddleH);
    } else {
        ctx.fillRect(p1.x, p1.y, paddleThick, paddleLen);
        ctx.fillRect(p2.x, p2.y, paddleThick, paddleLen);
    }
}

function drawBall(ctx) {
    const { ball, ballR } = state;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballR, 0, Math.PI * 2);
    ctx.fill();
}

function drawScores(ctx, W, H) {
    ctx.font = `bold ${Math.floor(Math.min(H, W) * 0.08)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = SCORE_COLOR;
    if (isSinglePlayer()) {
        // Cada pontuação do seu lado da linha, junto à raquete a que pertence.
        ctx.fillText(state.scoreA, W / 2, H * 0.42);
        ctx.fillText(state.scoreP, W / 2, H * 0.58);
    } else {
        ctx.fillText(state.scoreP, W * 0.25, H * 0.14);
        ctx.fillText(state.scoreA, W * 0.75, H * 0.14);
    }
}
