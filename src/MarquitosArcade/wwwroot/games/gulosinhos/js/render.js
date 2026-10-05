// O desenho de cada fotograma: céu, colinas, percurso, bicho, HUD e botões.
//
// O mundo desenha-se em píxeis a partir da câmara (camera.js): o canto (0, 0)
// do percurso fica em (ox, oy) no ecrã, e um tile mede `game.tile` píxeis.
// O HUD vai por cima, no canto de cima à esquerda, num vidro imitado à mão
// (`glassPanel`) — no canvas não há `backdrop-filter`, como no Pixel Racing.

import { FONT_DISPLAY, HEARTS, ROWS } from './config.js';
import { animalById, drawAnimal } from './animals.js';
import { fmtClock } from './format.js';
import { input, buttonRects } from './input.js';
import { PLANT_HEIGHT, plantExtension } from './level.js';
import { session, game } from './state.js';
import {
    drawBomb, drawCandy, drawCheckpoint, drawDecor, drawGoal, drawGuard, drawMover, drawPlant, drawSparkle,
    drawSpring, roundRect
} from './sprites.js';
import { THEMES } from './themes.js';
import { drawTiles } from './tiles.js';

let view = null;

export function initRenderer(viewport) {
    view = viewport;
}


/** O nível que está no ecrã: o que se joga, ou o apontado no menu. */
function sceneLevel() {
    return game.level || game.menuWorld?.level || null;
}

export function render() {
    const { ctx, width: W, height: H } = view;
    ctx.clearRect(0, 0, W, H);

    const world = game.world || game.menuWorld;
    const level = sceneLevel();
    if (!world || !level) return;
    const theme = THEMES[level.theme];
    const T = game.tile;
    const bottom = H - game.controlsBand;

    const shake = game.shake > 0 ? game.shake * T * 0.4 : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    const ox = Math.round(-game.camera.x * T + sx);
    const oy = Math.round(-game.camera.y * T + sy);
    const clock = game.globalClock;

    drawBackground(ctx, theme, W, bottom, ox, oy, T, clock);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, bottom);
    ctx.clip();

    const left = -ox / T - 2;
    const right = (W - ox) / T + 2;
    const visible = (x) => x > left && x < right;
    const px = (x) => ox + x * T;
    const py = (y) => oy + y * T;

    for (const d of world.decor) {
        if (visible(d.x)) drawDecor(ctx, theme.decor[d.kind], px(d.x), py(d.y), T, d.size, theme, clock);
    }
    if (visible(world.goal.x)) drawGoal(ctx, px(world.goal.x), py(world.goal.y), T, clock);
    for (const cp of world.checkpoints) {
        if (visible(cp.x)) drawCheckpoint(ctx, cp, px(cp.x), py(cp.y), T, clock, level.accent);
    }

    drawTiles(ctx, world, theme, level.theme, T, ox, oy, view, bottom);

    const levelClock = game.world ? game.levelClock : clock;
    for (const plant of world.plants) {
        if (visible(plant.x)) drawPlant(ctx, px(plant.x), py(plant.y), T, plantExtension(plant, levelClock), PLANT_HEIGHT, clock);
    }
    for (const spring of world.springs) {
        if (visible(spring.x)) drawSpring(ctx, spring, px(spring.x), py(spring.y), T);
    }
    for (const m of world.movers) {
        if (visible(m.x) || visible(m.x + m.w)) drawMover(ctx, m, px(m.x), py(m.y), m.w * T, T, theme);
    }
    for (const bomb of world.bombs) {
        if (visible(bomb.x)) drawBomb(ctx, bomb, px(bomb.x), py(bomb.y), T, clock);
    }
    for (const candy of world.candies) {
        if (!candy.taken && visible(candy.x)) drawCandy(ctx, candy, px(candy.x), py(candy.y), T, clock);
    }
    const player = game.player;
    for (const g of world.guards) {
        if (!visible(g.x)) continue;
        const facing = g.type === 'bee' ? (player && player.x + player.w / 2 < g.x ? -1 : 1) : g.dir;
        drawGuard(ctx, g, px(g.x), py(g.y), T, clock, facing);
    }

    drawPlayer(ctx, px, py, T, clock);
    drawParticles(ctx, px, py, T);

    if (theme.snow) drawSnow(ctx, W, bottom, clock);
    if (theme.night) drawCaveShade(ctx, W, bottom);
    ctx.restore();

    if (game.phase === 'menu') return;
    drawHud(ctx, W);
    drawTouchControls(ctx, W, H);
    drawCenterText(ctx, W, bottom, T);
    if (game.phase === 'falling') {
        ctx.fillStyle = `rgba(20, 10, 30, ${0.5 * (1 - game.holdTimer / 0.8)})`;
        ctx.fillRect(0, 0, W, H);
    }
}

// ---------- O fundo ----------

function drawBackground(ctx, theme, W, H, ox, oy, T, clock) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (theme.sun) {
        const sx = W * 0.82;
        const sy = Math.min(H * 0.2, oy + 3 * T);
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * 3);
        glow.addColorStop(0, 'rgba(255, 250, 210, 0.9)');
        glow.addColorStop(1, 'rgba(255, 250, 210, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - T * 3, sy - T * 3, T * 6, T * 6);
        ctx.fillStyle = theme.sun;
        ctx.beginPath();
        ctx.arc(sx, sy, T * 0.9, 0, Math.PI * 2);
        ctx.fill();
    }

    if (theme.night) {
        // Pontinhos a cintilar no teto da gruta.
        for (let i = 0; i < 40; i++) {
            const x = ((i * 137.5 + ox * 0.1) % (W + 40) + W + 40) % (W + 40) - 20;
            const y = ((i * 71) % 100) / 100 * H * 0.6;
            ctx.fillStyle = `rgba(255, 240, 200, ${0.25 + 0.35 * Math.abs(Math.sin(clock * 1.5 + i))})`;
            ctx.fillRect(x, y, 2, 2);
        }
    } else if (theme.clouds) {
        ctx.fillStyle = theme.clouds;
        for (let i = 0; i < 6; i++) {
            const span = W + T * 8;
            const x = (((i * 211 + ox * 0.15 + clock * 6) % span) + span) % span - T * 4;
            const y = oy * 0.3 + T * (1.2 + (i % 3) * 1.4) + Math.max(0, (H - ROWS * T) * 0.4);
            cloud(ctx, x, y, T * (0.8 + (i % 2) * 0.4));
        }
    }

    hills(ctx, W, H, ox * 0.25, oy + 11.2 * T, T * 1.6, T, theme.far, 0.008);
    hills(ctx, W, H, ox * 0.5, oy + 12.2 * T, T * 1.1, T, theme.near, 0.014);
}

function cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
    ctx.arc(x + s * 0.6, y - s * 0.25, s * 0.7, 0, Math.PI * 2);
    ctx.arc(x + s * 1.3, y, s * 0.55, 0, Math.PI * 2);
    ctx.rect(x, y, s * 1.3, s * 0.55);
    ctx.fill();
}

function hills(ctx, W, H, offset, baseY, amp, T, color, freq) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) {
        const u = (x - offset) / T;
        const y = baseY - amp * (0.6 + 0.4 * Math.sin(u * freq * 40) + 0.25 * Math.sin(u * freq * 97 + 1.3));
        ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 8, H);
    ctx.closePath();
    ctx.fill();
}

function drawSnow(ctx, W, H, clock) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 46; i++) {
        const speed = 18 + (i % 5) * 9;
        const x = ((i * 89.3 + Math.sin(clock * 0.8 + i) * 20) % W + W) % W;
        const y = ((i * 53.7 + clock * speed) % (H + 10)) - 5;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + (i % 3) * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCaveShade(ctx, W, H) {
    const shade = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.8);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(10, 5, 20, 0.45)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
}

// ---------- O bicho ----------

function drawPlayer(ctx, px, py, T, clock) {
    const animal = animalById(session.animalId);
    const blink = (clock % 3.4) < 0.12;
    const p = game.player;
    if (!p) {
        // No menu, o bicho espera na partida do nível apontado.
        const spawn = game.menuWorld?.spawn;
        if (!spawn) return;
        const hop = Math.max(0, Math.sin(clock * 3)) * 0.18;
        drawAnimal(ctx, animal, px(spawn.x), py(spawn.y - hop), T, { blink, happy: true, air: hop > 0.02, vy: Math.cos(clock * 3) * -5 });
        return;
    }
    if (game.phase === 'falling') return;
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) ctx.globalAlpha = 0.35;
    drawAnimal(ctx, animal, px(p.x + p.w / 2), py(p.y + p.h), T, {
        facing: p.facing,
        run: p.run,
        speed: Math.min(1, Math.abs(p.vx) / 6),
        vy: p.vy,
        air: !p.onGround,
        squash: p.squash,
        blink,
        hurt: p.hurtT > 0,
        happy: p.happy
    });
    ctx.globalAlpha = 1;
}

function drawParticles(ctx, px, py, T) {
    for (const p of game.particles) {
        const k = 1 - p.age / p.life;
        const x = px(p.x);
        const y = py(p.y);
        ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
        ctx.fillStyle = p.color;
        switch (p.kind) {
            case 'star':
                drawSparkle(ctx, x, y, p.size * T * (0.6 + k * 0.6));
                break;
            case 'chunk':
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size * T / 2, -p.size * T / 2, p.size * T, p.size * T);
                ctx.restore();
                break;
            case 'puff':
                ctx.beginPath();
                ctx.arc(x, y, p.size * T * (1.5 - k * 0.5), 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'ring':
                ctx.strokeStyle = p.color;
                ctx.lineWidth = T * 0.18 * k;
                ctx.beginPath();
                ctx.arc(x, y, p.size * T * (0.4 + (1 - k) * 0.7), 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'text':
                ctx.font = `700 ${Math.round(p.size * T)}px ${FONT_DISPLAY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = Math.max(2, T * 0.08);
                ctx.strokeStyle = 'rgba(59, 36, 51, 0.8)';
                ctx.strokeText(p.text, x, y);
                ctx.fillText(p.text, x, y);
                break;
            default:
                ctx.beginPath();
                ctx.arc(x, y, p.size * T, 0, Math.PI * 2);
                ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

// ---------- HUD ----------

/** Vidro imitado: fundo translúcido, contorno de 1px e um risco de luz no topo. */
function glassPanel(ctx, x, y, w, h, r) {
    ctx.fillStyle = 'rgba(32, 18, 48, 0.5)';
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1.5);
    ctx.lineTo(x + w - r, y + 1.5);
    ctx.stroke();
}

function heart(ctx, x, y, s, full) {
    ctx.fillStyle = full ? '#ff4d6d' : 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.3, y - s * 0.55, x, y - s * 0.22);
    ctx.bezierCurveTo(x + s * 0.3, y - s * 0.55, x + s * 0.6, y - s * 0.1, x, y + s * 0.35);
    ctx.fill();
}

function drawHud(ctx, W) {
    const world = game.world;
    if (!world) return;
    const safe = view.safeArea;
    const narrow = W < 420;
    const x = Math.max(12, safe.left + 8);
    const y = Math.max(view.topInset, safe.top + 8);
    const h = narrow ? 44 : 50;
    const font = narrow ? 17 : 20;
    const w = Math.min(W - x * 2, narrow ? 300 : 340);

    glassPanel(ctx, x, y, w, h + 10, 14);
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${font}px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffffff';
    const midY = y + h / 2 + 1;

    // Guloseimas.
    drawCandy(ctx, { x: 0, kind: 1, big: false }, x + 20, midY - 2, 30, 0);
    ctx.textAlign = 'left';
    ctx.fillText(`${game.candies}/${world.candies.length}`, x + 38, midY);

    // Tempo, a ficar dourado depois do tempo-alvo.
    const timeX = x + w * 0.47;
    ctx.fillStyle = game.elapsed > world.par ? '#ffd166' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${fmtClock(game.elapsed)}`, timeX, midY);

    // Corações.
    for (let i = 0; i < HEARTS; i++) heart(ctx, x + w - 18 - (HEARTS - 1 - i) * (narrow ? 22 : 26), midY, narrow ? 20 : 24, i < game.hearts);

    // O caminho até à meta, com as bandeiras.
    const barX = x + 12;
    const barW = w - 24;
    const barY = y + h + 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    roundRect(ctx, barX, barY, barW, 5, 2.5);
    ctx.fill();
    const p = game.player;
    const progress = Math.max(0, Math.min(1, (p.x - world.spawn.x) / (world.goal.x - world.spawn.x)));
    ctx.fillStyle = game.level.accent;
    roundRect(ctx, barX, barY, Math.max(5, barW * progress), 5, 2.5);
    ctx.fill();
    for (const cp of world.checkpoints) {
        const k = (cp.x - world.spawn.x) / (world.goal.x - world.spawn.x);
        ctx.fillStyle = cp.reached ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(barX + barW * k - 1, barY - 2, 2, 9);
    }
}

function drawCenterText(ctx, W, H, T) {
    let text = null;
    let sub = null;
    if (game.phase === 'countdown') text = game.countdownValue > 0 ? String(game.countdownValue) : 'Vai!';
    if (game.phase === 'ending') {
        text = game.result?.cleared ? 'Chegaste!' : 'Oh, não!';
        if (game.result?.cleared && game.result.candies >= game.result.totalCandies) sub = 'Todas as guloseimas!';
    }
    if (game.phase === 'countdown' && game.countdownValue === 3 && game.countdownTimer < 0.7) sub = game.level.name;
    if (!text) return;
    const size = Math.min(110, Math.max(46, T * 2.2));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${size}px ${FONT_DISPLAY}`;
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = 'rgba(59, 36, 51, 0.85)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, W / 2, H * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, W / 2, H * 0.42);
    if (sub) {
        ctx.font = `700 ${size * 0.38}px ${FONT_DISPLAY}`;
        ctx.lineWidth = size * 0.06;
        ctx.strokeText(sub, W / 2, H * 0.42 + size * 0.75);
        ctx.fillStyle = '#ffe066';
        ctx.fillText(sub, W / 2, H * 0.42 + size * 0.75);
    }
}

// ---------- Botões táteis ----------

export function drawTouchControls(ctx, W, H) {
    if (!game.touchMode || !['countdown', 'playing', 'falling'].includes(game.phase)) return;
    if (game.controlsBand) {
        const top = H - game.controlsBand;
        const band = ctx.createLinearGradient(0, top, 0, H);
        band.addColorStop(0, 'rgba(32, 18, 48, 0.82)');
        band.addColorStop(1, 'rgba(20, 10, 30, 0.95)');
        ctx.fillStyle = band;
        ctx.fillRect(0, top, W, game.controlsBand);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(0, top, W, 1);
    }
    const rects = buttonRects();
    button(ctx, rects.left, input.left, 'left');
    button(ctx, rects.right, input.right, 'right');
    button(ctx, rects.jump, input.jump, 'jump');
}

function button(ctx, r, pressed, kind) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rad = r.w / 2;
    ctx.fillStyle = pressed ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    const a = rad * 0.38;
    ctx.beginPath();
    if (kind === 'left') {
        ctx.moveTo(cx - a, cy);
        ctx.lineTo(cx + a * 0.6, cy - a);
        ctx.lineTo(cx + a * 0.6, cy + a);
    } else if (kind === 'right') {
        ctx.moveTo(cx + a, cy);
        ctx.lineTo(cx - a * 0.6, cy - a);
        ctx.lineTo(cx - a * 0.6, cy + a);
    } else {
        ctx.moveTo(cx, cy - a * 1.1);
        ctx.lineTo(cx - a, cy + a * 0.5);
        ctx.lineTo(cx + a, cy + a * 0.5);
    }
    ctx.closePath();
    ctx.fill();
}
