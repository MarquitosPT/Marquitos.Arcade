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

    // Campo ao alto: raquetes horizontais, em cima e em baixo.
    player: { x: 0, y: 0 },
    ai: { x: 0, y: 0 },
    paddleW: 0,
    paddleH: 0,

    // Campo ao comprido: raquetes verticais, à esquerda e à direita. A `p1` é
    // sempre a de quem está a jogar; a `p2` é do segundo jogador ou do CPU.
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 0 },
    paddleLen: 0,
    paddleThick: 0,

    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    ballR: 0
};

export const isSinglePlayer = () => state.mode === MODE_SINGLE;

/**
 * Qual dos dois campos está em jogo: o de raquetes nos lados (ao comprido) ou o
 * de raquetes em cima e em baixo (ao alto).
 *
 * A dois jogadores é sempre o de lado — cada um fica com a sua metade do ecrã, e
 * em retrato nem se chega a começar, que o menu pede para rodar. Contra o CPU é a
 * orientação que manda: ao alto joga-se de baixo para cima, como sempre, e ao
 * comprido passa a jogar-se de lado, porque as duas raquetes horizontais ficavam
 * quase encostadas uma à outra num ecrã com 400pt de altura.
 */
export const isSideField = () => !isSinglePlayer() || !state.view.isPortrait;

export function resetScores() {
    state.scoreP = 0;
    state.scoreA = 0;
}
