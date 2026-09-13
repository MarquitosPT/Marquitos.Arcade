// Condução dos adversários.
//
// Mira num ponto da linha central mais à frente (`lookahead`) e vira para lá. É
// simples de propósito: em vez de um piloto perfeito, cada CPU tem números
// próprios e um pouco de ruído na direção, o que dá erros de traçado credíveis.
//
// A borracha ("rubber band") aproxima as corridas: quem vai atrás do jogador
// ganha um pouco de velocidade e quem vai à frente perde. Está limitada a ±18%
// para não ser descarado.

import { clamp, normAngle, rand } from '/lib/arcade/math.js';
import { DRIFT_MIN_SPEED } from './config.js';
import { race, session } from './state.js';

export function updateAI(car, dt) {
    const p = car.ai;
    const targetIdx = (car.idx + p.lookahead) % race.track.N;
    const t = race.track.pts[targetIdx];
    const desired = Math.atan2(t.y - car.y, t.x - car.x);
    const diff = normAngle(desired - car.facing);
    car.steerInput = clamp(diff * p.steerGain + rand(-0.06, 0.06), -1, 1);
    car.brakeHeld = false;

    car.driftHold = Math.abs(diff) > 0.5 && car.speed > DRIFT_MIN_SPEED && Math.random() < p.driftiness * dt * 8;
    if (car.driftHold) car._driftLatch = 0.35;
    if (car._driftLatch > 0) { car.driftHold = true; car._driftLatch -= dt; }

    const leaderGap = race.player.totalDistance - car.totalDistance;
    const rubberBand = clamp(leaderGap / 900, -0.15, 0.18);
    car.speedMult = (session.difficulty + (p.speedVar || 0)) * (1 + rubberBand);

    if (car.boost >= 55 && Math.random() < p.boostChance * dt) car.boostHold = true;
    if (car.boost <= 2) car.boostHold = false;
}
