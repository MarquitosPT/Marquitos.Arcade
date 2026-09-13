// Estado mutável de uma partida.
//
// Vive num objeto único partilhado pelos módulos (física, desenho, controlos) em
// vez de variáveis soltas: com ficheiros separados, um `let` de topo de módulo só
// seria visível dentro desse ficheiro.

import { DEFAULT_AI_LEVEL, MODE_SINGLE } from './config.js';

export const state = {
    /** Viewport do SDK (dimensões lógicas, DPR, topInset). Preenchido pelo main.js. */
    view: null,

    mode: MODE_SINGLE,
    aiLevel: DEFAULT_AI_LEVEL,
    running: false,

    /** Pontuação do jogador (ou do da esquerda, a dois jogadores). */
    scoreP: 0,
    /** Pontuação do adversário (IA, ou o da direita). */
    scoreA: 0,

    // Um jogador: raquetes horizontais, em cima e em baixo.
    player: { x: 0, y: 0 },
    ai: { x: 0, y: 0 },
    paddleW: 0,
    paddleH: 0,

    // Dois jogadores: raquetes verticais, à esquerda e à direita.
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
    paddleLen: 0,
    paddleThick: 0,

    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    ballR: 0
};

export const isSinglePlayer = () => state.mode === MODE_SINGLE;

export function resetScores() {
    state.scoreP = 0;
    state.scoreA = 0;
}
