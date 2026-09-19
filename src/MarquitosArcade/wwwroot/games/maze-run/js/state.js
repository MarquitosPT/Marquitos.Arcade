// Estado da sessão e do nível em curso.
//
// Duas coisas com tempos de vida diferentes, como no Pixel Racing: a `session`
// dura desde o menu (é ela que sabe que nível se escolheu e com que nome se
// joga); o `game` é reposto a cada tentativa de um nível.

import { PLAYER_FALLBACK } from './config.js';

export const session = {
    /** Nível escolhido no menu (1-based). */
    levelId: 1,
    /** Nome a mostrar dentro do jogo. */
    playerName: PLAYER_FALLBACK,
    /** Nome a enviar ao quadro de pontuações — vazio deixa o servidor decidir. */
    playerBoardName: ''
};

export const game = {
    /**
     * 'menu'       — nenhum nível a correr; o labirinto do menu é que está no fundo
     * 'countdown'  — 3, 2, 1 antes de cada tentativa
     * 'playing'    — a jogar
     * 'caught'     — apanhado; toda a gente parada antes de voltar ao sítio
     * 'ending'     — o nível acabou; um instante antes de o ecrã de resultados subir
     * 'result'     — ecrã de fim de nível
     */
    phase: 'menu',
    paused: false,

    /** O que veio de `buildLevelLayout` — labirinto e colocações do nível. */
    layout: null,
    level: null,
    maze: null,

    player: null,
    /** [{ walker, kind, speed, color, mode }] */
    guards: [],
    /** [{ x, y, taken }] */
    crystals: [],
    collected: 0,
    exitOpen: false,

    lives: 0,
    livesLost: 0,
    timeLeft: 0,
    /** Tempo gasto na tentativa, em segundos — é este que se compara com o `par`. */
    elapsed: 0,

    countdownValue: 0,
    countdownTimer: 0,
    /** Conta-decrescente das pausas curtas ('caught' e 'clear'). */
    holdTimer: 0,

    /** Os guardas alternam entre 'chase' e 'scatter' (ver config.js). */
    guardMode: 'chase',
    guardModeTimer: 0,

    /** Resultado da tentativa, preenchido no fim. */
    result: null,

    /** Relógio que nunca pára — serve às animações do desenho. */
    globalClock: 0,

    // ---------- Desenho ----------
    /** O viewport do SDK (ver lib/arcade/viewport.js). */
    view: null,
    /** Lado de uma célula, em píxeis lógicos. Decidido a cada remedição. */
    cell: 24,
    /** Canto superior esquerdo do labirinto no ecrã, em píxeis lógicos. */
    origin: { x: 0, y: 0 },
    /** True quando o labirinto não cabe no ecrã e a câmara tem de seguir o jogador. */
    follow: false,
    /** Labirinto do menu: o que se vê por trás do vidro antes de se escolher. */
    menuLayout: null,
    /** Nível apontado no menu — o que o botão grande joga e o que se vê ao fundo. */
    menuLevelId: 1
};

/** Repõe o `game` para o estado de menu, sem nível montado. */
export function resetGame() {
    game.phase = 'menu';
    game.paused = false;
    game.layout = null;
    game.level = null;
    game.maze = null;
    game.player = null;
    game.guards = [];
    game.crystals = [];
    game.collected = 0;
    game.exitOpen = false;
    game.lives = 0;
    game.livesLost = 0;
    game.timeLeft = 0;
    game.elapsed = 0;
    game.result = null;
}
