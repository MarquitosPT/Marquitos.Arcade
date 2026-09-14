// Arranque, decurso e fim de uma corrida.

import { clamp, shuffle } from '/lib/arcade/math.js';
import { CAM_FOLLOW, LAPS_REQUIRED, MAX_SPEED, NARROW_WIDTH, ZOOM, ZOOM_NARROW } from './config.js';
import { TRACKS } from './tracks.js';
import { makeCar, makePersonality } from './cars.js';
import { muteEngine, resumeAudio, sfx, updateEngineSound } from './audio.js';
import { applyPlayerInput } from './input.js';
import { resetParticles } from './particles.js';
import { updateAI } from './ai.js';
import { carCollisions, computeProgress, integrateCar, wallCollision } from './physics.js';
import { race, session } from './state.js';
import { overlays, topBar } from './ui.js';

/** Aproximação de base para o ecrã atual (ver ZOOM no config). */
export function baseZoom() {
    return race.view && race.view.width < NARROW_WIDTH ? ZOOM_NARROW : ZOOM;
}

export function startRace(trackIdx) {
    race.track = TRACKS[trackIdx];
    race.cars = session.participants.map(p => makeCar(p.key, p.name, p.color));
    race.player = race.cars[0];
    for (const c of race.cars) if (c.key !== 'player') c.ai = makePersonality();

    // Duas filas de dois. Os afastamentos acompanham o tamanho do carro: com
    // carros maiores, as filas e os lugares lado a lado passavam a tocar-se.
    const gridOffsets = shuffle([
        { back: 0, side: -40 }, { back: 0, side: 40 },
        { back: 78, side: -40 }, { back: 78, side: 40 }
    ]);
    const p0 = race.track.pts[0], t0 = race.track.tang[0], n0 = race.track.norm[0];
    race.cars.forEach((car, i) => {
        const g = gridOffsets[i];
        car.x = p0.x - t0.x * g.back + n0.x * g.side;
        car.y = p0.y - t0.y * g.back + n0.y * g.side;
        car.facing = Math.atan2(t0.y, t0.x);
        car.velAngle = car.facing;
        car.idx = 0; car.totalDistance = 0; car.lap = 0; car.lastPadIdx = -1;
        const diffVar = car.key === 'player' ? 1 : session.difficulty + (car.ai.speedVar || 0);
        car.speedMult = diffVar;
    });

    race.camera.x = race.player.x; race.camera.y = race.player.y;
    race.zoom = baseZoom();
    resetParticles();
    race.clock = 0;
    race.countdownValue = 3;
    race.countdownTimer = 0;
    race.phase = 'countdown';
    overlays.hideAll();
    topBar.setInGame(true);
    resumeAudio();
}

export function triggerFinish() {
    race.finishSnapshot = [...race.cars].sort((a, b) => b.totalDistance - a.totalDistance).map((c, i) => ({ key: c.key, name: c.name, color: c.color, rank: i + 1 }));
    race.finishTimer = 1.3;
    race.phase = 'finishOverlay';
    sfx.finish();
}

export function returnToMenuAbort() {
    muteEngine();
    race.phase = 'menu';
    race.paused = false;
    overlays.show('start');
    topBar.setInGame(false);
}

export function togglePause() {
    if (race.phase !== 'racing') return;
    race.paused = !race.paused;
    if (race.paused) {
        overlays.show('pause');
        muteEngine();
    } else {
        overlays.hide('pause');
    }
}

export function updateRace(dt) {
    race.clock += dt;
    applyPlayerInput();
    for (const car of race.cars) if (car !== race.player) updateAI(car, dt);
    for (const car of race.cars) integrateCar(car, dt, car === race.player);
    for (const car of race.cars) computeProgress(car);
    for (const car of race.cars) wallCollision(car);
    carCollisions();

    const prevLap = race.player._lastLap || 0;
    if (race.player.lap > prevLap && race.player.lap < LAPS_REQUIRED) sfx.lap();
    race.player._lastLap = race.player.lap;

    if (race.player.lap >= LAPS_REQUIRED) { triggerFinish(); return; }

    updateEngineSound(clamp(race.player.speed / MAX_SPEED, 0, 1), race.player.boostHold && race.player.boost > 0);
}

export function updateCamera(dt) {
    race.camera.x += (race.player.x - race.camera.x) * Math.min(1, CAM_FOLLOW * dt);
    race.camera.y += (race.player.y - race.camera.y) * Math.min(1, CAM_FOLLOW * dt);
    const base = baseZoom();
    const targetZoom = (race.player.boostHold && race.player.boost > 0) ? base * 0.92 : base;
    race.zoom += (targetZoom - race.zoom) * Math.min(1, 4 * dt);
    race.shake.amount *= Math.exp(-8 * dt);
    race.shake.x = (Math.random() - 0.5) * race.shake.amount;
    race.shake.y = (Math.random() - 0.5) * race.shake.amount;
}
