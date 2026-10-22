// A física da bola: andar, bater nas paredes, na raquete e nos tijolos.
//
// A bola guarda a direção (um vetor de tamanho 1) e a velocidade à parte. Anda
// aos bocadinhos de BALL_SUBSTEP unidades — menos do que o raio —, e em cada
// bocadinho resolve no máximo um choque com um tijolo: com isto não há bola
// que atravesse um tijolo num frame mais lento nem que parta dois de uma vez
// por um canto.
//
// O choque com um tijolo é o de um círculo com um retângulo: o ponto do
// tijolo mais perto do centro da bola diz de que lado se bateu. Numa face, a
// bola espelha nesse eixo; num canto, espelha na direção do canto — é o que dá
// os ressaltos de esguelha que fazem um nível destes interessante.
//
// Na raquete, o ressalto não depende de como a bola chegou: depende só de
// onde bateu. No meio sobe a direito, nas pontas sai inclinada até
// PADDLE_MAX_ANGLE. É isto que dá ao jogador pontaria.
//
// Este módulo não sabe de pontos, sons nem cápsulas: devolve o que aconteceu
// (`events`) e quem decide o resto é o js/level.js.

import {
    BALL_MIN_VY, BALL_R, BALL_SUBSTEP, FIELD_H, FIELD_W, PADDLE_H, PADDLE_MAX_ANGLE, PADDLE_Y
} from './config.js';

/** Uma bola nova, presa à raquete. */
export function createBall(speed) {
    return { x: 0, y: 0, dx: 0, dy: -1, speed, stuck: true, stuckOffset: 0, holdTimer: 0, trail: [] };
}

export function setDirection(ball, dx, dy) {
    const length = Math.hypot(dx, dy) || 1;
    ball.dx = dx / length;
    ball.dy = dy / length;
    keepOffHorizontal(ball);
}

/** Direção ao sair da raquete, conforme o sítio onde bateu (-1 ponta esquerda, 1 ponta direita). */
export function paddleDirection(offset) {
    const angle = Math.max(-1, Math.min(1, offset)) * PADDLE_MAX_ANGLE;
    return { dx: Math.sin(angle), dy: -Math.cos(angle) };
}

/** Uma bola quase horizontal fica a ir de parede em parede sem nunca descer. */
function keepOffHorizontal(ball) {
    if (Math.abs(ball.dy) >= BALL_MIN_VY) return;
    const sy = ball.dy < 0 ? -1 : 1;
    const sx = ball.dx < 0 ? -1 : 1;
    ball.dy = sy * BALL_MIN_VY;
    ball.dx = sx * Math.sqrt(1 - BALL_MIN_VY * BALL_MIN_VY);
}

function reflect(ball, nx, ny) {
    const dot = ball.dx * nx + ball.dy * ny;
    if (dot >= 0) return;
    ball.dx -= 2 * dot * nx;
    ball.dy -= 2 * dot * ny;
    keepOffHorizontal(ball);
}

/**
 * O tijolo onde a bola está a entrar mais fundo, e a normal do choque.
 * @returns {{ brick: object, nx: number, ny: number, depth: number }|null}
 */
function deepestBrick(ball, bricks) {
    let best = null;
    for (const brick of bricks) {
        if (!brick.alive) continue;
        if (ball.x + BALL_R < brick.x || ball.x - BALL_R > brick.x + brick.w) continue;
        if (ball.y + BALL_R < brick.y || ball.y - BALL_R > brick.y + brick.h) continue;
        const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        let nx = ball.x - cx;
        let ny = ball.y - cy;
        const distance = Math.hypot(nx, ny);
        if (distance > BALL_R) continue;
        if (distance > 0.0001) {
            nx /= distance;
            ny /= distance;
        } else {
            // O centro já está dentro do tijolo: sai pela face mais próxima.
            const faces = [
                [ball.x - brick.x, -1, 0],
                [brick.x + brick.w - ball.x, 1, 0],
                [ball.y - brick.y, 0, -1],
                [brick.y + brick.h - ball.y, 0, 1]
            ].sort((a, b) => a[0] - b[0]);
            [, nx, ny] = faces[0];
        }
        const depth = BALL_R - distance;
        if (!best || depth > best.depth) best = { brick, nx, ny, depth, cx, cy };
    }
    return best;
}

/**
 * Faz andar uma bola `distance` unidades.
 * @param {object} ball
 * @param {number} distance
 * @param {{ bricks: object[], paddle: { x: number, w: number } }} world
 * @returns {Array<{ type: 'wall'|'ceiling'|'paddle'|'brick'|'lost', brick?: object, offset?: number }>}
 */
export function moveBall(ball, distance, { bricks, paddle }) {
    const events = [];
    const steps = Math.max(1, Math.ceil(distance / BALL_SUBSTEP));
    const step = distance / steps;

    for (let i = 0; i < steps; i++) {
        const prevY = ball.y;
        ball.x += ball.dx * step;
        ball.y += ball.dy * step;

        // Paredes e teto.
        if (ball.x - BALL_R < 0) {
            ball.x = BALL_R;
            reflect(ball, 1, 0);
            events.push({ type: 'wall' });
        } else if (ball.x + BALL_R > FIELD_W) {
            ball.x = FIELD_W - BALL_R;
            reflect(ball, -1, 0);
            events.push({ type: 'wall' });
        }
        if (ball.y - BALL_R < 0) {
            ball.y = BALL_R;
            reflect(ball, 0, 1);
            events.push({ type: 'ceiling' });
        }

        // Raquete: só conta de cima para baixo, e com o centro da bola ainda
        // acima do meio da raquete — uma bola que já passou não volta para trás.
        if (ball.dy > 0
            && ball.y + BALL_R >= PADDLE_Y
            && prevY < PADDLE_Y + PADDLE_H / 2
            && ball.x >= paddle.x - BALL_R * 0.6
            && ball.x <= paddle.x + paddle.w + BALL_R * 0.6) {
            const offset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            const dir = paddleDirection(offset);
            ball.dx = dir.dx;
            ball.dy = dir.dy;
            ball.y = PADDLE_Y - BALL_R;
            events.push({ type: 'paddle', offset });
            // Na raquete pode ficar colada (cápsula C): quem decide é o level.js,
            // que precisa de saber disto antes do resto do caminho.
            if (paddle.mode === 'catch') return events;
        }

        // Tijolos: um por bocadinho.
        const hit = deepestBrick(ball, bricks);
        if (hit) {
            ball.x = hit.cx + hit.nx * (BALL_R + 0.01);
            ball.y = hit.cy + hit.ny * (BALL_R + 0.01);
            reflect(ball, hit.nx, hit.ny);
            events.push({ type: 'brick', brick: hit.brick });
        }

        if (ball.y - BALL_R > FIELD_H) {
            events.push({ type: 'lost' });
            return events;
        }
    }
    return events;
}

/** Um disparo do laser: sobe a direito e parte o primeiro tijolo que encontrar. */
export function moveBolt(bolt, distance, bricks) {
    bolt.y -= distance;
    for (const brick of bricks) {
        if (!brick.alive) continue;
        if (bolt.x < brick.x || bolt.x > brick.x + brick.w) continue;
        if (bolt.y > brick.y + brick.h || bolt.y + distance < brick.y) continue;
        return brick;
    }
    return null;
}
