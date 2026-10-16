import { LIVES } from './config.js';

export const session = {
    playerName: '',
    playerBoardName: ''
};

export const game = {
    phase: 'menu',
    paused: false,
    globalClock: 0,
    elapsed: 0,
    countdown: 0,
    holdTimer: 0,
    view: null,
    layout: null,
    menuLevelId: 1,
    pointerX: 0,
    touchMode: false,
    level: null,
    bricks: [],
    remaining: 0,
    steelHits: [],
    particles: [],
    paddle: { x: 0, width: 0, speed: 0 },
    ball: { x: 0, y: 0, vx: 0, vy: 0, stuck: true },
    lives: LIVES,
    levelScore: 0,
    result: null,
    input: { left: false, right: false, launch: false },
    flash: 0
};
