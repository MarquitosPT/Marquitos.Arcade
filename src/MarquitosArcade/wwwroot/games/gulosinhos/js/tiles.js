// Os tiles do percurso: terra com relva, blocos, plataformas, caixotes,
// bolachas e picos.
//
// Cada tipo é pintado uma vez num canvas pequeno (por cenário, por tamanho de
// tile e por densidade de píxeis) e depois só se carimba com `drawImage` — um
// ecrã cheio são umas centenas de tiles por fotograma, e repintar cada um com
// caminhos vetoriais custava mais do que o resto do jogo junto.
//
// Há um jogo de carimbos por cenário e tamanho, e vários ao mesmo tempo: as
// miniaturas dos cartões de nível desenham doze cenários em ponto pequeno,
// e não podem deitar fora os do jogo, que está a ser desenhado por trás.

import { crumbleShake } from './level.js';
import { roundRect } from './sprites.js';
import { T, isSolidTile, tileAt } from './world.js';

/** Os jogos de carimbos, do mais antigo para o mais recente. */
const sets = new Map();
const MAX_SETS = 16;
let cache = null;

function useSet(key) {
    cache = sets.get(key);
    if (cache) {
        // Volta ao fim da fila: é o mais recente.
        sets.delete(key);
        sets.set(key, cache);
        return;
    }
    cache = new Map();
    sets.set(key, cache);
    if (sets.size > MAX_SETS) sets.delete(sets.keys().next().value);
}

function sprite(key, size, dpr, paint) {
    let canvas = cache.get(key);
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * dpr);
    canvas.height = Math.ceil(size * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    paint(ctx, size);
    cache.set(key, canvas);
    return canvas;
}

function paintGround(ctx, s, theme, variant, top) {
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, 0, s, s);
    // Pedrinhas na terra, em sítios diferentes conforme a variante.
    ctx.fillStyle = theme.groundDots;
    const spots = [[0.25, 0.55], [0.7, 0.3], [0.55, 0.8], [0.15, 0.2], [0.85, 0.7]];
    for (let i = 0; i < 3; i++) {
        const [dx, dy] = spots[(i + variant) % spots.length];
        ctx.beginPath();
        ctx.ellipse(dx * s, dy * s, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    if (!top) return;
    // A relva: uma faixa com a borda de baixo aos caracóis.
    ctx.fillStyle = theme.grassDark;
    ctx.fillRect(0, 0, s, s * 0.36);
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc((i + 0.5) * s / 4, s * 0.36, s / 8, 0, Math.PI);
        ctx.fill();
    }
    ctx.fillStyle = theme.grass;
    ctx.fillRect(0, 0, s, s * 0.28);
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc((i + 0.5) * s / 4, s * 0.28, s / 8.5, 0, Math.PI);
        ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(0, s * 0.05, s, s * 0.05);
}

function paintBlock(ctx, s, theme) {
    ctx.fillStyle = theme.blockDark;
    roundRect(ctx, 1, 1, s - 2, s - 2, s * 0.18);
    ctx.fill();
    ctx.fillStyle = theme.block;
    roundRect(ctx, 1, 1, s - 2, s - s * 0.16, s * 0.18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    roundRect(ctx, s * 0.14, s * 0.12, s * 0.42, s * 0.12, s * 0.06);
    ctx.fill();
    ctx.fillStyle = theme.blockDark;
    for (const [dx, dy] of [[0.25, 0.65], [0.75, 0.65]]) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintPlatform(ctx, s, theme) {
    ctx.fillStyle = theme.platformDark;
    roundRect(ctx, 0, s * 0.04, s, s * 0.38, s * 0.12);
    ctx.fill();
    ctx.fillStyle = theme.platform;
    roundRect(ctx, 0, 0, s, s * 0.3, s * 0.12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(s * 0.1, s * 0.06, s * 0.8, s * 0.05);
}

function paintCrate(ctx, s) {
    ctx.fillStyle = '#b5743a';
    roundRect(ctx, 1, 1, s - 2, s - 2, s * 0.08);
    ctx.fill();
    ctx.fillStyle = '#dca061';
    ctx.fillRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72);
    ctx.strokeStyle = '#b5743a';
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(s * 0.14, s * 0.14);
    ctx.lineTo(s * 0.86, s * 0.86);
    ctx.moveTo(s * 0.86, s * 0.14);
    ctx.lineTo(s * 0.14, s * 0.86);
    ctx.stroke();
    ctx.fillStyle = '#7a4a22';
    for (const [dx, dy] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintCrumble(ctx, s) {
    ctx.fillStyle = '#c98a4b';
    roundRect(ctx, 1, s * 0.04, s - 2, s * 0.44, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#e8b36d';
    roundRect(ctx, 1, 0, s - 2, s * 0.36, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#b07136';
    for (const [dx, dy] of [[0.2, 0.15], [0.5, 0.22], [0.8, 0.14], [0.35, 0.3], [0.68, 0.32]]) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintSpikes(ctx, s) {
    for (let i = 0; i < 3; i++) {
        const x0 = (i * s) / 3;
        ctx.fillStyle = '#e6ebf5';
        ctx.beginPath();
        ctx.moveTo(x0 + 1, s);
        ctx.lineTo(x0 + s / 6, s * 0.42);
        ctx.lineTo(x0 + s / 3 - 1, s);
        ctx.fill();
        ctx.fillStyle = '#a3adc2';
        ctx.beginPath();
        ctx.moveTo(x0 + s / 6, s * 0.42);
        ctx.lineTo(x0 + s / 3 - 1, s);
        ctx.lineTo(x0 + s / 6, s);
        ctx.fill();
    }
}

/** Desenha os tiles à vista. `ox`, `oy`: onde fica o canto (0, 0) do mundo no ecrã. */
export function drawTiles(ctx, world, theme, themeName, T_, ox, oy, view, bottom) {
    const dpr = view.dpr;
    useSet(`${themeName}|${T_}|${dpr}`);
    const s = T_;
    const c0 = Math.max(0, Math.floor(-ox / s));
    const c1 = Math.min(world.cols - 1, Math.ceil((view.width - ox) / s));
    const r0 = Math.max(0, Math.floor(-oy / s));
    const r1 = Math.min(world.rows - 1, Math.ceil((bottom - oy) / s));

    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const t = tileAt(world, c, r);
            if (t === T.EMPTY) continue;
            const x = ox + c * s;
            const y = oy + r * s;
            switch (t) {
                case T.GROUND: {
                    const top = !isSolidTile(tileAt(world, c, r - 1)) || tileAt(world, c, r - 1) === T.CRATE;
                    const variant = (c * 7 + r * 3) % 3;
                    ctx.drawImage(sprite(`g${top ? 't' : 'b'}${variant}`, s, dpr, (g) => paintGround(g, s, theme, variant, top)), x, y, s, s);
                    // As bordas de um degrau ou de um buraco, mais escuras.
                    ctx.fillStyle = theme.groundDark;
                    const edge = Math.max(2, Math.round(s * 0.08));
                    if (tileAt(world, c - 1, r) === T.EMPTY || tileAt(world, c - 1, r) === T.SPIKES) ctx.fillRect(x, y + (top ? s * 0.3 : 0), edge, s - (top ? s * 0.3 : 0));
                    if (tileAt(world, c + 1, r) === T.EMPTY || tileAt(world, c + 1, r) === T.SPIKES) ctx.fillRect(x + s - edge, y + (top ? s * 0.3 : 0), edge, s - (top ? s * 0.3 : 0));
                    break;
                }
                case T.BLOCK:
                    ctx.drawImage(sprite('block', s, dpr, (g) => paintBlock(g, s, theme)), x, y, s, s);
                    break;
                case T.PLATFORM:
                    ctx.drawImage(sprite('platform', s, dpr, (g) => paintPlatform(g, s, theme)), x, y, s, s);
                    break;
                case T.CRATE:
                    ctx.drawImage(sprite('crate', s, dpr, (g) => paintCrate(g, s)), x, y, s, s);
                    break;
                case T.CRUMBLE: {
                    const shake = crumbleShake(c, r);
                    const dx = shake ? Math.sin(performance.now() / 25 + c) * s * 0.05 * (0.5 + shake) : 0;
                    ctx.drawImage(sprite('crumble', s, dpr, (g) => paintCrumble(g, s)), x + dx, y, s, s);
                    break;
                }
                case T.SPIKES:
                    ctx.drawImage(sprite('spikes', s, dpr, (g) => paintSpikes(g, s)), x, y, s, s);
                    break;
                default:
                    break;
            }
        }
    }
}
