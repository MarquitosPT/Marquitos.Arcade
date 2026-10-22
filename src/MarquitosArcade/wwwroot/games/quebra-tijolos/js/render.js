// O desenho de cada frame, e as miniaturas dos cartões dos níveis.
//
// Duas camadas:
//
// - O cenário (`stage`): o céu do mundo, as paredes, o chão do campo com a
//   grelha e o vidro do marcador. Não muda a jogar, por isso é desenhado uma
//   vez num canvas à parte e carimbado a cada frame — só volta a ser feito
//   quando muda o tamanho do ecrã ou o mundo.
// - O que mexe: tijolos, cápsulas, raquete, bolas, laser, estilhaços, os
//   números do marcador e as mensagens.
//
// Tudo o que é do campo é desenhado em unidades do campo, depois de
// `applyFieldTransform` (js/field.js). A grelha do chão tem as colunas dos
// tijolos: um tijolo fora do sítio via-se logo.

import { BRICK_H, BRICK_W, BRICKS_TOP, FIELD_H, FIELD_W, FONT_BODY, FONT_DISPLAY, HUD_H, MAX_LIVES, PADDLE_Y, WALL } from './config.js';
import { brickSpec } from './bricks.js';
import { brickSprite, drawBall, drawBrick, drawCapsule, drawPaddle } from './draw.js';
import { applyFieldTransform } from './field.js';
import { fmtClock, fmtPoints } from './format.js';
import { CAPSULES } from './powerups.js';
import { game } from './state.js';

let stage = null;
let stageKey = '';

// ---------- Cenário ----------

/** Estrelas do fundo, sempre nos mesmos sítios (frações do ecrã). */
const STARS = Array.from({ length: 90 }, (_, i) => {
    const r = (n) => {
        const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
        return x - Math.floor(x);
    };
    return { x: r(1), y: r(2), size: 0.4 + r(3) * 1.3, alpha: 0.15 + r(4) * 0.5 };
});

function paintBackdrop(ctx, width, height, world) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, world.sky[0]);
    sky.addColorStop(1, world.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    for (const [fx, fy, color, size] of [[0.15, 0.2, world.accent, 0.55], [0.85, 0.75, world.accent2, 0.6]]) {
        const glow = ctx.createRadialGradient(width * fx, height * fy, 0, width * fx, height * fy, Math.max(width, height) * size);
        glow.addColorStop(0, `${color}33`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
    }

    for (const star of STARS) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(star.x * width, star.y * height, star.size, star.size);
    }
    ctx.globalAlpha = 1;
}

function wallGradient(ctx, x0, y0, x1, y1, world) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, world.wall[1]);
    g.addColorStop(0.35, world.wall[0]);
    g.addColorStop(0.65, world.wall[0]);
    g.addColorStop(1, world.wall[1]);
    return g;
}

/** As paredes: tubos de metal com juntas, e um risco de néon do lado de dentro. */
function paintWalls(ctx, world) {
    const top = -WALL;
    const height = FIELD_H + WALL;

    ctx.fillStyle = wallGradient(ctx, -WALL, 0, 0, 0, world);
    ctx.fillRect(-WALL, top, WALL, height);
    ctx.fillStyle = wallGradient(ctx, FIELD_W, 0, FIELD_W + WALL, 0, world);
    ctx.fillRect(FIELD_W, top, WALL, height);
    ctx.fillStyle = wallGradient(ctx, 0, -WALL, 0, 0, world);
    ctx.fillRect(-WALL, -WALL, FIELD_W + WALL * 2, WALL);

    // Juntas dos tubos.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let y = 40; y < FIELD_H; y += 64) {
        ctx.fillRect(-WALL, y, WALL, 3);
        ctx.fillRect(FIELD_W, y, WALL, 3);
    }
    for (let x = 48; x < FIELD_W; x += 80) ctx.fillRect(x, -WALL, 3, WALL);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let y = 40; y < FIELD_H; y += 64) {
        ctx.fillRect(-WALL, y + 3, WALL, 1);
        ctx.fillRect(FIELD_W, y + 3, WALL, 1);
    }
    for (let x = 48; x < FIELD_W; x += 80) ctx.fillRect(x + 3, -WALL, 1, WALL);

    // O néon de dentro: um risco largo e esbatido, e um fino por cima.
    ctx.lineJoin = 'round';
    for (const [width, alpha] of [[5, 0.22], [1.6, 1]]) {
        ctx.strokeStyle = world.accent;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(0, FIELD_H);
        ctx.lineTo(0, 0);
        ctx.lineTo(FIELD_W, 0);
        ctx.lineTo(FIELD_W, FIELD_H);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Os cantos de cima, com uma pedra de cor.
    for (const x of [-WALL, FIELD_W]) {
        ctx.fillStyle = world.wall[1];
        ctx.fillRect(x, -WALL, WALL, WALL);
        ctx.fillStyle = world.accent2;
        ctx.beginPath();
        ctx.moveTo(x + WALL / 2, -WALL + 3);
        ctx.lineTo(x + WALL - 3, -WALL / 2);
        ctx.lineTo(x + WALL / 2, -3);
        ctx.lineTo(x + 3, -WALL / 2);
        ctx.fill();
    }

    // Os pés das paredes, onde acaba o campo.
    ctx.fillStyle = world.accent;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-WALL, FIELD_H - 2, WALL, 2);
    ctx.fillRect(FIELD_W, FIELD_H - 2, WALL, 2);
    ctx.globalAlpha = 1;
}

/** O chão do campo: mais escuro do que o céu, com a grelha das colunas dos tijolos. */
function paintFloor(ctx, world) {
    ctx.fillStyle = 'rgba(3, 5, 16, 0.62)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    ctx.strokeStyle = world.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = BRICK_W; x < FIELD_W; x += BRICK_W) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, FIELD_H);
    }
    for (let y = BRICKS_TOP; y < FIELD_H; y += BRICK_W) {
        ctx.moveTo(0, y);
        ctx.lineTo(FIELD_W, y);
    }
    ctx.stroke();

    // A zona da raquete, com um brilho a subir do fundo.
    const floor = ctx.createLinearGradient(0, FIELD_H, 0, PADDLE_Y - 60);
    floor.addColorStop(0, `${world.accent}30`);
    floor.addColorStop(1, `${world.accent}00`);
    ctx.fillStyle = floor;
    ctx.fillRect(0, PADDLE_Y - 60, FIELD_W, FIELD_H - PADDLE_Y + 60);
}

/** O vidro do marcador: a faixa por cima do teto. */
function paintHudPanel(ctx, world) {
    const y = -WALL - HUD_H;
    ctx.fillStyle = 'rgba(8, 10, 26, 0.72)';
    ctx.beginPath();
    ctx.roundRect(-WALL, y, FIELD_W + WALL * 2, HUD_H - 4, [10, 10, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-WALL + 10, y + 0.5, FIELD_W + WALL * 2 - 20, 1);
    ctx.fillStyle = world.accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(FIELD_W / 2 - 40, y + HUD_H - 6, 80, 2);
    ctx.globalAlpha = 1;
}

function stageFor(level) {
    const view = game.view;
    const { scale, ox, oy } = game.layout;
    const key = `${view.width}x${view.height}@${view.dpr}:${scale.toFixed(4)}:${ox.toFixed(1)}:${oy.toFixed(1)}:${level.world.name}`;
    if (stage && key === stageKey) return stage;
    stageKey = key;
    stage = stage || document.createElement('canvas');
    stage.width = Math.round(view.width * view.dpr);
    stage.height = Math.round(view.height * view.dpr);
    const ctx = stage.getContext('2d');
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    paintBackdrop(ctx, view.width, view.height, level.world);

    // A sombra do campo inteiro sobre o céu.
    const box = game.layout.screen;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(box.x + 4, box.y + HUD_H * scale, box.w - 8, box.h - HUD_H * scale);
    ctx.restore();

    ctx.setTransform(view.dpr * scale, 0, 0, view.dpr * scale, view.dpr * ox, view.dpr * oy);
    paintFloor(ctx, level.world);
    paintWalls(ctx, level.world);
    paintHudPanel(ctx, level.world);
    return stage;
}

// ---------- Marcador ----------

function text(ctx, value, x, y, { size = 12, weight = 600, color = '#eef2ff', align = 'left', font = FONT_DISPLAY, baseline = 'middle' } = {}) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(value, x, y);
}

function miniPaddle(ctx, x, y, color) {
    ctx.beginPath();
    ctx.roundRect(x, y, 15, 5, 2.5);
    ctx.fillStyle = '#c9d2ea';
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3.5, 5);
    ctx.fillRect(x + 11.5, y, 3.5, 5);
}

function drawHud(ctx, level) {
    const top = -WALL - HUD_H;
    const line1 = top + 11;
    const line2 = top + 24;
    const left = -WALL + 10;
    const right = FIELD_W + WALL - 10;

    text(ctx, `NÍVEL ${level.id}`, left, line1, { size: 9, weight: 700, color: 'rgba(238, 242, 255, 0.55)', font: FONT_BODY });
    text(ctx, level.name, left, line2, { size: 13, weight: 700, color: level.world.accent });

    text(ctx, fmtPoints(game.score), FIELD_W / 2, top + 16, { size: 20, weight: 700, align: 'center' });

    // Vidas: uma raquete pequenina por cada uma.
    const lives = game.phase === 'menu' ? game.lives || 3 : game.lives;
    for (let i = 0; i < Math.min(lives, MAX_LIVES); i++) miniPaddle(ctx, right - 15 - i * 19, line1 - 3, '#ff4d6a');

    const overPar = game.elapsed > level.par;
    text(ctx, `${fmtClock(game.elapsed)} / ${fmtClock(level.par)}`, right, line2, {
        size: 10.5,
        weight: 600,
        align: 'right',
        font: FONT_BODY,
        color: overPar ? 'rgba(238, 242, 255, 0.45)' : '#ffd23f'
    });
}

/** Os poderes ativos, por baixo da raquete, com o tempo que falta aos que o têm. */
function drawPowerChips(ctx) {
    const chips = [];
    const mode = game.paddle.mode;
    if (mode) {
        const type = CAPSULES.find((c) => c.id === mode);
        chips.push({ type, seconds: mode === 'laser' ? game.timers.laser : null });
    }
    if (game.timers.slow > 0) chips.push({ type: CAPSULES.find((c) => c.id === 'slow'), seconds: game.timers.slow });
    let x = 6;
    const y = FIELD_H - 20;
    for (const chip of chips) {
        const label = chip.seconds === null ? chip.type.label : `${chip.type.label} ${Math.ceil(chip.seconds)}s`;
        ctx.font = `600 9.5px ${FONT_BODY}`;
        const width = ctx.measureText(label).width + 24;
        ctx.beginPath();
        ctx.roundRect(x, y, width, 15, 7.5);
        ctx.fillStyle = 'rgba(8, 10, 26, 0.75)';
        ctx.fill();
        ctx.strokeStyle = chip.type.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 8, y + 7.5, 4, 0, Math.PI * 2);
        ctx.fillStyle = chip.type.color;
        ctx.fill();
        text(ctx, label, x + 16, y + 8, { size: 9.5, font: FONT_BODY, color: '#eef2ff' });
        x += width + 6;
    }
}

// ---------- Mensagens ----------

function message(ctx, title, subtitle, alpha = 1, y = FIELD_H * 0.6) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 12;
    text(ctx, title, FIELD_W / 2, y, { size: 30, weight: 700, align: 'center' });
    if (subtitle) text(ctx, subtitle, FIELD_W / 2, y + 28, { size: 14, weight: 600, align: 'center', color: game.level.world.accent });
    ctx.restore();
}

function drawMessages(ctx, level) {
    if (game.phase === 'playing' && game.bannerTimer > 0) {
        message(ctx, `Nível ${level.id}`, level.name, Math.min(1, game.bannerTimer * 2));
    }
    const waiting = game.phase === 'playing' && game.balls.length && game.balls.every((ball) => ball.stuck) && !game.launched;
    if (waiting) {
        const pulse = 0.55 + 0.45 * Math.sin(game.globalClock * 5);
        ctx.save();
        ctx.globalAlpha = pulse;
        text(ctx, game.touchMode ? 'Toca no ecrã para lançar' : 'Espaço ou clique para lançar', FIELD_W / 2, PADDLE_Y - 34, {
            size: 13, weight: 600, align: 'center', font: FONT_BODY
        });
        ctx.restore();
    }
    if (game.phase === 'lost') message(ctx, 'Menos uma vida', `${game.lives} ${game.lives === 1 ? 'vida' : 'vidas'} para acabar`);
    if (game.phase === 'ending') {
        if (game.result?.cleared) message(ctx, 'Nível concluído!', `${fmtPoints(game.result.score)} pontos`);
        else message(ctx, 'Sem vidas', `Faltaram ${game.result?.remaining ?? 0} tijolos`);
    }
}

// ---------- O frame ----------

export function render() {
    const view = game.view;
    const level = game.level;
    if (!view || !game.layout || !level) return;
    const ctx = view.ctx;
    const accent = level.world.accent;

    const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stageFor(level), sx * view.dpr, sy * view.dpr);

    applyFieldTransform(ctx, sx, sy);
    const pixelsPerUnit = game.layout.scale * view.dpr;

    // Tijolos: as sombras primeiro, todas, para nenhuma cair por cima de um vizinho.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (const brick of game.bricks) if (brick.alive) ctx.fillRect(brick.x + 2, brick.y + 3, brick.w - 1.5, brick.h - 1.5);
    for (const brick of game.bricks) {
        if (!brick.alive) continue;
        ctx.drawImage(brickSprite(brick, pixelsPerUnit), brick.x, brick.y, brick.w, brick.h);
        if (brick.kind === 'tnt') {
            // A TNT pisca devagar, para se ver que é perigosa.
            const glow = 0.12 + 0.12 * Math.sin(game.globalClock * 4 + brick.col);
            ctx.fillStyle = `rgba(255, 200, 80, ${glow})`;
            ctx.fillRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2);
        }
        if (brick.flash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${brick.flash * 0.7})`;
            ctx.beginPath();
            ctx.roundRect(brick.x + 0.6, brick.y + 0.6, brick.w - 1.2, brick.h - 1.2, 3);
            ctx.fill();
        }
    }

    for (const capsule of game.capsules) drawCapsule(ctx, capsule.x, capsule.y, 28, 12, capsule.type, capsule.spin);

    // Laser.
    for (const bolt of game.lasers) {
        ctx.fillStyle = 'rgba(255, 77, 106, 0.35)';
        ctx.fillRect(bolt.x - 2.5, bolt.y - 2, 5, 14);
        ctx.fillStyle = '#ffe0e6';
        ctx.fillRect(bolt.x - 1, bolt.y, 2, 10);
    }

    if (game.phase !== 'ending' || game.result?.cleared) {
        drawPaddle(ctx, game.paddle.x, PADDLE_Y, game.paddle.w, game.paddle.mode, accent, game.paddle.glow);
    }
    for (const ball of game.balls) drawBall(ctx, ball, accent);

    // Estilhaços, ondas e pontos.
    for (const p of game.particles) {
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
    }
    for (const r of game.rings) {
        const t = r.age / r.life;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * (0.3 + t * 0.9), 0, Math.PI * 2);
        ctx.stroke();
    }
    for (const f of game.floaters) {
        ctx.globalAlpha = 1 - f.age / f.life;
        text(ctx, f.text, f.x, f.y, { size: 11, weight: 700, align: 'center', color: f.color });
    }
    ctx.globalAlpha = 1;

    if (game.flash > 0) {
        ctx.fillStyle = `rgba(255, 240, 220, ${game.flash * 0.25})`;
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }

    drawPowerChips(ctx);
    drawHud(ctx, level);
    drawMessages(ctx, level);
}

// ---------- Miniaturas ----------

/**
 * A miniatura de um nível num cartão: o chão do campo e os tijolos, sem
 * paredes, à escala da caixa. Mostra a parte de cima do campo — onde estão
 * os tijolos —, centrada na altura que eles ocupam.
 */
export function paintLevelShot(canvas, level) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, level.world.sky[0]);
    sky.addColorStop(1, level.world.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const rows = level.grid.length;
    const bricksH = rows * BRICK_H;
    const pad = 12;
    const scale = Math.min(width / (FIELD_W + pad * 2), height / (bricksH + pad * 2));
    const ox = (width - FIELD_W * scale) / 2;
    const oy = (height - bricksH * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    ctx.strokeStyle = level.world.grid;
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let x = 0; x <= FIELD_W; x += BRICK_W) {
        ctx.moveTo(x, -pad);
        ctx.lineTo(x, bricksH + pad);
    }
    ctx.stroke();

    level.grid.forEach((line, row) => {
        [...line].forEach((letter, col) => {
            const spec = brickSpec(letter);
            if (spec) drawBrick(ctx, col * BRICK_W, row * BRICK_H, BRICK_W, BRICK_H, spec.kind, spec.color, spec.hits, spec.hits);
        });
    });
}
