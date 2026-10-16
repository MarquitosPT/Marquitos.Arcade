import {
    BALL_MAX_SPEED,
    BALL_MIN_VERTICAL,
    BALL_RADIUS,
    BALL_SPEEDUP,
    BRICK_AREA_TOP,
    BRICK_GAP,
    BRICK_HEIGHT,
    COUNTDOWN_FROM,
    LIFE_LOST_DELAY,
    LIVES,
    PADDLE_HEIGHT,
    PADDLE_Y_GAP,
    RESULT_DELAY,
    SCORE_ARMORED,
    SCORE_BRICK,
    SCORE_CLEAR,
    SCORE_HARD,
    SCORE_LIFE,
    WALL_THICKNESS
} from './config.js';
import { sfx } from './audio.js';
import { consumeLaunch } from './input.js';
import { levelById } from './levels.js';
import { recordClear, totalScore } from './progress.js';
import { scores } from './scores.js';
import { game, session } from './state.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function seededLaunch(levelId) {
    const angle = (levelId % 2 === 0 ? 1 : -1) * (0.24 + (levelId % 5) * 0.04);
    return angle;
}

export function layoutPlayfield() {
    const view = game.view;
    if (!view) return;
    const safe = view.safeArea;
    const pad = 12;
    const availableW = view.width - safe.left - safe.right - pad * 2;
    const availableH = view.height - view.topInset - Math.max(safe.bottom, 10) - pad;
    const aspect = 0.62;
    let width = availableW;
    let height = width / aspect;
    if (height > availableH) {
        height = availableH;
        width = height * aspect;
    }
    const x = safe.left + pad + (availableW - width) / 2;
    const y = view.topInset + (availableH - height) / 2;
    const inner = {
        x: x + WALL_THICKNESS,
        y: y + WALL_THICKNESS,
        width: width - WALL_THICKNESS * 2,
        height: height - WALL_THICKNESS * 1.2,
        top: y + WALL_THICKNESS,
        left: x + WALL_THICKNESS,
        right: x + width - WALL_THICKNESS,
        bottom: y + WALL_THICKNESS + (height - WALL_THICKNESS * 1.2)
    };
    const brickAreaTop = inner.y + BRICK_AREA_TOP * (width / 540);
    const gap = Math.max(4, BRICK_GAP * (width / 540));
    const cols = game.level?.cols || 9;
    const brickW = (inner.width - gap * (cols - 1)) / cols;
    const brickH = Math.max(22, BRICK_HEIGHT * (width / 540));

    game.layout = {
        frame: { x, y, width, height },
        inner,
        brickAreaTop,
        brickGap: gap,
        brickW,
        brickH,
        paddleY: inner.bottom - PADDLE_Y_GAP,
        wallPattern: 24 * (width / 540)
    };

    if (game.level) rebuildBricks();
    fitPaddle();
    dockBall();
}

export function startLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return false;
    game.level = level;
    game.menuLevelId = levelId;
    game.phase = 'countdown';
    game.paused = false;
    game.elapsed = 0;
    game.countdown = COUNTDOWN_FROM;
    game.holdTimer = 0;
    game.lives = LIVES;
    game.levelScore = 0;
    game.result = null;
    game.particles = [];
    game.steelHits = [];
    game.flash = 0;
    fitPaddle();
    rebuildBricks();
    dockBall();
    return true;
}

export function abortLevel() {
    game.phase = 'menu';
    game.paused = false;
    game.level = levelById(game.menuLevelId);
    game.result = null;
    rebuildBricks();
    fitPaddle();
    dockBall();
}

function fitPaddle() {
    const layout = game.layout;
    if (!layout) return;
    const baseWidth = game.level?.paddleWidth || 130;
    const scale = layout.frame.width / 540;
    const maxWidth = Math.max(72, Math.min(baseWidth, Math.floor(layout.inner.width * 0.42)));
    const width = clamp(
        Math.round(baseWidth * scale),
        72,
        maxWidth
    );
    game.paddle.width = width;
    if (!Number.isFinite(game.paddle.x) || game.paddle.x === 0) {
        game.paddle.x = layout.inner.x + (layout.inner.width - width) / 2;
        return;
    }
    game.paddle.x = clamp(game.paddle.x, layout.inner.x, layout.inner.right - width);
}

function dockBall() {
    const layout = game.layout;
    if (!layout) return;
    game.ball.stuck = true;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.ball.x = game.paddle.x + game.paddle.width / 2;
    game.ball.y = layout.paddleY - BALL_RADIUS - PADDLE_HEIGHT / 2;
}

function rebuildBricks() {
    if (!game.layout || !game.level) return;
    const { grid, cols } = game.level;
    const { brickAreaTop, brickGap, brickW, brickH, inner } = game.layout;
    const bricks = [];
    let remaining = 0;
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < cols; col++) {
            const hp = grid[row][col];
            if (!hp) continue;
            const brick = {
                x: inner.x + col * (brickW + brickGap),
                y: brickAreaTop + row * (brickH + brickGap),
                w: brickW,
                h: brickH,
                hp,
                maxHp: hp,
                steel: hp >= 9,
                flash: 0
            };
            if (!brick.steel) remaining++;
            bricks.push(brick);
        }
    }
    game.bricks = bricks;
    game.remaining = remaining;
}

function launchBall() {
    if (!game.ball.stuck || !game.level) return;
    const speed = game.level.ballSpeed;
    const angle = seededLaunch(game.level.id);
    game.ball.stuck = false;
    game.ball.vx = Math.sin(angle) * speed;
    game.ball.vy = -Math.cos(angle) * speed;
    sfx.launch();
}

function updatePaddle(dt) {
    if (!game.layout) return;
    const prev = game.paddle.x;
    const keyboardDir = (game.input.right ? 1 : 0) - (game.input.left ? 1 : 0);
    if (keyboardDir) {
        const speed = game.layout.inner.width * 1.35;
        game.paddle.x += keyboardDir * speed * dt;
    } else if (game.pointerX > 0) {
        const canvasWidth = game.view?.canvas?.getBoundingClientRect().width || game.view?.width || game.layout.frame.width;
        const scale = (game.view?.width || game.layout.frame.width) / canvasWidth;
        const worldX = game.pointerX * scale;
        game.paddle.x = worldX - game.paddle.width / 2;
    }
    game.paddle.x = clamp(game.paddle.x, game.layout.inner.x, game.layout.inner.right - game.paddle.width);
    game.paddle.speed = (game.paddle.x - prev) / Math.max(dt, 0.001);
    if (game.ball.stuck) {
        game.ball.x = game.paddle.x + game.paddle.width / 2;
        game.ball.y = game.layout.paddleY - BALL_RADIUS - PADDLE_HEIGHT / 2;
    }
}

function reflectBallFromPaddle() {
    const hit = (game.ball.x - (game.paddle.x + game.paddle.width / 2)) / (game.paddle.width / 2);
    const speed = Math.min(BALL_MAX_SPEED, Math.max(game.level.ballSpeed, Math.hypot(game.ball.vx, game.ball.vy) * BALL_SPEEDUP));
    const angle = clamp(hit * 1.05 + game.paddle.speed / 1500, -1.22, 1.22);
    game.ball.vx = Math.sin(angle) * speed;
    game.ball.vy = -Math.max(BALL_MIN_VERTICAL, Math.abs(Math.cos(angle) * speed));
    sfx.paddle();
}

function hitScore(hp) {
    return hp >= 3 ? SCORE_ARMORED : hp === 2 ? SCORE_HARD : SCORE_BRICK;
}

function spawnParticles(brick, hue) {
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = 50 + Math.random() * 70;
        game.particles.push({
            x: brick.x + brick.w / 2,
            y: brick.y + brick.h / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5 + Math.random() * 0.25,
            color: hue
        });
    }
}

function finishLevel() {
    const level = game.level;
    const ms = Math.round(game.elapsed * 1000);
    const stars = 1 + (game.lives === LIVES ? 1 : 0) + (ms <= level.targetMs ? 1 : 0);
    game.levelScore += level.clearBonus + SCORE_CLEAR * level.id + game.lives * SCORE_LIFE;
    const { improved, unlockedLevel } = recordClear(level.id, {
        score: game.levelScore,
        ms,
        stars,
        lives: game.lives,
        bricks: level.brickCount
    });
    scores.submitQuietly(session.playerBoardName, totalScore());
    game.result = {
        cleared: true,
        levelId: level.id,
        score: game.levelScore,
        ms,
        stars,
        improved,
        unlockedLevel,
        livesLeft: game.lives,
        bricks: level.brickCount,
        total: totalScore()
    };
    game.phase = 'ending';
    game.holdTimer = RESULT_DELAY;
    sfx.clear();
}

function failLevel() {
    game.result = {
        cleared: false,
        levelId: game.level.id,
        score: game.levelScore,
        ms: Math.round(game.elapsed * 1000),
        livesLeft: 0,
        bricksLeft: game.remaining
    };
    game.phase = 'ending';
    game.holdTimer = RESULT_DELAY;
    sfx.fail();
}

function hitBrick(brick) {
    if (brick.steel) {
        brick.flash = 0.18;
        game.steelHits.push({ x: game.ball.x, y: game.ball.y, life: 0.2 });
        sfx.steel();
        return;
    }
    brick.hp -= 1;
    brick.flash = 0.18;
    game.levelScore += hitScore(brick.maxHp);
    spawnParticles(brick, brick.maxHp >= 3 ? '#fde68a' : brick.maxHp === 2 ? '#a7f3d0' : '#7dd3fc');
    sfx.brick(brick.maxHp);
    if (brick.hp <= 0) {
        game.remaining--;
        if (game.remaining <= 0) finishLevel();
    }
}

function collideBricks() {
    for (const brick of game.bricks) {
        if (!brick.steel && brick.hp <= 0) continue;
        const closestX = clamp(game.ball.x, brick.x, brick.x + brick.w);
        const closestY = clamp(game.ball.y, brick.y, brick.y + brick.h);
        const dx = game.ball.x - closestX;
        const dy = game.ball.y - closestY;
        if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) continue;
        const overlapX = BALL_RADIUS - Math.abs(dx);
        const overlapY = BALL_RADIUS - Math.abs(dy);
        if (overlapX < overlapY) game.ball.vx *= -1;
        else game.ball.vy *= -1;
        hitBrick(brick);
        return true;
    }
    return false;
}

function stepBall(dt) {
    const speed = Math.hypot(game.ball.vx, game.ball.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / 10));
    const slice = dt / steps;
    const inner = game.layout.inner;

    for (let i = 0; i < steps; i++) {
        game.ball.x += game.ball.vx * slice;
        game.ball.y += game.ball.vy * slice;

        if (game.ball.x - BALL_RADIUS < inner.left) {
            game.ball.x = inner.left + BALL_RADIUS;
            game.ball.vx = Math.abs(game.ball.vx);
            sfx.wall();
        }
        if (game.ball.x + BALL_RADIUS > inner.right) {
            game.ball.x = inner.right - BALL_RADIUS;
            game.ball.vx = -Math.abs(game.ball.vx);
            sfx.wall();
        }
        if (game.ball.y - BALL_RADIUS < inner.top) {
            game.ball.y = inner.top + BALL_RADIUS;
            game.ball.vy = Math.abs(game.ball.vy);
            sfx.wall();
        }

        const paddleTop = game.layout.paddleY - PADDLE_HEIGHT / 2;
        if (game.ball.vy > 0
            && game.ball.y + BALL_RADIUS >= paddleTop
            && game.ball.y - BALL_RADIUS <= paddleTop + PADDLE_HEIGHT
            && game.ball.x >= game.paddle.x - BALL_RADIUS
            && game.ball.x <= game.paddle.x + game.paddle.width + BALL_RADIUS) {
            game.ball.y = paddleTop - BALL_RADIUS;
            reflectBallFromPaddle();
        }

        if (collideBricks()) {
            const speedNow = Math.min(BALL_MAX_SPEED, Math.hypot(game.ball.vx, game.ball.vy) * BALL_SPEEDUP);
            const angle = Math.atan2(game.ball.vy, game.ball.vx);
            game.ball.vx = Math.cos(angle) * speedNow;
            game.ball.vy = Math.sin(angle) * speedNow;
            if (game.phase !== 'playing') return;
        }

        if (game.ball.y - BALL_RADIUS > inner.bottom) {
            game.lives -= 1;
            if (game.lives > 0) {
                game.phase = 'lifeLost';
                game.holdTimer = LIFE_LOST_DELAY;
                dockBall();
                sfx.life();
            } else failLevel();
            return;
        }
    }
}

export function updateGame(dt) {
    if (!game.level) return;
    game.flash = Math.max(0, game.flash - dt);
    for (const brick of game.bricks) brick.flash = Math.max(0, brick.flash - dt);
    game.steelHits = game.steelHits.filter((spark) => (spark.life -= dt) > 0);
    game.particles = game.particles.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
        p.life -= dt;
        return p.life > 0;
    });

    updatePaddle(dt);

    switch (game.phase) {
        case 'countdown':
            game.countdown -= dt;
            if (consumeLaunch() && game.countdown <= 0.9) launchBall();
            if (game.countdown <= 0) {
                launchBall();
                game.phase = 'playing';
            }
            break;
        case 'playing':
            game.elapsed += dt;
            if (consumeLaunch() && game.ball.stuck) launchBall();
            stepBall(dt);
            break;
        case 'lifeLost':
            game.holdTimer -= dt;
            if (game.holdTimer <= 0) {
                game.phase = 'countdown';
                game.countdown = COUNTDOWN_FROM;
                dockBall();
            }
            break;
        case 'ending':
            game.holdTimer -= dt;
            break;
        default:
            consumeLaunch();
            break;
    }
}

export function togglePause() {
    if (!['playing', 'countdown', 'lifeLost'].includes(game.phase)) return;
    game.paused = !game.paused;
}

export function replayLevel() {
    return startLevel(game.level?.id || game.menuLevelId);
}
