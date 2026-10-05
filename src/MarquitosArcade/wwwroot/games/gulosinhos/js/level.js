// O nível: montar, correr, saltar, apanhar, levar pancada, chegar ao fim.
//
// Este módulo é o que sabe as regras — e as dos desafios todos, que são
// poucas linhas cada: um guardião em cima é uma pancada (a não ser que se lhe
// caia em cima), uma planta de boca aberta é uma pancada, uma bomba rebenta
// passado um bocado de alguém se chegar perto e leva consigo os caixotes que
// tocar. Quem manda os fotogramas andar é o `main.js`, que troca de fase
// conforme o que aqui fica escrito em `game.phase`.
//
// A física corre em passos pequenos (`SUBSTEP`), vários por fotograma: a mola
// atira a 26 tiles por segundo, e um passo de um fotograma inteiro
// atravessava um tile.

import {
    AIR_ACCEL, BIG_CANDY_POINTS, BOMB_FUSE, BOMB_RADIUS, BOMB_TRIGGER, CANDY_POINTS, CLEAR_PAUSE,
    COUNTDOWN_FROM, COYOTE_TIME, CRUMBLE_DELAY, CRUMBLE_RESPAWN, FAIL_PAUSE, FALL_PAUSE, GRAVITY,
    GROUND_ACCEL, GROUND_FRICTION, HEART_POINTS, HEARTS, INVULNERABLE_SECONDS, JUMP_BUFFER, JUMP_CUT,
    JUMP_SPEED, LEVEL_POINTS, MAX_FALL, PLANT_FALL, PLANT_HIDDEN, PLANT_RISE, PLANT_UP, PLAYER_H, PLAYER_W,
    ROWS, RUN_SPEED, SPRING_SPEED, STOMP_BOUNCE, STOMP_BOUNCE_HELD, STOMP_POINTS, TIME_POINTS
} from './config.js';
import { sfx } from './audio.js';
import { layoutView, snapCamera, updateCamera } from './camera.js';
import { burst, dust, popText, ring } from './effects.js';
import { input } from './input.js';
import { levelById, starsFor } from './levels.js';
import { moveBody, overlaps, touchesSpikes } from './physics.js';
import { recordClear, totalScore } from './progress.js';
import { scores } from './scores.js';
import { game, resetGame, session } from './state.js';
import { T, buildWorld, setTile, tileAt } from './world.js';

/** O passo da física, em segundos. */
const SUBSTEP = 1 / 240;

/** O tamanho dos guardiões, em tiles. */
const GUARD_SIZE = {
    jelly: { w: 0.9, h: 0.78 },
    hedgehog: { w: 1, h: 0.72 },
    bee: { w: 0.78, h: 0.7 }
};

const PLANT_CYCLE = PLANT_HIDDEN + PLANT_RISE + PLANT_UP + PLANT_FALL;
/** Altura da planta de pescoço todo esticado, em tiles. */
export const PLANT_HEIGHT = 2.05;

// ---------- Montar ----------

/**
 * O percurso de um nível, pronto a jogar: o do gerador, mais o estado de cada
 * entidade. Monta-se de novo a cada tentativa — o gerador é determinístico, e
 * assim nenhum caixote rebentado nem guardião pisado passa para a seguinte.
 */
export function prepareWorld(level) {
    const world = buildWorld(level);
    for (const candy of world.candies) candy.taken = false;
    for (const g of world.guards) {
        Object.assign(g, GUARD_SIZE[g.type]);
        g.alive = true;
        g.dead = 0;
    }
    for (const bomb of world.bombs) {
        bomb.state = 'idle';
        bomb.timer = 0;
        bomb.boomT = 0;
        bomb.lastTick = 0;
    }
    for (const spring of world.springs) spring.squash = 0;
    for (const m of world.movers) {
        m.phase = 0;
        m.dx = 0;
        m.dy = 0;
    }
    for (const cp of world.checkpoints) cp.reached = false;
    return world;
}

export function createPlayer(spawn) {
    return {
        x: spawn.x - PLAYER_W / 2,
        y: spawn.y - PLAYER_H,
        w: PLAYER_W,
        h: PLAYER_H,
        vx: 0,
        vy: 0,
        onGround: true,
        ride: null,
        groundTile: null,
        hitWall: 0,
        prevBottom: spawn.y,
        facing: 1,
        coyote: 0,
        jumpBuffer: 0,
        canCut: false,
        invuln: 0,
        hurtT: 0,
        run: 0,
        squash: 0,
        happy: false
    };
}

/** Monta o nível e põe a contagem decrescente a andar. */
export function startLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return false;

    resetGame();
    session.levelId = level.id;
    game.level = level;
    game.world = prepareWorld(level);
    game.player = createPlayer(game.world.spawn);
    game.hearts = HEARTS;

    layoutView();
    snapCamera(game.world, game.world.spawn.x, game.world.spawn.y, 1);

    game.phase = 'countdown';
    game.countdownValue = COUNTDOWN_FROM;
    game.countdownTimer = 0;
    return true;
}

/** Um passo da contagem decrescente. */
export function stepCountdown(dt) {
    game.countdownTimer += dt;
    if (game.countdownTimer < (game.countdownValue > 0 ? 0.7 : 0.45)) return;
    game.countdownTimer = 0;
    if (game.countdownValue > 0) {
        game.countdownValue--;
        if (game.countdownValue > 0) sfx.count();
        else sfx.go();
        return;
    }
    game.phase = 'playing';
    // O que se carregou durante a contagem não conta como salto.
    input.jumpPressed = false;
}

// ---------- Correr ----------

export function updateLevel(dt) {
    game.elapsed += dt;
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps && game.phase === 'playing'; i++) step(h);

    const p = game.player;
    updateCamera(game.world, p.x + p.w / 2, p.y + p.h, p.facing, dt);
}

/** O tempo a passar com o bicho fora de jogo (a cair, ou no fim): o mundo continua a andar. */
export function updateIdleWorld(dt) {
    game.levelClock += dt;
    updateMovers(dt);
    updateBombs(dt);
    updateCrumbles(dt);
    for (const g of game.world.guards) updateGuard(g, dt);
}

function step(dt) {
    const world = game.world;
    const p = game.player;
    game.levelClock += dt;

    updateMovers(dt);
    if (p.ride) {
        p.x += p.ride.dx;
        p.y += p.ride.dy;
    }
    updatePlayer(p, dt);
    updateCrumbles(dt);
    for (const g of world.guards) updateGuard(g, dt);
    updateBombs(dt);

    checkSprings(p);
    collectCandies(p);
    checkGuards(p);
    checkPlants(p);
    if (touchesSpikes(p, world)) hurt(p.x + p.w / 2 - p.facing * 0.5);
    checkCheckpoints(p);
    if (game.phase !== 'playing') return;

    if (p.x + p.w / 2 >= world.goal.x - 0.3) {
        finishLevel(true);
        return;
    }
    if (p.y > ROWS + 1.5) fallIntoPit();
}

/** Aproxima `value` de `target` sem passar, a `rate` por segundo. */
function approach(value, target, rate) {
    return value < target ? Math.min(target, value + rate) : Math.max(target, value - rate);
}

function updatePlayer(p, dt) {
    // Logo a seguir a uma pancada o empurrão manda: senão bastava carregar
    // para a frente para cair outra vez em cima de quem bateu.
    const dir = p.hurtT > 0 ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) {
        // Virar é mais rápido do que arrancar: mudar de ideias a meio de um
        // salto tem de se sentir na mão.
        const turning = Math.sign(p.vx) === -dir;
        const accel = (p.onGround ? GROUND_ACCEL : AIR_ACCEL) * (turning ? 1.7 : 1);
        p.vx = approach(p.vx, dir * RUN_SPEED, accel * dt);
        p.facing = dir;
    } else {
        p.vx = approach(p.vx, 0, (p.onGround ? GROUND_FRICTION : AIR_ACCEL * (p.hurtT > 0 ? 0.1 : 0.35)) * dt);
    }

    p.coyote = p.onGround ? COYOTE_TIME : p.coyote - dt;
    if (input.jumpPressed) {
        p.jumpBuffer = JUMP_BUFFER;
        input.jumpPressed = false;
    } else {
        p.jumpBuffer -= dt;
    }
    if (p.jumpBuffer > 0 && p.coyote > 0) {
        p.vy = -JUMP_SPEED;
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.canCut = true;
        p.onGround = false;
        p.ride = null;
        p.squash = -0.22;
        sfx.jump();
        dust(p.x + p.w / 2, p.y + p.h, 4);
    }
    // Largar o botão a subir encurta o salto.
    if (p.canCut && !input.jump && p.vy < 0) {
        p.vy *= JUMP_CUT;
        p.canCut = false;
    }
    if (p.vy >= 0) p.canCut = false;

    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
    const wasGround = p.onGround;
    const falling = p.vy;
    p.prevBottom = p.y + p.h;
    moveBody(p, game.world, dt, game.world.movers);

    if (!wasGround && p.onGround && falling > 7) {
        p.squash = 0.28 * Math.min(1, falling / MAX_FALL);
        dust(p.x + p.w / 2, p.y + p.h, 3);
    }
    if (p.onGround && p.groundTile?.t === T.CRUMBLE) touchCrumble(p.groundTile.c, p.groundTile.r);

    p.run += Math.abs(p.vx) * dt * 2.4;
    p.squash = approach(p.squash, 0, dt * 1.6);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
}

// ---------- As coisas do percurso ----------

/** Quanto tempo uma plataforma fica parada em cada ponta: dá tempo de subir e de descer. */
const MOVER_DWELL = 0.7;

/** Onde está uma plataforma ao fim de `t` segundos, de `from` (0) a `to` (1). */
export function moverProgress(m, t) {
    const travel = Math.abs(m.to - m.from) / m.speed;
    const period = 2 * (travel + MOVER_DWELL);
    const u = ((t % period) + period) % period;
    const ease = (k) => k * k * (3 - 2 * k);
    if (u < MOVER_DWELL) return 0;
    if (u < MOVER_DWELL + travel) return ease((u - MOVER_DWELL) / travel);
    if (u < 2 * MOVER_DWELL + travel) return 1;
    return 1 - ease((u - 2 * MOVER_DWELL - travel) / travel);
}

function updateMovers(dt) {
    for (const m of game.world.movers) {
        m.phase += dt;
        const at = m.from + (m.to - m.from) * moverProgress(m, m.phase);
        if (m.axis === 'x') {
            m.dx = at - m.x;
            m.dy = 0;
            m.x = at;
        } else {
            m.dx = 0;
            m.dy = at - m.y;
            m.y = at;
        }
    }
}

/** O ponto central de um guardião, para os desenhos e para as distâncias. */
export function guardBox(g) {
    if (g.type === 'bee') return { x: g.x - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h };
    return { x: g.x - g.w / 2, y: g.y - g.h, w: g.w, h: g.h };
}

function updateGuard(g, dt) {
    if (!g.alive) {
        g.dead += dt;
        return;
    }
    if (g.type === 'bee') {
        g.y = g.baseY + Math.sin(game.levelClock * g.rate + g.phase) * g.amp;
        return;
    }
    g.x += g.dir * g.speed * dt;
    if (g.x > g.maxX) { g.x = g.maxX; g.dir = -1; }
    if (g.x < g.minX) { g.x = g.minX; g.dir = 1; }
}

function checkGuards(p) {
    for (const g of game.world.guards) {
        if (!g.alive) continue;
        const box = guardBox(g);
        if (!overlaps(p, box)) continue;
        // Cair-lhe em cima vindo de cima é um salto na cabeça; o ouriço pica.
        const fromAbove = p.vy > 0 && p.prevBottom <= box.y + 0.38;
        if (fromAbove && g.type !== 'hedgehog') {
            stomp(p, g);
            continue;
        }
        hurt(g.x);
    }
}

function stomp(p, g) {
    killGuard(g);
    game.stomps++;
    p.vy = -(input.jump ? STOMP_BOUNCE_HELD : STOMP_BOUNCE);
    p.canCut = false;
    sfx.stomp();
    popText(g.x, g.y - 1, `+${STOMP_POINTS}`, '#fff6a8');
}

function killGuard(g) {
    g.alive = false;
    g.dead = 0;
    const colors = { jelly: '#ff6f91', hedgehog: '#a0704a', bee: '#ffd23f' };
    burst(g.x, g.y - (g.type === 'bee' ? 0 : 0.4), colors[g.type], 9, { speed: 4, life: 0.5 });
}

/** Quanto a planta está de fora, de 0 (no vaso) a 1 (pescoço todo esticado). */
export function plantExtension(plant, clock = game.levelClock) {
    const t = (clock + plant.phase) % PLANT_CYCLE;
    if (t < PLANT_HIDDEN) return 0;
    if (t < PLANT_HIDDEN + PLANT_RISE) return (t - PLANT_HIDDEN) / PLANT_RISE;
    if (t < PLANT_HIDDEN + PLANT_RISE + PLANT_UP) return 1;
    return 1 - (t - PLANT_HIDDEN - PLANT_RISE - PLANT_UP) / PLANT_FALL;
}

function checkPlants(p) {
    for (const plant of game.world.plants) {
        const ext = plantExtension(plant);
        if (ext < 0.25) continue;
        const height = PLANT_HEIGHT * ext;
        if (overlaps(p, { x: plant.x - 0.33, y: plant.y - height, w: 0.66, h: height })) hurt(plant.x);
    }
}

function checkSprings(p) {
    if (p.vy < 0) return;
    for (const spring of game.world.springs) {
        const bottom = p.y + p.h;
        if (Math.abs(p.x + p.w / 2 - spring.x) > 0.6) continue;
        if (bottom < spring.y - 0.45 || bottom > spring.y + 0.02) continue;
        p.vy = -SPRING_SPEED;
        p.canCut = false;
        p.onGround = false;
        p.ride = null;
        spring.squash = 1;
        sfx.spring();
    }
    for (const spring of game.world.springs) spring.squash = Math.max(0, spring.squash - SUBSTEP * 4);
}

function collectCandies(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2 - 0.15;
    for (const candy of game.world.candies) {
        if (candy.taken) continue;
        const reach = candy.big ? 0.85 : 0.62;
        if (Math.abs(candy.x - cx) > reach || Math.abs(candy.y - cy) > reach + 0.15) continue;
        candy.taken = true;
        game.candies++;
        if (candy.big) {
            game.bigCandies++;
            sfx.bigCandy();
            burst(candy.x, candy.y, '#ffe066', 14, { speed: 5, life: 0.7, kind: 'star', size: 0.16, gravity: 4 });
            popText(candy.x, candy.y - 0.6, `+${BIG_CANDY_POINTS}`, '#ffe066');
        } else {
            sfx.candy();
            burst(candy.x, candy.y, '#ffffff', 6, { speed: 3, life: 0.35, kind: 'star', size: 0.1, gravity: 0 });
        }
    }
}

function checkCheckpoints(p) {
    for (const cp of game.world.checkpoints) {
        if (cp.reached || p.x + p.w / 2 < cp.x - 0.2) continue;
        cp.reached = true;
        game.checkpoint = cp;
        sfx.checkpoint();
        burst(cp.x + 0.3, cp.y - 2, game.level.accent, 12, { speed: 4, life: 0.6, kind: 'star', gravity: 3 });
    }
}

// ---------- Bolachas ----------

function touchCrumble(c, r) {
    if (game.crumbles.some((item) => item.c === c && item.r === r)) return;
    game.crumbles.push({ c, r, t: 0, fallen: false });
}

function updateCrumbles(dt) {
    const p = game.player;
    for (let i = game.crumbles.length - 1; i >= 0; i--) {
        const item = game.crumbles[i];
        item.t += dt;
        if (!item.fallen && item.t >= CRUMBLE_DELAY) {
            item.fallen = true;
            item.t = 0;
            setTile(game.world, item.c, item.r, T.EMPTY);
            burst(item.c + 0.5, item.r + 0.3, '#c98a4b', 5, { speed: 2, life: 0.5, kind: 'chunk', gravity: 18 });
        } else if (item.fallen && item.t >= CRUMBLE_RESPAWN) {
            // Não volta enquanto o bicho estiver no sítio dela.
            if (p && overlaps(p, { x: item.c, y: item.r, w: 1, h: 1 })) continue;
            setTile(game.world, item.c, item.r, T.CRUMBLE);
            game.crumbles.splice(i, 1);
        }
    }
}

/** Quanto tempo falta para uma bolacha cair (0 a 1), para o desenho a fazer tremer. */
export function crumbleShake(c, r) {
    const item = game.crumbles.find((it) => it.c === c && it.r === r);
    return item && !item.fallen ? item.t / CRUMBLE_DELAY : 0;
}

// ---------- Bombas ----------

function updateBombs(dt) {
    const p = game.player;
    for (const bomb of game.world.bombs) {
        if (bomb.state === 'idle') {
            if (p && game.phase === 'playing' && Math.hypot(p.x + p.w / 2 - bomb.x, p.y + p.h / 2 - (bomb.y - 0.4)) < BOMB_TRIGGER) {
                arm(bomb, BOMB_FUSE);
            }
        } else if (bomb.state === 'armed') {
            bomb.timer -= dt;
            const second = Math.ceil(bomb.timer);
            if (second !== bomb.lastTick && second > 0) {
                bomb.lastTick = second;
                sfx.tick(second === 1);
            }
            if (bomb.timer <= 0) explode(bomb);
        } else if (bomb.state === 'boom') {
            bomb.boomT += dt;
            if (bomb.boomT > 0.6) bomb.state = 'gone';
        }
    }
}

function arm(bomb, fuse) {
    bomb.state = 'armed';
    bomb.timer = fuse;
    bomb.lastTick = Math.ceil(fuse);
    sfx.tick(false);
}

function explode(bomb) {
    bomb.state = 'boom';
    bomb.boomT = 0;
    const cx = bomb.x;
    const cy = bomb.y - 0.4;
    sfx.boom();
    game.shake = 0.35;
    ring(cx, cy, BOMB_RADIUS, '#ffb347');
    burst(cx, cy, '#ff8a3d', 16, { speed: 7, life: 0.55, size: 0.2, gravity: 6 });
    burst(cx, cy, '#ffe066', 10, { speed: 5, life: 0.45, size: 0.14, gravity: 2 });

    const p = game.player;
    if (p && game.phase === 'playing' && Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy) < BOMB_RADIUS) hurt(cx, 12);

    for (const g of game.world.guards) {
        if (g.alive && Math.hypot(g.x - cx, g.y - 0.4 - cy) < BOMB_RADIUS + 0.4) killGuard(g);
    }
    // Uma bomba ao pé de outra fá-la contar quase a zero.
    for (const other of game.world.bombs) {
        if (other !== bomb && other.state === 'idle' && Math.hypot(other.x - bomb.x, other.y - bomb.y) < BOMB_RADIUS + 0.6) arm(other, 0.3);
    }
    breakCrates(cx, cy);
}

/**
 * Os caixotes que a explosão toca vão pelos ares — e, com eles, todos os que
 * lhes estiverem encostados. Assim uma parede de caixotes nunca fica meio de
 * pé: a bomba que a toca leva-a toda, e o percurso nunca fica trancado.
 */
function breakCrates(cx, cy) {
    const world = game.world;
    const queue = [];
    const reach = Math.ceil(BOMB_RADIUS) + 1;
    for (let r = Math.floor(cy) - reach; r <= Math.floor(cy) + reach; r++) {
        for (let c = Math.floor(cx) - reach; c <= Math.floor(cx) + reach; c++) {
            if (tileAt(world, c, r) === T.CRATE && Math.hypot(c + 0.5 - cx, r + 0.5 - cy) < BOMB_RADIUS + 0.35) queue.push([c, r]);
        }
    }
    while (queue.length) {
        const [c, r] = queue.pop();
        if (tileAt(world, c, r) !== T.CRATE) continue;
        setTile(world, c, r, T.EMPTY);
        burst(c + 0.5, r + 0.5, '#c8873e', 4, { speed: 5, life: 0.7, kind: 'chunk', size: 0.16, gravity: 22 });
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (tileAt(world, c + dc, r + dr) === T.CRATE) queue.push([c + dc, r + dr]);
        }
    }
}

// ---------- Pancadas, quedas e o fim ----------

/** Uma pancada: menos um coração, um empurrão para trás e uns instantes a piscar. */
function hurt(fromX, lift = 9.5) {
    const p = game.player;
    if (!p || p.invuln > 0 || game.phase !== 'playing') return;
    game.hearts--;
    game.heartsLost++;
    p.invuln = INVULNERABLE_SECONDS;
    p.hurtT = 0.45;
    p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 6;
    p.vy = -lift;
    p.canCut = false;
    p.onGround = false;
    p.ride = null;
    sfx.hurt();
    if (game.hearts <= 0) finishLevel(false, 'coracoes');
}

function fallIntoPit() {
    game.hearts--;
    game.heartsLost++;
    sfx.fall();
    if (game.hearts <= 0) {
        finishLevel(false, 'coracoes');
        return;
    }
    game.phase = 'falling';
    game.holdTimer = FALL_PAUSE;
}

/** Fim da queda: o bicho volta à última bandeira (ou à partida), a piscar. */
export function respawn() {
    const p = game.player;
    const at = game.checkpoint || game.world.spawn;
    p.x = at.x - p.w / 2;
    p.y = at.y - p.h;
    p.vx = 0;
    p.vy = 0;
    p.onGround = true;
    p.ride = null;
    p.facing = 1;
    p.invuln = INVULNERABLE_SECONDS;
    input.jumpPressed = false;
    game.phase = 'playing';
    snapCamera(game.world, at.x, at.y, 1);
}

/**
 * Acaba a tentativa. O progresso e a pontuação ficam registados aqui e não no
 * ecrã de resultados (a mesma regra do Maze Run): o nível acabou neste
 * instante, e um ecrã que não chegue a montar-se não pode ser a razão de se
 * perder o que se fez.
 */
function finishLevel(cleared, reason = null) {
    const level = game.level;
    const world = game.world;
    const seconds = game.elapsed;
    const result = {
        cleared,
        reason,
        levelId: level.id,
        seconds,
        ms: Math.round(seconds * 1000),
        par: world.par,
        candies: game.candies,
        totalCandies: world.candies.length,
        bigCandies: game.bigCandies,
        stomps: game.stomps,
        heartsLeft: Math.max(0, game.hearts),
        heartsLost: game.heartsLost,
        stars: 0,
        score: 0,
        improved: false,
        unlockedLevel: null
    };

    if (cleared) {
        result.stars = starsFor(result);
        result.score = scoreFor(level, result);
        const recorded = recordClear(level.id, result);
        result.improved = recorded.improved;
        result.unlockedLevel = recorded.unlockedLevel;
        // Ao quadro vai o total do jogador — a soma da melhor marca de cada nível.
        scores.submitQuietly(session.playerBoardName, totalScore());
        game.player.happy = true;
        sfx.clear();
        burst(world.goal.x, world.goal.y - 2, '#ffe066', 24, { speed: 7, life: 1, kind: 'star', gravity: 5 });
    } else {
        sfx.fail();
    }

    game.result = result;
    game.phase = 'ending';
    game.holdTimer = cleared ? CLEAR_PAUSE : FAIL_PAUSE;
}

/**
 * Os pontos de um nível concluído: as guloseimas (as grandes valem mais), os
 * guardiões pisados, os corações por gastar, os segundos abaixo do tempo-alvo
 * e um prémio que cresce com o número do nível.
 */
function scoreFor(level, result) {
    const small = result.candies - result.bigCandies;
    return small * CANDY_POINTS
        + result.bigCandies * BIG_CANDY_POINTS
        + result.stomps * STOMP_POINTS
        + result.heartsLeft * HEART_POINTS
        + Math.max(0, Math.floor(result.par - result.seconds)) * TIME_POINTS
        + level.id * LEVEL_POINTS;
}

export function togglePause() {
    if (game.phase !== 'playing' && game.phase !== 'countdown' && game.phase !== 'falling') return;
    game.paused = !game.paused;
}

/** Sair a meio: o nível é abandonado e volta-se ao menu, sem resultado nenhum. */
export function abortLevel() {
    resetGame();
}
