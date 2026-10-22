// Estado mutável do jogo. Um objeto só, partilhado pelos módulos — e exposto
// ao smoke-test, que o lê para ver se a raquete e a bola respondem.
//
// As fases:
//
//   menu    os ecrãs do menu, com o nível escolhido desenhado por trás
//   playing a jogar — com a bola a andar ou ainda na raquete (`ball.stuck`)
//   lost    perdeu-se a última bola; espera-se um pouco antes de servir outra
//   ending  o nível acabou (bem ou mal); espera-se antes dos resultados
//   result  o ecrã de resultados

import { LIVES } from './config.js';

export const session = {
    /** O nome a mostrar no jogo, e o que vai ao quadro (ver bindPlayerNameInput). */
    playerName: '',
    playerBoardName: ''
};

export const game = {
    phase: 'menu',
    paused: false,
    /** Relógio que nunca pára (animações do cenário), em segundos. */
    globalClock: 0,
    /** Tempo de jogo do nível: só anda depois do primeiro lançamento. */
    elapsed: 0,
    launched: false,
    holdTimer: 0,
    bannerTimer: 0,

    /** O viewport do SDK e a escala do campo (js/field.js). */
    view: null,
    layout: null,
    /** Num aparelho de toque mudam as instruções: "toca" em vez de "espaço". */
    touchMode: false,

    menuLevelId: 1,
    level: null,
    bricks: [],
    /** Tijolos por partir (o aço não conta). */
    remaining: 0,

    paddle: { x: 0, w: 80, baseW: 80, vx: 0, mode: null, glow: 0 },
    balls: [],
    capsules: [],
    lasers: [],
    laserCooldown: 0,
    /** Poderes com relógio, em segundos que faltam. */
    timers: { slow: 0, laser: 0 },

    lives: LIVES,
    livesLost: 0,
    score: 0,
    /** Tijolos partidos desde o último toque na raquete. */
    chain: 0,
    bricksBroken: 0,
    capsulesTaken: 0,

    particles: [],
    floaters: [],
    rings: [],
    shake: 0,
    flash: 0,
    result: null
};
