// Estado de um turno na cozinha.

import { TUNING } from './config.js';

export const state = {
    running: false,
    paused: false,
    playerName: '',

    score: 0,
    lives: TUNING.lives,
    /** Pratos servidos com sucesso — é o contador que faz o turno apertar. */
    served: 0,

    /** Fila de pedidos; o índice 0 é o que está a ser preparado. */
    orders: [],

    // Dificuldade corrente: começa nos valores de arranque e vai encurtando.
    patienceMax: TUNING.startPatienceMs,
    spawnInterval: TUNING.startSpawnIntervalMs,
    /** Tempo acumulado desde o último pedido, em ms. */
    lastSpawn: 0
};

/** Repõe o estado para um turno novo, sem trocar o objeto (os módulos guardam a referência). */
export function resetShift() {
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.lives = TUNING.lives;
    state.served = 0;
    state.orders = [];
    state.patienceMax = TUNING.startPatienceMs;
    state.spawnInterval = TUNING.startSpawnIntervalMs;
    // Arranca "a dever" um pedido para o primeiro cliente não demorar a aparecer.
    state.lastSpawn = TUNING.startSpawnIntervalMs;
}
