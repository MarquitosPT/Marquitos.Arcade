// Um nível do princípio ao fim: montar o campo, servir a bola, mexer a
// raquete, partir tijolos, apanhar cápsulas, perder vidas e acabar.
//
// A física (js/physics.js) diz o que a bola tocou; é aqui que isso vira
// pontos, estilhaços, sons e cápsulas. Também é aqui que o progresso e a
// pontuação ficam registados, no momento em que o nível acaba — e não no ecrã
// de resultados: um ecrã que não chegue a montar-se nunca pode ser a razão de
// se perder o que se acabou de fazer (ver "Progresso e níveis" no README).

import { sfx } from './audio.js';
import { buildBricks, isBreakable, neighbours, BRICK_COLORS } from './bricks.js';
import {
    AUTO_LAUNCH, BALL_R, BALL_SPEED_CAP, BALL_SPEEDUP, BANNER_TIME, CAPSULE_H, CAPSULE_SPEED, CAPSULE_W,
    CATCH_HOLD, CHAIN_BONUS, CHAIN_CAP, CLEAR_HOLD, FIELD_H, FIELD_W, GAME_OVER_HOLD, LASER_INTERVAL,
    LASER_SPEED, LIFE_BONUS, LIFE_LOST_HOLD, LIVES, PADDLE_H, PADDLE_KEY_ACCEL, PADDLE_KEY_SPEED,
    PADDLE_WIDE_FACTOR, PADDLE_Y, SCORE_CAPSULE, SLOW_FACTOR, TIME_BONUS_PER_SECOND, TRAIL_LENGTH
} from './config.js';
import { burst, clearEffects, floater, ring, shake, sparks } from './effects.js';
import { consumeLaunch, input } from './input.js';
import { levelById } from './levels.js';
import { createBall, moveBall, moveBolt, paddleDirection } from './physics.js';
import { applyCapsule, clearPowers, maybeDropCapsule } from './powerups.js';
import { recordClear, totalScore } from './progress.js';
import { scores } from './scores.js';
import { game, session } from './state.js';

/** Cor dos estilhaços de cada tipo especial. */
const SHARD_COLORS = { silver: '#dfe6f2', titanium: '#8f9cc4', tnt: '#ff6a3c', steel: '#9aa3b5' };

/** Monta o campo de um nível sem o começar — é o que se vê por trás do menu. */
export function prepareLevel(level) {
    game.level = level;
    game.bricks = buildBricks(level);
    game.remaining = game.bricks.filter(isBreakable).length;
    game.paddle.baseW = level.paddleW;
    game.paddle.w = level.paddleW;
    game.paddle.x = (FIELD_W - level.paddleW) / 2;
    game.paddle.vx = 0;
    game.paddle.mode = null;
    clearPowers();
    clearEffects();
    serveBall();
}

/** Começa um nível. Devolve false se o nível não existir. */
export function startLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return false;
    prepareLevel(level);
    Object.assign(game, {
        phase: 'playing',
        paused: false,
        elapsed: 0,
        launched: false,
        holdTimer: 0,
        bannerTimer: BANNER_TIME,
        lives: LIVES,
        livesLost: 0,
        score: 0,
        chain: 0,
        bricksBroken: 0,
        capsulesTaken: 0,
        result: null
    });
    game.menuLevelId = levelId;
    return true;
}

/** Sai a meio (ou do fim) para o menu: o campo volta ao início do nível escolhido. */
export function abortLevel() {
    game.phase = 'menu';
    game.paused = false;
    game.result = null;
    prepareLevel(levelById(game.menuLevelId) || levelById(1));
}

export function togglePause() {
    game.paused = !game.paused;
}

/** Uma bola nova, colada ao meio da raquete. */
function serveBall() {
    const ball = createBall(game.level.ballSpeed);
    ball.holdTimer = AUTO_LAUNCH;
    game.balls = [ball];
    stickToPaddle(ball);
}

function stickToPaddle(ball) {
    const { paddle } = game;
    const half = paddle.w / 2 - BALL_R;
    ball.stuckOffset = Math.max(-half, Math.min(half, ball.stuckOffset));
    ball.x = paddle.x + paddle.w / 2 + ball.stuckOffset;
    ball.y = PADDLE_Y - BALL_R;
    ball.trail.length = 0;
}

function release(ball) {
    ball.stuck = false;
    // Do meio da raquete, a bola sai um pouco inclinada: a direito, ficava
    // a subir e a descer pelo mesmo sítio.
    const offset = ball.stuckOffset / (game.paddle.w / 2) || (Math.random() < 0.5 ? -0.22 : 0.22);
    const dir = paddleDirection(offset * 0.8);
    ball.dx = dir.dx;
    ball.dy = dir.dy;
    if (!game.launched) {
        game.launched = true;
        game.bannerTimer = Math.min(game.bannerTimer, 0.4);
    }
    sfx.launch();
}

// ---------- O passo ----------

export function updateLevel(dt) {
    game.bannerTimer = Math.max(0, game.bannerTimer - dt);

    if (game.phase === 'lost') {
        movePaddle(dt);
        game.holdTimer -= dt;
        if (game.holdTimer <= 0) {
            serveBall();
            game.phase = 'playing';
        }
        return;
    }
    if (game.phase === 'ending') {
        game.holdTimer -= dt;
        return;
    }
    if (game.phase !== 'playing') return;

    if (game.launched) game.elapsed += dt;
    game.timers.slow = Math.max(0, game.timers.slow - dt);
    if (game.timers.laser > 0) {
        game.timers.laser = Math.max(0, game.timers.laser - dt);
        if (game.timers.laser === 0 && game.paddle.mode === 'laser') game.paddle.mode = null;
    }

    movePaddle(dt);
    updateBalls(dt);
    if (game.phase !== 'playing') return;
    updateLasers(dt);
    updateCapsules(dt);
    if (game.remaining === 0 && game.phase === 'playing') finishLevel(true);
}

function movePaddle(dt) {
    const p = game.paddle;

    // A raquete larga cresce (e encolhe) aos poucos, sem sair do sítio.
    const targetW = p.baseW * (p.mode === 'wide' ? PADDLE_WIDE_FACTOR : 1);
    if (p.w !== targetW) {
        const center = p.x + p.w / 2;
        const change = 220 * dt;
        p.w = targetW > p.w ? Math.min(targetW, p.w + change) : Math.max(targetW, p.w - change);
        p.x = center - p.w / 2;
    }

    if (input.pointerX !== null) {
        p.x = input.pointerX - p.w / 2;
        p.vx = 0;
    }
    if (input.dragDx) {
        p.x += input.dragDx;
        input.dragDx = 0;
    }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) {
        if (Math.sign(p.vx) !== dir) p.vx = 0;
        p.vx = Math.max(-PADDLE_KEY_SPEED, Math.min(PADDLE_KEY_SPEED, p.vx + dir * PADDLE_KEY_ACCEL * dt));
        p.x += p.vx * dt;
    } else {
        p.vx = 0;
    }
    p.x = Math.max(0, Math.min(FIELD_W - p.w, p.x));
}

function updateBalls(dt) {
    const launch = consumeLaunch();
    const speedFactor = game.timers.slow > 0 ? SLOW_FACTOR : 1;

    for (const ball of game.balls) {
        if (ball.stuck) {
            stickToPaddle(ball);
            ball.holdTimer -= dt;
            if (launch || ball.holdTimer <= 0) release(ball);
            continue;
        }

        ball.trail.unshift({ x: ball.x, y: ball.y });
        if (ball.trail.length > TRAIL_LENGTH) ball.trail.length = TRAIL_LENGTH;

        const events = moveBall(ball, ball.speed * speedFactor * dt, game);
        for (const event of events) {
            switch (event.type) {
                case 'brick':
                    hitBrick(event.brick);
                    break;
                case 'paddle':
                    onPaddle(ball, event.offset);
                    break;
                case 'wall':
                case 'ceiling':
                    sfx.wall();
                    break;
                case 'lost':
                    ball.lost = true;
                    break;
                default:
                    break;
            }
        }
        if (game.phase !== 'playing') return;
    }

    game.balls = game.balls.filter((ball) => !ball.lost);
    if (!game.balls.length) loseLife();
}

function onPaddle(ball, offset) {
    game.chain = 0;
    game.paddle.glow = 1;
    ball.speed = Math.min(game.level.ballSpeed * BALL_SPEED_CAP, ball.speed * BALL_SPEEDUP);
    sparks(ball.x, PADDLE_Y, '#bff6ff', 5);
    sfx.paddle(offset);
    if (game.paddle.mode === 'catch') {
        ball.stuck = true;
        ball.stuckOffset = ball.x - (game.paddle.x + game.paddle.w / 2);
        ball.holdTimer = CATCH_HOLD;
        stickToPaddle(ball);
    }
}

// ---------- Tijolos ----------

/** Um golpe num tijolo: da bola ou do laser. */
function hitBrick(brick) {
    brick.flash = 1;
    if (brick.hits === Infinity) {
        sfx.steel();
        return;
    }
    brick.hits -= 1;
    if (brick.hits > 0) {
        sparks(brick.x + brick.w / 2, brick.y + brick.h, '#e8eeff', 4);
        sfx.clank();
        return;
    }
    breakBrick(brick);
}

function breakBrick(brick) {
    if (!brick.alive) return;
    brick.alive = false;
    brick.hits = 0;
    game.remaining -= 1;
    game.bricksBroken += 1;
    game.chain += 1;

    const points = brick.points + Math.min(game.chain, CHAIN_CAP) * CHAIN_BONUS;
    game.score += points;
    const color = brick.color ? BRICK_COLORS[brick.color].base : SHARD_COLORS[brick.kind];
    floater(brick.x + brick.w / 2, brick.y + brick.h / 2, `+${points}`, color);
    burst(brick, color, brick.kind === 'color' ? 8 : 12);
    sfx.brick(game.chain);
    maybeDropCapsule(brick);

    if (brick.kind === 'tnt') explode(brick);
}

/** A TNT parte os oito vizinhos — e uma TNT vizinha rebenta também. O aço aguenta. */
function explode(brick) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    ring(cx, cy, '#ffb03c', 52);
    shake(7);
    game.flash = Math.max(game.flash, 0.5);
    sfx.boom();
    for (const other of neighbours(game.bricks, brick)) {
        if (other.hits === Infinity) continue;
        other.flash = 1;
        breakBrick(other);
    }
}

// ---------- Laser e cápsulas ----------

function updateLasers(dt) {
    const p = game.paddle;
    if (p.mode === 'laser') {
        game.laserCooldown -= dt;
        if (game.laserCooldown <= 0) {
            game.laserCooldown = LASER_INTERVAL;
            game.lasers.push({ x: p.x + 6, y: PADDLE_Y - 2 }, { x: p.x + p.w - 6, y: PADDLE_Y - 2 });
            sfx.laser();
        }
    } else {
        game.laserCooldown = 0;
    }

    const travel = LASER_SPEED * dt;
    game.lasers = game.lasers.filter((bolt) => {
        const brick = moveBolt(bolt, travel, game.bricks);
        if (brick) {
            sparks(bolt.x, brick.y + brick.h, '#ff8aa0', 4);
            hitBrick(brick);
            return false;
        }
        return bolt.y > 0;
    });
}

function updateCapsules(dt) {
    const p = game.paddle;
    game.capsules = game.capsules.filter((capsule) => {
        capsule.y += CAPSULE_SPEED * dt;
        capsule.spin += dt;
        const caught = capsule.y + CAPSULE_H >= PADDLE_Y
            && capsule.y <= PADDLE_Y + PADDLE_H
            && capsule.x + CAPSULE_W >= p.x
            && capsule.x <= p.x + p.w;
        if (caught) {
            applyCapsule(capsule.type);
            game.capsulesTaken += 1;
            game.score += SCORE_CAPSULE;
            floater(p.x + p.w / 2, PADDLE_Y - 14, capsule.type.label, capsule.type.color);
            sfx.capsule();
            return false;
        }
        return capsule.y < FIELD_H;
    });
}

// ---------- Vidas e fim ----------

function loseLife() {
    game.lives -= 1;
    game.livesLost += 1;
    game.chain = 0;
    clearPowers();
    shake(6);
    if (game.lives <= 0) {
        finishLevel(false);
        return;
    }
    sfx.lost();
    game.phase = 'lost';
    game.holdTimer = LIFE_LOST_HOLD;
}

/** Estrelas: uma por acabar, uma por não perder vidas, uma pelo tempo-alvo. */
function starsFor(level) {
    return 1 + (game.livesLost === 0 ? 1 : 0) + (game.elapsed <= level.par ? 1 : 0);
}

function finishLevel(cleared) {
    const level = game.level;
    game.phase = 'ending';
    game.capsules.length = 0;
    game.lasers.length = 0;

    if (!cleared) {
        game.holdTimer = GAME_OVER_HOLD;
        game.result = {
            cleared: false,
            levelId: level.id,
            bricksBroken: game.bricksBroken,
            remaining: game.remaining,
            ms: Math.round(game.elapsed * 1000)
        };
        sfx.gameOver();
        return;
    }

    game.balls = [];
    const lifeBonus = game.lives * LIFE_BONUS;
    const timeBonus = Math.max(0, Math.round(level.par - game.elapsed)) * TIME_BONUS_PER_SECOND;
    const bricksScore = game.score;
    game.score += lifeBonus + timeBonus;
    const stars = starsFor(level);
    const ms = Math.round(game.elapsed * 1000);

    const recorded = recordClear(level.id, { score: game.score, ms, stars });
    scores.submitQuietly(session.playerBoardName, totalScore());

    game.result = {
        cleared: true,
        levelId: level.id,
        score: game.score,
        bricksScore,
        lifeBonus,
        timeBonus,
        ms,
        stars,
        livesLost: game.livesLost,
        livesLeft: game.lives,
        seconds: game.elapsed,
        par: level.par,
        bricksBroken: game.bricksBroken,
        capsulesTaken: game.capsulesTaken,
        ...recorded
    };
    game.holdTimer = CLEAR_HOLD;
    game.flash = 0.6;
    sfx.clear();
}
