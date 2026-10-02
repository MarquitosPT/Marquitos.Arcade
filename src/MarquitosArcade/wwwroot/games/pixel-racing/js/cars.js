// Carros e adversários.
//
// Cada CPU recebe uma "personalidade" sorteada — o quanto olha para a frente, a
// mão que tem no volante, o gosto pelo drift e pelo boost. É o que faz os três
// adversários correrem de maneira diferente uns dos outros sem haver três
// algoritmos de condução.

import { shuffle, rand } from '/lib/arcade/math.js';
import { CAR_COLORS, CPU_NAMES, PLAYER_CAR_TYPE, PLAYER_COLOR, carType } from './config.js';
import { session } from './state.js';

export function makeCar(key, name, color, type) {
    return {
        key, name, color,
        type: carType(type).id,
        /** Multiplicadores do tipo de carro (ver CAR_TYPES). */
        stats: carType(type).stats,
        x: 0, y: 0, facing: 0, velAngle: 0, speed: 0,
        steerInput: 0, driftHold: false, boostHold: false, brakeHeld: false,
        boost: 0, driftCharge: 0, wasDrifting: false,
        oilTimer: 0, oilSpin: 1, offTrack: false, dustTimer: 0,
        idx: 0, totalDistance: 0, lap: 0, lastPadIdx: -1,
        speedMult: 1, ai: null, smokeTimer: 0
    };
}

/**
 * Monta a grelha: o jogador com o nome, a cor e o carro que escolheu, e três
 * CPU com nomes e cores sorteados de entre os que sobram. Todos correm com o
 * mesmo tipo de carro — cada corrida é uma categoria (karts, jeeps, GT ou
 * fórmulas), e assim ganha-se pela condução e não pelo carro que calhou.
 */
export function setupParticipants(playerName, playerColor = PLAYER_COLOR, playerType = PLAYER_CAR_TYPE) {
    const cpuNames = shuffle(CPU_NAMES).slice(0, 3);
    const cpuColors = shuffle(CAR_COLORS.filter((c) => c.value !== playerColor)).slice(0, 3);
    session.participants = [
        { key: 'player', name: playerName, color: playerColor, type: playerType },
        { key: 'cpu1', name: cpuNames[0], color: cpuColors[0].value, type: playerType },
        { key: 'cpu2', name: cpuNames[1], color: cpuColors[1].value, type: playerType },
        { key: 'cpu3', name: cpuNames[2], color: cpuColors[2].value, type: playerType }
    ];
    session.tournamentPoints = { player: 0, cpu1: 0, cpu2: 0, cpu3: 0 };
    session.playerScore = 0;
}

export function makePersonality() {
    return {
        lookahead: Math.round(rand(18, 28)),
        steerGain: rand(1.8, 2.4),
        driftiness: rand(0.35, 0.85),
        boostChance: rand(0.15, 0.35),
        speedVar: rand(-0.03, 0.03)
    };
}
