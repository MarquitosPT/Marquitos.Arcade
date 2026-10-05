// Estado da sessão e do nível em curso.
//
// Como no Maze Run: a `session` dura desde o menu (que nível, que bicho, que
// nome); o `game` é reposto a cada tentativa de um nível.

import { PLAYER_FALLBACK } from './config.js';

export const session = {
    /** Nível escolhido no menu (1-based). */
    levelId: 1,
    /** O bicho escolhido (ver animals.js). */
    animalId: 'gato',
    /** Nome a mostrar dentro do jogo. */
    playerName: PLAYER_FALLBACK,
    /** Nome a enviar ao quadro de pontuações — vazio deixa o servidor decidir. */
    playerBoardName: ''
};

export const game = {
    /**
     * 'menu'       — nenhum nível a correr; o início do nível escolhido está no fundo
     * 'countdown'  — 3, 2, 1 antes de arrancar
     * 'playing'    — a jogar
     * 'falling'    — caiu num buraco; um instante antes de voltar à bandeira
     * 'ending'     — o nível acabou; um instante antes do ecrã de resultados
     * 'result'     — ecrã de fim de nível
     */
    phase: 'menu',
    paused: false,

    level: null,
    /** O percurso (ver world.js): tiles e entidades, mutável durante a tentativa. */
    world: null,

    player: null,
    hearts: 0,
    heartsLost: 0,
    candies: 0,
    bigCandies: 0,
    stomps: 0,
    /** A bandeira onde se recomeça depois de cair. */
    checkpoint: null,
    /** Bolachas a desfazer-se: [{ c, r, t, fallen }]. */
    crumbles: [],

    /** Tempo da tentativa, em segundos. Anda só a jogar. */
    elapsed: 0,
    countdownValue: 0,
    countdownTimer: 0,
    holdTimer: 0,
    /** Relógio do nível: as plantas e as plataformas andam por ele. */
    levelClock: 0,

    /** Faíscas, poeira, pedaços de caixote e "+50" a subir. */
    particles: [],
    /** Abanão do ecrã depois de uma explosão, em segundos. */
    shake: 0,

    result: null,

    /** Relógio que nunca pára — serve às animações do menu e do desenho. */
    globalClock: 0,

    // ---------- Desenho ----------
    view: null,
    /** Píxeis por tile. Decidido a cada remedição (camera.js). */
    tile: 40,
    /** Canto de cima à esquerda da câmara, em tiles. */
    camera: { x: 0, y: 0, look: 0 },
    /** Altura em píxeis da faixa dos botões táteis por baixo do mundo (0 sem ela). */
    controlsBand: 0,
    /** True depois do primeiro toque no ecrã: os botões táteis aparecem. */
    touchMode: false,

    /** O percurso do menu, por trás do vidro. */
    menuWorld: null,
    /** Nível apontado no menu. */
    menuLevelId: 1
};

/** Repõe o `game` para o estado de menu, sem nível montado. */
export function resetGame() {
    game.phase = 'menu';
    game.paused = false;
    game.level = null;
    game.world = null;
    game.player = null;
    game.hearts = 0;
    game.heartsLost = 0;
    game.candies = 0;
    game.bigCandies = 0;
    game.stomps = 0;
    game.checkpoint = null;
    game.crumbles = [];
    game.elapsed = 0;
    game.levelClock = 0;
    game.particles = [];
    game.shake = 0;
    game.result = null;
}
