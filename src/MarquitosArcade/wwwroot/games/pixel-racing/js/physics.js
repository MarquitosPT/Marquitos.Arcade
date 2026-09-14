// Física dos carros, progresso na pista e colisões.
//
// O carro tem dois ângulos: `facing`, para onde aponta, e `velAngle`, para onde
// anda mesmo. Em condução normal o segundo persegue o primeiro depressa (muita
// aderência); em drift persegue devagar, e é essa diferença que dá a derrapagem.

import { clamp, lerpAngle } from '/lib/arcade/math.js';
import {
    ACCEL, BOOST_DRAIN, BOOST_MULT, BOOST_REGEN, BRAKE_DECEL, BUMP_DAMP, CAR_RADIUS,
    DRIFT_CHARGE_RATE, DRIFT_MIN_SPEED, DRIFT_PERFECT, DRIFT_TO_BOOST, DRIFT_TURN_MULT,
    GRIP_DRIFT, GRIP_NORMAL, GRIP_OIL, MAX_SPEED, OFFTRACK_DAMP, OIL_RADIUS, OIL_SPIN,
    OIL_TIME, TURN_RATE, WALL_STEER_BLEND
} from './config.js';
import { findNearestIdx } from './tracks.js';
import { sfx } from './audio.js';
import {
    spawnBoostFlame, spawnDriftPerfectBurst, spawnDriftSpark, spawnImpactSpark,
    spawnOilSpray, spawnPadBurst, spawnSmoke, spawnWallDust
} from './particles.js';
import { bumpShake, race } from './state.js';

export function integrateCar(car, dt, isPlayer) {
    const wantsDrift = car.driftHold && Math.abs(car.steerInput) > 0.15 && car.speed > DRIFT_MIN_SPEED;
    const onOil = car.oilTimer > 0;
    const grip = onOil ? GRIP_OIL : (wantsDrift ? GRIP_DRIFT : GRIP_NORMAL);
    const turnMult = wantsDrift ? DRIFT_TURN_MULT : 1;
    const speedFrac = clamp(car.speed / MAX_SPEED, 0, 1.6);
    car.facing += car.steerInput * TURN_RATE * turnMult * (0.6 + 0.4 * Math.min(1, speedFrac)) * dt;

    // Em cima do óleo o carro roda para o lado que lhe saiu à entrada, com força
    // a esvair-se até ao fim do tempo — o susto é no primeiro instante, e depois
    // vai-se endireitando sozinho.
    if (onOil) {
        car.facing += car.oilSpin * OIL_SPIN * (car.oilTimer / OIL_TIME) * dt;
        car.oilTimer -= dt;
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) { spawnOilSpray(car); car.smokeTimer = 0.05; }
    }

    const boosting = car.boostHold && car.boost > 0;
    const maxSpeedNow = MAX_SPEED * (car.speedMult || 1) * (boosting ? BOOST_MULT : 1);
    if (car.brakeHeld) car.speed -= BRAKE_DECEL * dt;
    else car.speed += ACCEL * dt;
    car.speed = clamp(car.speed, -MAX_SPEED * 0.35, maxSpeedNow);

    car.velAngle = lerpAngle(car.velAngle, car.facing, 1 - Math.exp(-grip * dt));
    car.x += Math.cos(car.velAngle) * car.speed * dt;
    car.y += Math.sin(car.velAngle) * car.speed * dt;

    if (wantsDrift) {
        car.driftCharge = Math.min(100, car.driftCharge + DRIFT_CHARGE_RATE * dt);
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) { spawnDriftSpark(car, car.steerInput >= 0 ? 1 : -1); car.smokeTimer = 0.04; }
        car.wasDrifting = true;
    } else {
        if (car.wasDrifting && car.driftCharge > 15) {
            car.boost = Math.min(100, car.boost + car.driftCharge * DRIFT_TO_BOOST);
            if (car.driftCharge >= DRIFT_PERFECT) { spawnDriftPerfectBurst(car); if (isPlayer) sfx.driftPerfect(); }
        }
        car.driftCharge = 0;
        car.wasDrifting = false;
    }

    if (boosting) {
        car.boost = Math.max(0, car.boost - BOOST_DRAIN * dt);
        spawnBoostFlame(car);
        if (car.boost <= 0) car.boostHold = false;
    } else {
        car.boost = Math.min(100, car.boost + BOOST_REGEN * dt);
    }

    if (Math.abs(car.speed) > 40 && !wantsDrift) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0 && Math.random() < 0.5) { spawnSmoke(car); car.smokeTimer = 0.09; }
    }
}

export function computeProgress(car) {
    const best = findNearestIdx(race.track, car.x, car.y, car.idx);
    let idxDelta = best - car.idx;
    if (idxDelta > race.track.N / 2) idxDelta -= race.track.N;
    else if (idxDelta < -race.track.N / 2) idxDelta += race.track.N;
    car.idx = best;
    car.totalDistance = Math.max(0, car.totalDistance + idxDelta * (race.track.total / race.track.N));
    car.lap = Math.floor(car.totalDistance / race.track.total);

    for (const padIdx of race.track.pads) {
        let d = Math.abs(best - padIdx); if (d > race.track.N / 2) d = race.track.N - d;
        if (d <= 2 && car.lastPadIdx !== padIdx) {
            car.boost = 100; car.lastPadIdx = padIdx;
            spawnPadBurst(car);
            if (car === race.player) sfx.pad();
        }
    }
    for (const oil of race.track.oils) {
        if (Math.hypot(car.x - oil.x, car.y - oil.y) > OIL_RADIUS) continue;
        // O lado só se sorteia à entrada: enquanto o carro está em cima da poça o
        // tempo renova-se, senão o carro trocava de lado a cada frame.
        if (car.oilTimer <= 0) {
            car.oilSpin = Math.random() < 0.5 ? -1 : 1;
            if (car === race.player) { bumpShake(3); sfx.oil(); }
        }
        car.oilTimer = OIL_TIME;
    }

    if (car.lastPadIdx !== -1) {
        let dLast = Math.abs(best - car.lastPadIdx); if (dLast > race.track.N / 2) dLast = race.track.N - dLast;
        if (dLast > 8) car.lastPadIdx = -1;
    }
}

export function wallCollision(car) {
    const p = race.track.pts[car.idx], n = race.track.norm[car.idx], tg = race.track.tang[car.idx];
    const offset = (car.x - p.x) * n.x + (car.y - p.y) * n.y;
    const limit = race.track.halfWidth - CAR_RADIUS * 0.7;
    if (Math.abs(offset) > limit) {
        const sign = offset > 0 ? 1 : -1;
        car.x -= (offset - sign * limit) * n.x;
        car.y -= (offset - sign * limit) * n.y;

        // Reencaminha o carro ao longo da parede em vez de lhe matar a velocidade:
        // um carro que bata de frente ficaria quase parado e, como a capacidade de
        // virar depende da velocidade, ficava preso a rodopiar contra a parede.
        const vx = Math.cos(car.velAngle) * car.speed, vy = Math.sin(car.velAngle) * car.speed;
        const alongT = vx * tg.x + vy * tg.y;
        const dir = alongT >= 0 ? 1 : -1;
        const newAlongT = dir * clamp(Math.abs(alongT) * OFFTRACK_DAMP, 70, MAX_SPEED);
        const wallAngle = Math.atan2(tg.y * dir, tg.x * dir);
        // Para onde anda passa a ser ao longo da parede (senão voltava a entrar
        // nela no frame seguinte), mas para onde aponta só lá vai a meio caminho:
        // o carro raspa e segue, em vez de sair do embate a olhar para outro sítio.
        car.velAngle = wallAngle;
        car.facing = lerpAngle(car.facing, wallAngle, WALL_STEER_BLEND);
        car.speed = Math.abs(newAlongT);

        spawnWallDust(car);
        if (car === race.player) { bumpShake(3); sfx.wall(); }
    }
}

export function carCollisions() {
    const { cars } = race;
    for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
            const a = cars[i], b = cars[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 0.01;
            const minDist = CAR_RADIUS * 1.8;
            if (dist < minDist) {
                const nx = dx / dist, ny = dy / dist;
                const overlap = (minDist - dist) / 2;
                a.x -= nx * overlap; a.y -= ny * overlap;
                b.x += nx * overlap; b.y += ny * overlap;
                const rel = (b.speed - a.speed) * 0.2;
                a.speed -= rel * 0.5; b.speed += rel * 0.5;
                // O travão do encontrão é por frame, e um toque prolongado passa
                // aqui vezes sem conta: daí ser de propósito uma perda pequena.
                a.speed *= BUMP_DAMP; b.speed *= BUMP_DAMP;
                spawnImpactSpark((a.x + b.x) / 2, (a.y + b.y) / 2);
                if (a === race.player || b === race.player) { bumpShake(3); sfx.bump(); }
            }
        }
    }
}
