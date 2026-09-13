// Física da bola, colisões e adversário controlado pelo computador.
//
// `dt` vem normalizado em frames a 60fps (1.0 = um frame), por isso as velocidades
// são px/frame e não px/segundo — é a convenção que o jogo sempre usou.

import { TUNING } from './config.js';
import { resetBall } from './field.js';
import { sfx } from './audio.js';
import { isSinglePlayer, state } from './state.js';

export function update(dt) {
    const { ball } = state;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (isSinglePlayer()) updateSingle(dt);
    else updateTwoPlayer();
}

function updateSingle(dt) {
    // No modo a um jogador a bola tem de poder sair por cima para marcar ponto,
    // por isso aqui não há `topInset` a servir de teto — a raquete da IA é que já
    // foi colocada abaixo da barra em `layout()`.
    const { width: W, height: H } = state.view;
    const { ball, player, ai, paddleW, paddleH, ballR } = state;
    const tol = TUNING.hitTolerance;

    // Paredes laterais.
    if (ball.x - ballR < 0) {
        ball.x = ballR;
        ball.vx *= -1;
        sfx.wall();
    }
    if (ball.x + ballR > W) {
        ball.x = W - ballR;
        ball.vx *= -1;
        sfx.wall();
    }

    // Adversário: persegue a bola em x, limitado pela dificuldade escolhida.
    const aiCenter = ai.x + paddleW / 2;
    const aiSpeed = W * TUNING.single.aiSpeed * state.aiLevel;
    const deadZone = TUNING.single.aiDeadZone;
    if (aiCenter < ball.x - deadZone) ai.x += Math.min(aiSpeed * dt, ball.x - aiCenter);
    else if (aiCenter > ball.x + deadZone) ai.x -= Math.min(aiSpeed * dt, aiCenter - ball.x);
    ai.x = Math.min(W - paddleW, Math.max(0, ai.x));

    // Raquete do jogador (em baixo), só quando a bola vem a descer.
    if (ball.vy > 0
        && ball.y + ballR >= player.y && ball.y + ballR <= player.y + paddleH + tol
        && ball.x >= player.x - ballR && ball.x <= player.x + paddleW + ballR) {
        ball.y = player.y - ballR;
        bounceOffHorizontalPaddle(player.x, paddleW, -1);
    }

    // Raquete do adversário (em cima), só quando a bola vem a subir.
    if (ball.vy < 0
        && ball.y - ballR <= ai.y + paddleH && ball.y - ballR >= ai.y - tol
        && ball.x >= ai.x - ballR && ball.x <= ai.x + paddleW + ballR) {
        ball.y = ai.y + paddleH + ballR;
        bounceOffHorizontalPaddle(ai.x, paddleW, 1);
    }

    if (ball.y - ballR > H) score('ai');
    else if (ball.y + ballR < 0) score('player');
}

function updateTwoPlayer() {
    const { width: W, height: H, topInset } = state.view;
    const { ball, p1, p2, paddleLen, paddleThick, ballR } = state;
    const tol = TUNING.hitTolerance;

    // Teto (abaixo da barra de topo) e chão.
    if (ball.y - ballR < topInset) {
        ball.y = topInset + ballR;
        ball.vy *= -1;
        sfx.wall();
    }
    if (ball.y + ballR > H) {
        ball.y = H - ballR;
        ball.vy *= -1;
        sfx.wall();
    }

    // Raquete da esquerda.
    if (ball.vx < 0
        && ball.x - ballR <= p1.x + paddleThick && ball.x - ballR >= p1.x - tol
        && ball.y >= p1.y - ballR && ball.y <= p1.y + paddleLen + ballR) {
        ball.x = p1.x + paddleThick + ballR;
        bounceOffVerticalPaddle(p1.y, paddleLen, 1);
    }

    // Raquete da direita.
    if (ball.vx > 0
        && ball.x + ballR >= p2.x && ball.x + ballR <= p2.x + tol
        && ball.y >= p2.y - ballR && ball.y <= p2.y + paddleLen + ballR) {
        ball.x = p2.x - ballR;
        bounceOffVerticalPaddle(p2.y, paddleLen, -1);
    }

    if (ball.x - ballR > W) score('player'); // saiu pela direita: ponto do da esquerda
    else if (ball.x + ballR < 0) score('ai'); // saiu pela esquerda: ponto do da direita
}

/**
 * Ressalto numa raquete horizontal. O ponto de impacto decide o ângulo de saída
 * (centro = reto, ponta = bem aberto), que é o que dá controlo ao jogador.
 * @param {number} originX Bordo esquerdo da raquete.
 * @param {number} length Largura da raquete.
 * @param {1|-1} directionY Sentido vertical de saída da bola.
 */
function bounceOffHorizontalPaddle(originX, length, directionY) {
    const { ball } = state;
    const hitPos = (ball.x - (originX + length / 2)) / (length / 2);
    const speed = Math.hypot(ball.vx, ball.vy) * TUNING.ballSpeedup;
    ball.vx = speed * Math.sin(hitPos);
    ball.vy = directionY * Math.abs(speed * Math.cos(hitPos));
    sfx.paddle();
}

/** Ressalto numa raquete vertical. Ver `bounceOffHorizontalPaddle`. */
function bounceOffVerticalPaddle(originY, length, directionX) {
    const { ball } = state;
    const hitPos = (ball.y - (originY + length / 2)) / (length / 2);
    const speed = Math.hypot(ball.vx, ball.vy) * TUNING.ballSpeedup;
    ball.vy = speed * Math.sin(hitPos);
    ball.vx = directionX * Math.abs(speed * Math.cos(hitPos));
    sfx.paddle();
}

function score(who) {
    if (who === 'player') state.scoreP++;
    else state.scoreA++;
    sfx.score();
    resetBall();
}
