import { BALL_RADIUS, FONT_BODY, FONT_DISPLAY, PADDLE_HEIGHT } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { game } from './state.js';

function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function levelPalette() {
    return game.level?.palette || { accent: '#7dd3fc', bricks: ['#6ee7ff', '#38bdf8', '#2563eb'], wall: '#0f4c81', glow: 'rgba(96, 202, 255, 0.28)' };
}

function drawWallPattern(ctx, x, y, w, h, palette, size) {
    const brickW = size;
    const brickH = size * 0.55;
    for (let row = 0, yy = y; yy < y + h; row++, yy += brickH) {
        const shift = row % 2 ? brickW * 0.5 : 0;
        for (let xx = x - shift; xx < x + w + brickW; xx += brickW) {
            ctx.fillStyle = row % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)';
            ctx.fillRect(xx, yy, brickW - 1, brickH - 1);
        }
    }
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, palette.glow);
    grad.addColorStop(1, 'rgba(8, 12, 24, 0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
}

function drawBackground(ctx, W, H, palette) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0e1327');
    bg.addColorStop(0.55, '#111934');
    bg.addColorStop(1, '#090d1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(W * 0.5, H * 0.18, 30, W * 0.5, H * 0.18, H * 0.7);
    halo.addColorStop(0, palette.glow);
    halo.addColorStop(1, 'rgba(16, 24, 38, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
}

function drawFrame(ctx, layout, palette) {
    const { frame, inner, wallPattern } = layout;
    const rightFill = game.view.width - (frame.x + frame.width);
    drawWallPattern(ctx, 0, frame.y, frame.x, frame.height, palette, wallPattern);
    drawWallPattern(ctx, frame.x + frame.width, frame.y, rightFill, frame.height, palette, wallPattern);
    drawWallPattern(ctx, frame.x, frame.y, frame.width, inner.y - frame.y, palette, wallPattern);

    const border = ctx.createLinearGradient(frame.x, frame.y, frame.x + frame.width, frame.y + frame.height);
    border.addColorStop(0, 'rgba(255,255,255,0.28)');
    border.addColorStop(1, 'rgba(255,255,255,0.08)');
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, 22);
    ctx.fillStyle = 'rgba(12, 18, 34, 0.42)';
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundedRect(ctx, inner.x, inner.y, inner.width, inner.height, 18);
    ctx.fillStyle = 'rgba(8, 14, 30, 0.84)';
    ctx.fill();
}

function brickColor(brick, palette) {
    if (brick.steel) return '#a1a1aa';
    return palette.bricks[Math.max(0, Math.min(palette.bricks.length - 1, brick.maxHp - 1))];
}

function drawBricks(ctx, palette) {
    for (const brick of game.bricks) {
        if (!brick.steel && brick.hp <= 0) continue;
        const color = brickColor(brick, palette);
        const alpha = brick.flash > 0 ? 0.36 + brick.flash : 0.18;
        roundedRect(ctx, brick.x, brick.y, brick.w, brick.h, 7);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(brick.x + 4, brick.y + 4, brick.w - 8, Math.max(3, brick.h * 0.22));
        ctx.strokeStyle = brick.steel ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (!brick.steel && brick.hp > 1) {
            ctx.fillStyle = 'rgba(8, 15, 30, 0.28)';
            ctx.font = `700 ${Math.max(12, brick.h * 0.46)}px ${FONT_DISPLAY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(brick.hp, brick.x + brick.w / 2, brick.y + brick.h / 2 + 1);
        }
    }
}

function drawPaddle(ctx, palette) {
    const y = game.layout.paddleY - PADDLE_HEIGHT / 2;
    roundedRect(ctx, game.paddle.x, y, game.paddle.width, PADDLE_HEIGHT, 8);
    const grad = ctx.createLinearGradient(game.paddle.x, y, game.paddle.x, y + PADDLE_HEIGHT);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, palette.accent);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
}

function drawBall(ctx) {
    const glow = ctx.createRadialGradient(game.ball.x - 2, game.ball.y - 3, 2, game.ball.x, game.ball.y, BALL_RADIUS * 1.8);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.45, '#dbeafe');
    glow.addColorStop(1, 'rgba(191, 219, 254, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS * 1.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
}

function drawParticles(ctx) {
    for (const p of game.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life * 1.4);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const spark of game.steelHits) {
        ctx.strokeStyle = '#f8fafc';
        ctx.globalAlpha = spark.life / 0.2;
        ctx.beginPath();
        ctx.moveTo(spark.x - 10, spark.y);
        ctx.lineTo(spark.x + 10, spark.y);
        ctx.moveTo(spark.x, spark.y - 10);
        ctx.lineTo(spark.x, spark.y + 10);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function drawHud(ctx, palette) {
    const { frame } = game.layout;
    ctx.font = `700 18px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(`Nível ${game.level?.id || game.menuLevelId}`, frame.x + 10, frame.y - 18);
    ctx.textAlign = 'center';
    ctx.fillText(`Pontos ${fmtPoints(game.levelScore)}`, frame.x + frame.width / 2, frame.y - 18);
    ctx.textAlign = 'right';
    ctx.fillText(`Tempo ${fmtTime(game.elapsed * 1000)}`, frame.x + frame.width - 10, frame.y - 18);

    ctx.textAlign = 'left';
    ctx.font = `700 17px ${FONT_BODY}`;
    const hearts = '♥'.repeat(game.lives) + '·'.repeat(Math.max(0, 3 - game.lives));
    ctx.fillStyle = palette.accent;
    ctx.fillText(hearts, frame.x + 12, frame.y + frame.height + 24);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(`${game.remaining} tijolos`, frame.x + 74, frame.y + frame.height + 24);

    if (game.phase === 'countdown') {
        ctx.textAlign = 'center';
        ctx.font = `800 ${Math.max(44, frame.width * 0.11)}px ${FONT_DISPLAY}`;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        const number = Math.max(1, Math.ceil(game.countdown));
        ctx.fillText(String(number), frame.x + frame.width / 2, frame.y + frame.height * 0.58);
    }

    if (game.phase === 'menu') {
        ctx.textAlign = 'center';
        ctx.font = `700 18px ${FONT_BODY}`;
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText('Escolhe um nível e lança a bola para partir a muralha inteira.', frame.x + frame.width / 2, frame.y + frame.height + 24);
    }
}

function drawMenuPreview() {
    const previewOffset = Math.sin(game.globalClock * 1.6) * 24;
    game.ball.x = game.layout.inner.x + game.layout.inner.width * 0.5 + previewOffset;
    game.ball.y = game.layout.inner.bottom - 150 + Math.cos(game.globalClock * 2.1) * 16;
    game.paddle.x = game.layout.inner.x + (game.layout.inner.width - game.paddle.width) / 2 + previewOffset * 0.32;
}

export function render() {
    const view = game.view;
    if (!view || !game.layout) return;
    const ctx = view.ctx;
    const { width: W, height: H } = view;
    const palette = levelPalette();

    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, W, H, palette);
    drawFrame(ctx, game.layout, palette);
    if (game.phase === 'menu' || game.phase === 'result') drawMenuPreview();
    drawBricks(ctx, palette);
    drawPaddle(ctx, palette);
    drawBall(ctx);
    drawParticles(ctx);
    drawHud(ctx, palette);
}
