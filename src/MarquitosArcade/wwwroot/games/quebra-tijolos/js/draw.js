// As peças desenhadas: tijolos, raquete, bola e cápsulas.
//
// Tudo em unidades do campo — quem põe a escala é o js/field.js. As mesmas
// funções desenham o jogo e as miniaturas dos cartões dos níveis (js/menu.js),
// por isso o cartão mostra mesmo o nível que se vai jogar.
//
// Os tijolos são o que há em maior número, e cada um leva gradientes: em vez
// de os refazer a cada frame, cada aspeto (tipo, cor e golpes que faltam) é
// desenhado uma vez num canvas à parte, à resolução do ecrã, e depois só se
// carimba (`brickSprite`). A cache esvazia-se quando a escala muda.

import { BRICK_COLORS } from './bricks.js';
import { BALL_R, FONT_DISPLAY, PADDLE_H } from './config.js';

/** Folga entre tijolos vizinhos, em unidades: metade de cada lado. */
const GAP = 1.2;
const RADIUS = 3;

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function vertical(ctx, y, h, stops) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    return g;
}

/** Riscos de um tijolo rachado: mais golpes levados, mais riscos. */
function cracks(ctx, x, y, w, h, level) {
    ctx.save();
    ctx.strokeStyle = 'rgba(20, 24, 40, 0.75)';
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.42, y + 1);
    ctx.lineTo(x + w * 0.5, y + h * 0.45);
    ctx.lineTo(x + w * 0.44, y + h * 0.7);
    ctx.lineTo(x + w * 0.52, y + h - 1);
    if (level > 1) {
        ctx.moveTo(x + w * 0.5, y + h * 0.45);
        ctx.lineTo(x + w * 0.68, y + h * 0.3);
        ctx.lineTo(x + w * 0.8, y + h * 0.42);
        ctx.moveTo(x + w * 0.44, y + h * 0.7);
        ctx.lineTo(x + w * 0.26, y + h * 0.62);
        ctx.lineTo(x + w * 0.16, y + h * 0.78);
    }
    ctx.stroke();
    ctx.restore();
}

function bolt(ctx, cx, cy) {
    ctx.fillStyle = 'rgba(10, 14, 28, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy + 0.4, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(225, 232, 250, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Um tijolo na posição (x, y), com o tamanho (w, h) da casa. Desenha-se dentro
 * da casa, com a folga a toda a volta.
 */
export function drawBrick(ctx, x, y, w, h, kind, color, hits, maxHits) {
    const bx = x + GAP / 2;
    const by = y + GAP / 2;
    const bw = w - GAP;
    const bh = h - GAP;

    switch (kind) {
        case 'silver': {
            roundRect(ctx, bx, by, bw, bh, RADIUS);
            ctx.fillStyle = vertical(ctx, by, bh, [[0, '#ffffff'], [0.35, '#d4dbe8'], [0.7, '#9ea9bf'], [1, '#6f7a92']]);
            ctx.fill();
            // O brilho do metal, de esguelha.
            ctx.save();
            ctx.clip();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath();
            ctx.moveTo(bx + bw * 0.55, by);
            ctx.lineTo(bx + bw * 0.7, by);
            ctx.lineTo(bx + bw * 0.5, by + bh);
            ctx.lineTo(bx + bw * 0.35, by + bh);
            ctx.fill();
            ctx.restore();
            if (hits < maxHits) cracks(ctx, bx, by, bw, bh, maxHits - hits);
            break;
        }
        case 'titanium': {
            roundRect(ctx, bx, by, bw, bh, RADIUS);
            ctx.fillStyle = vertical(ctx, by, bh, [[0, '#aeb8dc'], [0.4, '#6d78a3'], [1, '#353d63']]);
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 210, 245, 0.35)';
            ctx.lineWidth = 0.8;
            roundRect(ctx, bx + 2.5, by + 2.5, bw - 5, bh - 5, 1.5);
            ctx.stroke();
            bolt(ctx, bx + 3.4, by + bh / 2);
            bolt(ctx, bx + bw - 3.4, by + bh / 2);
            if (hits < maxHits) cracks(ctx, bx, by, bw, bh, maxHits - hits);
            break;
        }
        case 'steel': {
            roundRect(ctx, bx, by, bw, bh, RADIUS);
            ctx.fillStyle = vertical(ctx, by, bh, [[0, '#8892ab'], [0.45, '#4a5268'], [1, '#262b3a']]);
            ctx.fill();
            // Chapa estriada.
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
            ctx.lineWidth = 1;
            for (let i = -bh; i < bw; i += 4) {
                ctx.beginPath();
                ctx.moveTo(bx + i, by + bh);
                ctx.lineTo(bx + i + bh, by);
                ctx.stroke();
            }
            ctx.restore();
            ctx.strokeStyle = 'rgba(255, 214, 120, 0.55)';
            ctx.lineWidth = 0.9;
            roundRect(ctx, bx + 0.45, by + 0.45, bw - 0.9, bh - 0.9, RADIUS);
            ctx.stroke();
            bolt(ctx, bx + 3.4, by + 3.4);
            bolt(ctx, bx + bw - 3.4, by + 3.4);
            bolt(ctx, bx + 3.4, by + bh - 3.4);
            bolt(ctx, bx + bw - 3.4, by + bh - 3.4);
            break;
        }
        case 'tnt': {
            roundRect(ctx, bx, by, bw, bh, RADIUS);
            ctx.fillStyle = vertical(ctx, by, bh, [[0, '#ff8a6a'], [0.4, '#e2332f'], [1, '#8f1418']]);
            ctx.fill();
            // As riscas de perigo, nas pontas.
            ctx.save();
            ctx.clip();
            for (const side of [bx, bx + bw - 6]) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(side, by, 6, bh);
                ctx.clip();
                ctx.fillStyle = '#ffd23f';
                ctx.fillRect(side, by, 6, bh);
                ctx.fillStyle = '#1b1b22';
                for (let i = -bh; i < 6; i += 4) {
                    ctx.beginPath();
                    ctx.moveTo(side + i, by + bh);
                    ctx.lineTo(side + i + 2, by + bh);
                    ctx.lineTo(side + i + 2 + bh, by);
                    ctx.lineTo(side + i + bh, by);
                    ctx.fill();
                }
                ctx.restore();
            }
            ctx.restore();
            ctx.fillStyle = '#fff4e0';
            ctx.font = `700 ${Math.round(bh * 0.62)}px ${FONT_DISPLAY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TNT', bx + bw / 2, by + bh / 2 + 0.5);
            break;
        }
        default: {
            const c = BRICK_COLORS[color];
            roundRect(ctx, bx, by, bw, bh, RADIUS);
            ctx.fillStyle = vertical(ctx, by, bh, [[0, c.light], [0.42, c.base], [1, c.dark]]);
            ctx.fill();
            // Brilho de cima: um risco de luz e uma faixa mais clara.
            ctx.save();
            ctx.clip();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(bx, by, bw, bh * 0.38);
            ctx.restore();
        }
    }

    // Aresta comum: luz em cima, sombra em baixo — o volume do tijolo.
    ctx.save();
    roundRect(ctx, bx, by, bw, bh, RADIUS);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(bx + 2, by + 0.6, bw - 4, 1.1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(bx, by + bh - 1.6, bw, 1.6);
    ctx.restore();
}

// ---------- Cache de tijolos ----------

const sprites = new Map();
let spriteScale = 0;

/** O tijolo já desenhado, para carimbar com `drawImage` em unidades do campo. */
export function brickSprite(brick, pixelsPerUnit) {
    if (pixelsPerUnit !== spriteScale) {
        sprites.clear();
        spriteScale = pixelsPerUnit;
    }
    const key = `${brick.kind}:${brick.color}:${brick.hits}`;
    let sprite = sprites.get(key);
    if (!sprite) {
        sprite = document.createElement('canvas');
        sprite.width = Math.ceil(brick.w * pixelsPerUnit);
        sprite.height = Math.ceil(brick.h * pixelsPerUnit);
        const ctx = sprite.getContext('2d');
        ctx.scale(sprite.width / brick.w, sprite.height / brick.h);
        drawBrick(ctx, 0, 0, brick.w, brick.h, brick.kind, brick.color, brick.hits, brick.maxHits);
        sprites.set(key, sprite);
    }
    return sprite;
}

// ---------- Raquete ----------

const MODE_CAPS = {
    default: ['#ff8197', '#e0234a', '#8c0f2a'],
    wide: ['#9db6ff', '#3a64f0', '#1c3291'],
    catch: ['#a4f5c1', '#22b45a', '#0d6631'],
    laser: ['#ffb08a', '#f0482a', '#8d1d0c']
};

/**
 * A raquete: um corpo de metal com as duas pontas coloridas (a cor diz o
 * poder que tem) e uma faixa de luz no meio, na cor do mundo.
 */
export function drawPaddle(ctx, x, y, w, mode, accent, glow = 0) {
    const h = PADDLE_H;
    const caps = MODE_CAPS[mode] || MODE_CAPS.default;
    const capW = Math.min(14, w * 0.22);

    // Halo por baixo.
    ctx.save();
    ctx.globalAlpha = 0.35 + glow * 0.4;
    const halo = ctx.createRadialGradient(x + w / 2, y + h, 2, x + w / 2, y + h, w * 0.7);
    halo.addColorStop(0, accent);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - w * 0.2, y - h, w * 1.4, h * 3);
    ctx.restore();

    // Canhões do laser, por cima das pontas.
    if (mode === 'laser') {
        ctx.fillStyle = '#c9d1e6';
        for (const cx of [x + 4, x + w - 8]) {
            roundRect(ctx, cx, y - 5, 4, 7, 1);
            ctx.fill();
        }
    }

    // Corpo.
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = vertical(ctx, y, h, [[0, '#f4f7ff'], [0.45, '#a6b1cc'], [1, '#535d7a']]);
    ctx.fill();

    // Pontas.
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    for (const cx of [x, x + w - capW]) {
        ctx.fillStyle = vertical(ctx, y, h, [[0, caps[0]], [0.45, caps[1]], [1, caps[2]]]);
        ctx.fillRect(cx, y, capW, h);
    }
    ctx.fillStyle = 'rgba(20, 24, 40, 0.45)';
    ctx.fillRect(x + capW, y, 1, h);
    ctx.fillRect(x + w - capW - 1, y, 1, h);

    // A faixa de luz.
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.75 + glow * 0.25;
    ctx.fillRect(x + capW + 4, y + h / 2 - 1.5, w - capW * 2 - 8, 3);
    ctx.globalAlpha = 1;

    // Brilho de cima.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(x + h / 2, y + 1.2, w - h, 1.2);
    ctx.restore();
}

// ---------- Bola ----------

export function drawBall(ctx, ball, accent) {
    // O rasto, cada vez mais apagado.
    ball.trail.forEach((point, i) => {
        const t = 1 - (i + 1) / (ball.trail.length + 1);
        ctx.globalAlpha = t * 0.4;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(point.x, point.y, BALL_R * (0.45 + t * 0.5), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    const glow = ctx.createRadialGradient(ball.x, ball.y, BALL_R * 0.5, ball.x, ball.y, BALL_R * 3);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R * 3, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(ball.x - BALL_R * 0.35, ball.y - BALL_R * 0.4, 0.5, ball.x, ball.y, BALL_R);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.6, '#e4f4ff');
    body.addColorStop(1, '#9fc4e8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
}

// ---------- Cápsulas ----------

/** Uma cápsula a cair: comprimido de cor com a letra do poder, a rodar. */
export function drawCapsule(ctx, x, y, w, h, type, spin) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = vertical(ctx, y, h, [[0, '#ffffff'], [0.25, type.color], [1, 'rgba(0, 0, 0, 0.55)']]);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = type.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
    // As riscas a passar dão a ideia de que roda.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    const offset = (spin * 24) % 8;
    for (let sx = x - 8 + offset; sx < x + w; sx += 8) ctx.fillRect(sx, y, 2, h);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(h * 0.82)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.letter, x + w / 2, y + h / 2 + 0.5);
}
