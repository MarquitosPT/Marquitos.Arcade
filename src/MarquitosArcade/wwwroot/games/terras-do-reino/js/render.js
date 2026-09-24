// O desenho de cada frame: céu, tabuleiro, peças, efeitos e balões.
//
// O tabuleiro é desenhado de trás para a frente, diagonal a diagonal (x + y
// crescente) — o "algoritmo do pintor" da perspetiva isométrica. Em cada casa
// pinta-se primeiro o chão (com os lados, se estiver mais alta do que a casa
// da frente) e logo a seguir o que está em cima dela. Assim uma colina à
// frente tapa o que está atrás dela, e uma árvore nunca fica por baixo da relva
// da casa seguinte.
//
// O contexto trabalha em coordenadas de mundo: a câmara (centro e zoom) e o
// devicePixelRatio vão numa só transformação no início do frame. Os balões e os
// números a subir desenham-se no fim, em coordenadas de ecrã, para terem o
// mesmo tamanho em qualquer zoom.

import {
    BUILDING, ELEV_PX, FONT_BODY, FONT_DISPLAY, MAP_SIZE, RESOURCE, SLAB_PX, TILE_H, TILE_W
} from './config.js';
import { checkPlacement, inTerritory } from './buildings.js';
import { camera, gridToWorld, worldToScreen } from './iso.js';
import { hash2 } from './rng.js';
import { setSpriteScale, stamp } from './sprite-cache.js';
import { LIVE, PLAYER_ROOF } from './sprites.js';
import { castleInfo, fx, game, ui } from './state.js';
import { CASTLE_CENTER, T_GRASS, T_HILL, T_MEADOW, T_SAND, T_WATER, idx, inMap } from './world.js';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

let ctx = null;
let view = null;

export function initRenderer(viewport) {
    view = viewport;
    ctx = viewport.ctx;
}

// ---------- Cores do chão ----------

const GROUND = {
    [T_GRASS]: [98, 48, 47],
    [T_MEADOW]: [82, 52, 54],
    [T_SAND]: [45, 55, 72],
    [T_HILL]: [88, 36, 45],
    [T_WATER]: [203, 62, 55]
};

const tileColorCache = new Map();
function groundColor(terrain, tint) {
    const bucket = Math.round(tint * 6);
    const key = terrain * 10 + bucket;
    let color = tileColorCache.get(key);
    if (!color) {
        const [h, s, l] = GROUND[terrain];
        color = `hsl(${h}, ${s}%, ${l + (bucket - 3) * 1.3}%)`;
        tileColorCache.set(key, color);
    }
    return color;
}

// ---------- Céu ----------

const skyClouds = Array.from({ length: 7 }, (_, i) => ({
    x: hash2(i, 1, 7),
    y: 0.08 + hash2(i, 2, 7) * 0.5,
    s: 0.6 + hash2(i, 3, 7) * 0.8,
    v: 0.004 + hash2(i, 4, 7) * 0.006
}));

function drawSky(t) {
    const w = view.width;
    const h = view.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5aa6e6');
    grad.addColorStop(0.55, '#a9d4f2');
    grad.addColorStop(1, '#dff0f8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (const c of skyClouds) {
        const x = (((c.x + t * c.v) % 1.3) - 0.15) * w;
        const y = c.y * h;
        const r = 38 * c.s;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.8, r * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(x - r * 0.7, y - r * 0.25, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.5, y - r * 0.35, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- Chão ----------

function tileElev(x, y) {
    return game.world.elev[idx(x, y)];
}

/** Relevo da casa da frente; fora do mapa é o fundo da placa de terra. */
function frontElev(x, y) {
    if (x >= MAP_SIZE || y >= MAP_SIZE) return -SLAB_PX / ELEV_PX - 0.6;
    return tileElev(x, y);
}

function drawSide(x0, y0, x1, y1, zTop, zBottom, color, lip) {
    // Face vertical entre os pontos de grelha (x0,y0) e (x1,y1).
    const ax = (x0 - y0) * HW;
    const ay = (x0 + y0) * HH;
    const bx = (x1 - y1) * HW;
    const by = (x1 + y1) * HH;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay - zTop);
    ctx.lineTo(bx, by - zTop);
    ctx.lineTo(bx, by - zBottom);
    ctx.lineTo(ax, ay - zBottom);
    ctx.closePath();
    ctx.fill();
    if (lip) {
        const lipH = Math.min(4, zTop - zBottom);
        ctx.fillStyle = lip;
        ctx.beginPath();
        ctx.moveTo(ax, ay - zTop);
        ctx.lineTo(bx, by - zTop);
        ctx.lineTo(bx, by - zTop + lipH);
        ctx.lineTo(ax, ay - zTop + lipH);
        ctx.closePath();
        ctx.fill();
    }
}

function drawGround(x, y, t, detail) {
    drawTile(x, y, t, detail);
    drawSlopes(x, y, detail);
}

function drawTile(x, y, t, detail) {
    const i = idx(x, y);
    const terrain = game.world.terrain[i];
    const e = game.world.elev[i];
    const z = e * ELEV_PX;
    const water = terrain === T_WATER;

    // Lados: só onde a casa da frente é mais baixa.
    const left = frontElev(x, y + 1);
    if (left < e) {
        const bottom = left * ELEV_PX;
        drawSide(x, y + 1, x + 1, y + 1, z, bottom, water ? '#2f6f9e' : '#8a5a35', water ? null : '#5d9a3a');
        if (y + 1 >= MAP_SIZE) {
            // A placa de terra: um veio mais escuro a meio, como as camadas do solo.
            drawSide(x, y + 1, x + 1, y + 1, z - 10, z - 13, 'rgba(60, 35, 18, 0.35)');
        }
    }
    const right = frontElev(x + 1, y);
    if (right < e) {
        const bottom = right * ELEV_PX;
        drawSide(x + 1, y + 1, x + 1, y, z, bottom, water ? '#27608a' : '#6e4528', water ? null : '#4f8a31');
        if (x + 1 >= MAP_SIZE) drawSide(x + 1, y + 1, x + 1, y, z - 10, z - 13, 'rgba(40, 22, 10, 0.35)');
    }

    // Tampo.
    const tx = (x - y) * HW;
    const ty = (x + y) * HH - z;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + HW, ty + HH);
    ctx.lineTo(tx, ty + TILE_H);
    ctx.lineTo(tx - HW, ty + HH);
    ctx.closePath();
    ctx.fillStyle = groundColor(terrain, game.world.tint[i]);
    ctx.fill();

    if (!detail) return;

    if (water) {
        // Reflexos que vão e vêm.
        const phase = (t * 0.6 + game.world.tint[i] * 5) % 2;
        if (phase < 1) {
            const a = Math.sin(phase * Math.PI) * 0.55;
            ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
            ctx.lineWidth = 1.2;
            const ox = (hash2(x, y, 3) - 0.5) * 20;
            ctx.beginPath();
            ctx.moveTo(tx + ox - 6, ty + HH + 2);
            ctx.lineTo(tx + ox + 6, ty + HH + 2);
            ctx.stroke();
        }
        return;
    }

    // As juntas das peças do tabuleiro.
    ctx.strokeStyle = 'rgba(30, 60, 20, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (terrain === T_MEADOW) {
        const colors = ['#fff6c8', '#f7a9c4', '#fde68a'];
        for (let k = 0; k < 3; k++) {
            const u = hash2(x, y, 40 + k) - 0.5;
            const v = hash2(x, y, 50 + k) - 0.5;
            ctx.fillStyle = colors[k];
            ctx.fillRect(tx + (u - v) * HW * 0.9, ty + HH + (u + v) * HH * 0.9, 2, 2);
        }
    } else if (terrain === T_GRASS && hash2(x, y, 60) < 0.5) {
        const u = hash2(x, y, 61) - 0.5;
        const v = hash2(x, y, 62) - 0.5;
        const px = tx + (u - v) * HW * 0.8;
        const py = ty + HH + (u + v) * HH * 0.8;
        ctx.strokeStyle = 'rgba(40, 90, 30, 0.45)';
        ctx.beginPath();
        ctx.moveTo(px - 2, py);
        ctx.lineTo(px - 3, py - 4);
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 5);
        ctx.moveTo(px + 2, py);
        ctx.lineTo(px + 3, py - 4);
        ctx.stroke();
    }
}

// ---------- Encostas ----------
//
// Uma colina ao lado de terra mais baixa não acaba num degrau a direito: a
// encosta escorre para a casa vizinha e morre nela a uma distância que muda de
// ponto para ponto, como terra que assentou. É o que encaixa as colinas na
// paisagem, em vez de parecerem caixas pousadas em cima dela.
//
// A encosta pinta-se na casa de baixo, logo a seguir ao chão dela. Pela ordem
// do pintor fica à frente do degrau de uma colina de trás, fica por baixo de
// uma colina da frente (que se pinta depois) e fica sempre por baixo do que
// estiver construído na casa de baixo.
//
// A distância a que a encosta morre sai de um hash dos pontos da grelha, por
// isso duas encostas que se tocam no mesmo canto concordam nele: uma crista de
// colinas desce numa só linha, sem dentes entre casas, e nas pontas de uma
// colina um leque na casa em diagonal junta as encostas dos dois lados.

const SLOPE_MIN = 0.16;
const SLOPE_MAX = 0.44;

/**
 * Os quatro lados de uma casa (x, y): onde está o vizinho, o ponto da grelha
 * onde começa a aresta partilhada, para onde ela segue (`u`), para onde a
 * encosta entra na casa (`n`) e quanta luz apanha uma encosta virada para ali
 * (a luz vem de cima, à esquerda).
 */
const SIDES = [
    { dx: 0, dy: -1, ex: 0, ey: 0, u: [1, 0], n: [0, 1], light: -4 },
    { dx: -1, dy: 0, ex: 0, ey: 0, u: [0, 1], n: [1, 0], light: -9 },
    { dx: 0, dy: 1, ex: 0, ey: 1, u: [1, 0], n: [0, -1], light: -6, back: true },
    { dx: 1, dy: 0, ex: 1, ey: 0, u: [0, 1], n: [-1, 0], light: -2, back: true }
];

/** Os quatro cantos: o vizinho em diagonal e as duas arestas da casa que saem do canto. */
const CORNERS = [
    { dx: -1, dy: -1, vx: 0, vy: 0, a: [0, 1], b: [1, 0], light: -7 },
    { dx: 1, dy: -1, vx: 1, vy: 0, a: [-1, 0], b: [0, 1], light: -3 },
    { dx: -1, dy: 1, vx: 0, vy: 1, a: [1, 0], b: [0, -1], light: -8, back: true },
    { dx: 1, dy: 1, vx: 1, vy: 1, a: [-1, 0], b: [0, -1], light: -4, back: true }
];

/** A casa (hx, hy) desce em encosta para a casa (lx, ly)? */
function slopesInto(hx, hy, lx, ly) {
    if (!inMap(hx, hy) || !inMap(lx, ly)) return false;
    const w = game.world;
    const h = idx(hx, hy);
    const l = idx(lx, ly);
    return w.elev[h] > w.elev[l] && w.terrain[l] !== T_WATER && w.terrain[h] !== T_WATER;
}

/** Até onde a encosta entra na casa de baixo, num ponto da grelha. */
function cornerDepth(vx, vy) {
    return SLOPE_MIN + hash2(vx, vy, 201) * (SLOPE_MAX - SLOPE_MIN);
}

/** Ponto de grelha (gx, gy) à altura `z` (px) -> mundo. */
function at(gx, gy, z) {
    return [(gx - gy) * HW, (gx + gy) * HH - z];
}

/**
 * O degradê de uma encosta: a cor da colina, mais escura conforme a luz, no
 * cimo; a cor da casa de baixo, só um pouco mais escura, no pé — para se ver
 * onde a encosta assenta sem parecer uma mancha.
 */
function slopeFill(from, to, light, low) {
    const [hh, hs, hl] = GROUND[T_HILL];
    const [lh, ls, ll] = GROUND[low];
    const grad = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
    grad.addColorStop(0, `hsl(${hh - 4}, ${hs - 2}%, ${hl + light}%)`);
    grad.addColorStop(0.6, `hsl(${(hh + lh) / 2}, ${(hs + ls) / 2}%, ${(hl + ll) / 2 + light * 0.6}%)`);
    grad.addColorStop(1, `hsl(${lh}, ${ls}%, ${ll - 4}%)`);
    return grad;
}

/** Caminho da curva irregular do pé da encosta, de `foot[0]` a `foot[last]`. */
function footCurve(path, foot, reverse) {
    const pts = reverse ? [...foot].reverse() : foot;
    path.lineTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2;
        const my = (pts[k][1] + pts[k + 1][1]) / 2;
        path.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
    }
    path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

/** Recorta ao losango da casa (x, y), ao nível `z`. */
function clipToTile(x, y, z) {
    const top = at(x, y, z);
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.lineTo(top[0] + HW, top[1] + HH);
    ctx.lineTo(top[0], top[1] + TILE_H);
    ctx.lineTo(top[0] - HW, top[1] + HH);
    ctx.closePath();
    ctx.clip();
}

/** Uma encosta ao longo de um lado da casa (x, y), vinda da colina vizinha. */
function drawSideSlope(x, y, side, zTop, zLow, low, detail) {
    const ex = x + side.ex;
    const ey = y + side.ey;
    const { u, n } = side;
    // Profundidades nas pontas (partilhadas com as encostas vizinhas) e em três
    // pontos a meio, com o seu próprio tremor.
    const d0 = cornerDepth(ex, ey);
    const d1 = cornerDepth(ex + u[0], ey + u[1]);
    const seed = (ex * 2 + (u[0] ? 0 : 1)) * 197 + ey;
    const depths = [d0];
    for (let k = 1; k <= 3; k++) {
        const wobble = (hash2(seed, k, 203) - 0.5) * 0.24;
        depths.push(Math.max(0.08, d0 + (d1 - d0) * (k / 4) + 0.04 + wobble));
    }
    depths.push(d1);

    const top0 = at(ex, ey, zTop);
    const top1 = at(ex + u[0], ey + u[1], zTop);
    const foot = depths.map((d, k) => {
        const s = k / 4;
        return at(ex + u[0] * s + n[0] * d, ey + u[1] * s + n[1] * d, zLow);
    });

    const path = new Path2D();
    path.moveTo(top0[0], top0[1]);
    path.lineTo(top1[0], top1[1]);
    footCurve(path, foot, true);
    path.closePath();

    ctx.save();
    if (side.back) clipToTile(x, y, zLow);
    const midTop = [(top0[0] + top1[0]) / 2, (top0[1] + top1[1]) / 2];
    ctx.fillStyle = slopeFill(midTop, foot[2], side.light, low);
    ctx.fill(path);

    // Uma sombra leve onde a encosta assenta na relva.
    const edge = new Path2D();
    edge.moveTo(foot[0][0], foot[0][1]);
    footCurve(edge, foot, false);
    ctx.strokeStyle = 'rgba(28, 52, 14, 0.16)';
    ctx.lineWidth = 1.1;
    ctx.stroke(edge);

    if (detail && !side.back) {
        // Uma ou outra pedra solta e terra à mostra, a meio da encosta.
        ctx.clip(path);
        for (let k = 0; k < 3; k++) {
            const roll = hash2(seed, k, 211);
            if (roll > 0.5) continue;
            const s = 0.15 + hash2(seed, k, 212) * 0.7;
            const f = 0.3 + hash2(seed, k, 213) * 0.4;
            const d = depths[Math.round(s * 4)] * f;
            const [px, py] = at(ex + u[0] * s + n[0] * d, ey + u[1] * s + n[1] * d, zTop + (zLow - zTop) * (0.4 + f * 0.5));
            if (roll < 0.22) {
                ctx.fillStyle = 'rgba(120, 84, 50, 0.32)';
                const rx = 2.5 + hash2(seed, k, 214) * 3;
                ctx.beginPath();
                ctx.ellipse(px, py, rx, rx * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(150, 156, 158, 0.9)';
                ctx.beginPath();
                ctx.ellipse(px, py, 1.7, 1.1, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.restore();
}

/** O leque num canto da casa (x, y), onde cai a ponta de uma colina em diagonal. */
function drawCornerSlope(x, y, corner, zTop, zLow, low) {
    const vx = x + corner.vx;
    const vy = y + corner.vy;
    const d = cornerDepth(vx, vy);
    const { a, b } = corner;
    const apex = at(vx, vy, zTop);
    const pa = at(vx + a[0] * d, vy + a[1] * d, zLow);
    const pm = at(vx + (a[0] + b[0]) * d * 0.8, vy + (a[1] + b[1]) * d * 0.8, zLow);
    const pb = at(vx + b[0] * d, vy + b[1] * d, zLow);

    ctx.save();
    if (corner.back) clipToTile(x, y, zLow);
    ctx.fillStyle = slopeFill(apex, pm, corner.light, low);
    ctx.beginPath();
    ctx.moveTo(apex[0], apex[1]);
    ctx.lineTo(pa[0], pa[1]);
    ctx.quadraticCurveTo(pm[0], pm[1], pb[0], pb[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(28, 52, 14, 0.16)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.quadraticCurveTo(pm[0], pm[1], pb[0], pb[1]);
    ctx.stroke();
    ctx.restore();
}

/** As encostas que as colinas vizinhas deixam cair na casa (x, y). */
function drawSlopes(x, y, detail) {
    const w = game.world;
    const i = idx(x, y);
    const low = w.terrain[i];
    if (low === T_WATER) return;
    const zLow = w.elev[i] * ELEV_PX;
    const zOf = (dx, dy) => w.elev[idx(x + dx, y + dy)] * ELEV_PX;

    // Primeiro os cantos: onde há encosta num lado, ela cobre o canto.
    for (const c of CORNERS) {
        if (!slopesInto(x + c.dx, y + c.dy, x, y)) continue;
        if (slopesInto(x + c.dx, y, x, y) || slopesInto(x, y + c.dy, x, y)) continue;
        drawCornerSlope(x, y, c, zOf(c.dx, c.dy), zLow, low);
    }
    for (const side of SIDES) {
        if (slopesInto(x + side.dx, y + side.dy, x, y)) {
            drawSideSlope(x, y, side, zOf(side.dx, side.dy), zLow, low, detail);
        }
    }
}

// ---------- Território e modo de construção ----------

/** Mapa de casas válidas para o edifício em construção, refeito só quando algo muda. */
const placement = { key: '', ok: null };

function placementMap() {
    const kind = ui.placing;
    const key = `${kind}|${game.buildings.length}|${game.castleLevel}|${game.planted.length}|${game.flattened.length}|${Math.floor(fx.time * 2)}`;
    if (placement.key === key) return placement.ok;
    placement.key = key;
    placement.ok = new Uint8Array(MAP_SIZE * MAP_SIZE);
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            placement.ok[idx(x, y)] = checkPlacement(kind, x, y, { ignoreCost: true }).ok ? 1 : 0;
        }
    }
    return placement.ok;
}

function tilePath(x, y, inset = 0) {
    const z = tileElev(x, y) * ELEV_PX;
    const tx = (x - y) * HW;
    const ty = (x + y) * HH - z;
    const ix = inset * HW;
    const iy = inset * HH;
    ctx.beginPath();
    ctx.moveTo(tx, ty + iy * 2);
    ctx.lineTo(tx + HW - ix * 2, ty + HH);
    ctx.lineTo(tx, ty + TILE_H - iy * 2);
    ctx.lineTo(tx - HW + ix * 2, ty + HH);
    ctx.closePath();
}

function drawTileOverlay(x, y, okMap) {
    if (okMap) {
        tilePath(x, y, 0.04);
        if (okMap[idx(x, y)]) {
            ctx.fillStyle = 'rgba(126, 217, 87, 0.28)';
            ctx.fill();
        } else if (!inTerritory(x, y)) {
            ctx.fillStyle = 'rgba(10, 20, 30, 0.16)';
            ctx.fill();
        }
    }
}

/** A fronteira do território: as arestas entre casas de dentro e de fora. */
function drawTerritoryBorder(strong) {
    const radius = castleInfo().radius;
    const inside = (x, y) => x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE
        && Math.hypot(x + 0.5 - CASTLE_CENTER.x, y + 0.5 - CASTLE_CENTER.y) <= radius;
    ctx.save();
    ctx.strokeStyle = strong ? 'rgba(255, 244, 200, 0.95)' : 'rgba(255, 250, 225, 0.55)';
    ctx.lineWidth = strong ? 2.2 : 1.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    const r = Math.ceil(radius) + 1;
    for (let y = CASTLE_CENTER.y - r; y <= CASTLE_CENTER.y + r; y++) {
        for (let x = CASTLE_CENTER.x - r; x <= CASTLE_CENTER.x + r; x++) {
            if (!inside(x, y)) continue;
            const z = Math.max(0, tileElev(x, y)) * ELEV_PX;
            const top = [(x - y) * HW, (x + y) * HH - z];
            const rightP = [top[0] + HW, top[1] + HH];
            const bottom = [top[0], top[1] + TILE_H];
            const leftP = [top[0] - HW, top[1] + HH];
            const edge = (a, b) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
            if (!inside(x, y - 1)) edge(top, rightP);
            if (!inside(x + 1, y)) edge(rightP, bottom);
            if (!inside(x, y + 1)) edge(bottom, leftP);
            if (!inside(x - 1, y)) edge(leftP, top);
        }
    }
    ctx.stroke();
    ctx.restore();
}

// ---------- Peças ----------

function variantOf(x, y) {
    return Math.floor(hash2(x, y, 77) * 6);
}

function roofOf(b) {
    return b.owner === 'player' ? PLAYER_ROOF : b.roof;
}

function drawBuilding(b, wx, wy, t) {
    const kind = b.kind;
    const variant = variantOf(b.x, b.y);
    const roof = roofOf(b);
    let key;
    let opts;
    if (kind === 'castle') {
        key = `castle|${game.castleLevel}`;
        opts = { level: game.castleLevel };
    } else if (kind === 'field') {
        const growth = b.stage === 'growing' ? Math.min(5, Math.floor(b.growth * 6)) / 6 : 0;
        key = `field|${b.stage}|${growth}`;
        opts = { stage: b.stage, growth };
    } else {
        key = `${kind}|${roof}|${kind === 'house' ? variant : 0}`;
        opts = { roof, variant };
    }
    stamp(ctx, key, kind, opts, wx, wy);
    const live = LIVE[kind];
    if (live) {
        ctx.save();
        ctx.translate(wx, wy);
        live(ctx, b, t, opts);
        ctx.restore();
    }
}

function drawFeature(feature, x, y, wx, wy, t) {
    if (feature === 'tree') {
        const variant = Math.floor(hash2(x, y, 11) * 4);
        const tint = Math.round(hash2(x, y, 12) * 2) / 2;
        const jx = (hash2(x, y, 13) - 0.5) * 10;
        const jy = (hash2(x, y, 14) - 0.5) * 5;
        stamp(ctx, `tree|${variant}|${tint}`, 'tree', { variant, tint }, wx + jx, wy + jy);
    } else if (feature === 'rock') {
        const variant = Math.floor(hash2(x, y, 15) * 3);
        stamp(ctx, `rock|${variant}`, 'rock', { variant }, wx, wy);
    } else if (feature === 'ore') {
        stamp(ctx, 'ore', 'ore', {}, wx, wy);
        ctx.save();
        ctx.translate(wx, wy);
        LIVE.ore(ctx, null, t, { seed: hash2(x, y, 16) });
        ctx.restore();
    }
}

function drawGhost(x, y, wx, wy, ok) {
    const kind = ui.placing;
    ctx.save();
    tilePath(x, y, 0.02);
    ctx.fillStyle = ok ? 'rgba(126, 217, 87, 0.55)' : 'rgba(235, 87, 87, 0.5)';
    ctx.fill();
    ctx.globalAlpha = ok ? 0.8 : 0.45;
    const opts = kind === 'field' ? { stage: 'empty', growth: 0 } : { roof: PLAYER_ROOF, variant: 0 };
    stamp(ctx, `${kind}|ghost`, kind, opts, wx, wy);
    ctx.restore();
}

// ---------- Efeitos em coordenadas de mundo ----------

function drawCaravan(c, t) {
    const gx = c.ax + (c.bx - c.ax) * c.t;
    const gy = c.ay + (c.by - c.ay) * c.t;
    const w = gridToWorld(gx, gy);
    const dir = Math.sign((c.bx - c.by) - (c.ax - c.ay)) || 1;
    const bob = Math.sin(t * 12 + c.ax) * 0.8;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(20, 40, 10, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cavalo.
    ctx.fillStyle = '#7b5536';
    ctx.fillRect(6, -9 + bob, 9, 5);
    ctx.fillRect(13, -13 + bob, 3, 6);
    ctx.fillRect(7, -4 + bob, 1.6, 5);
    ctx.fillRect(13, -4 + bob, 1.6, 5);
    // Carroça com toldo.
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(-12, -8, 16, 6);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(-4, -9, 8, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3b2a18';
    ctx.beginPath();
    ctx.arc(-9, -1, 2.6, 0, Math.PI * 2);
    ctx.arc(1, -1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawPuffs(dt) {
    for (const p of fx.puffs) {
        p.t += dt;
        const w = gridToWorld(p.gx, p.gy);
        const k = p.t / 0.8;
        const spread = (p.big ? 60 : 28) * k;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.fillStyle = `rgba(236, 226, 205, ${0.7 * (1 - k)})`;
            ctx.beginPath();
            ctx.arc(w.x + Math.cos(a) * spread, w.y + Math.sin(a) * spread * 0.5 - 6, 6 + k * 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    fx.puffs = fx.puffs.filter((p) => p.t < 0.8);
}

/** Sombras das nuvens a passar por cima do tabuleiro. */
function drawCloudShadows(t) {
    ctx.fillStyle = 'rgba(20, 50, 40, 0.045)';
    for (let i = 0; i < 4; i++) {
        const gx = ((t * 0.18 + i * 13) % (MAP_SIZE + 16)) - 8;
        const gy = (hash2(i, 9, 3) * MAP_SIZE + t * 0.05) % MAP_SIZE;
        const w = gridToWorld(gx, gy);
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, 150, 60, 0, 0, Math.PI * 2);
        ctx.ellipse(w.x + 80, w.y - 20, 90, 40, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------- Balões e números (ecrã) ----------

const STATUS_ICON = { noWorkers: '💤', full: '📦', paused: '⏸️' };

function statusIcon(b) {
    if (b.kind === 'field') return b.stage === 'ripe' ? '🌾' : null;
    const def = BUILDING[b.kind];
    if (b.status === 'noInput') {
        const need = Object.keys(def.recipe?.in || {}).find((res) => game.res[res] < def.recipe.in[res]);
        return need ? RESOURCE[need].emoji : '❔';
    }
    if (b.status === 'noNear') return def.near?.feature === 'rock' ? '🪨' : '🌲';
    return STATUS_ICON[b.status] || null;
}

function drawBubble(sx, sy, icon, t, ripe) {
    const r = 12;
    const bob = ripe ? Math.sin(t * 4) * 2.5 : 0;
    const y = sy - bob;
    ctx.fillStyle = ripe ? 'rgba(255, 246, 214, 0.96)' : 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = ripe ? '#e0a92e' : 'rgba(40, 50, 60, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, y, r, 0, Math.PI * 2);
    ctx.moveTo(sx - 4, y + r - 1);
    ctx.lineTo(sx, y + r + 5);
    ctx.lineTo(sx + 4, y + r - 1);
    ctx.fill();
    ctx.stroke();
    ctx.font = `13px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#222';
    ctx.fillText(icon, sx, y + 1);
}

function drawScreenOverlays(dt, t) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    if (game.phase === 'playing' && camera.zoom > 0.6) {
        for (const b of game.buildings) {
            const icon = statusIcon(b);
            if (!icon) continue;
            const e = Math.max(0, tileElev(b.x, b.y));
            const w = gridToWorld(b.x + 0.5, b.y + 0.5, e);
            const s = worldToScreen(w.x, w.y - (b.kind === 'field' ? 20 : 48));
            if (s.x < -20 || s.y < -20 || s.x > view.width + 20 || s.y > view.height + 20) continue;
            drawBubble(s.x, s.y, icon, t, b.kind === 'field');
        }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 14px ${FONT_DISPLAY}`;
    ctx.lineJoin = 'round';
    for (const f of fx.floats) {
        f.t += dt;
        const k = f.t / 1.6;
        const w = gridToWorld(f.gx, f.gy, Math.max(0, tileElev(Math.floor(f.gx), Math.floor(f.gy))));
        const s = worldToScreen(w.x, w.y);
        const y = s.y - 40 * camera.zoom - k * 34;
        ctx.globalAlpha = Math.min(1, 2 * (1 - k));
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(30, 30, 20, 0.7)';
        ctx.strokeText(f.text, s.x, y);
        ctx.fillStyle = '#fff6d6';
        ctx.fillText(f.text, s.x, y);
    }
    ctx.globalAlpha = 1;
    fx.floats = fx.floats.filter((f) => f.t < 1.6);
}

// ---------- Frame ----------

export function render(dt) {
    if (!ctx || !game.world) return;
    const t = fx.time;
    camera.width = view.width;
    camera.height = view.height;

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawSky(t);

    const z = camera.zoom * view.dpr;
    ctx.setTransform(z, 0, 0, z,
        view.dpr * (view.width / 2 - camera.x * camera.zoom),
        view.dpr * (view.height / 2 - camera.y * camera.zoom));
    setSpriteScale(z);

    const detail = camera.zoom > 0.7;
    const okMap = ui.placing ? placementMap() : null;

    // Limites de desenho em mundo: o ecrã mais uma folga (as peças sobem acima da casa).
    const halfW = view.width / 2 / camera.zoom + TILE_W;
    const top = camera.y - view.height / 2 / camera.zoom - TILE_H * 2;
    const bottom = camera.y + view.height / 2 / camera.zoom + 220;
    const leftX = camera.x - halfW;
    const rightX = camera.x + halfW;

    const hover = ui.placing ? ui.hover : null;
    const selected = ui.selected;

    for (let s = 0; s <= (MAP_SIZE - 1) * 2; s++) {
        const wy = (s + 1) * HH;
        if (wy < top - ELEV_PX * 2 || wy - SLAB_PX > bottom) continue;
        const x0 = Math.max(0, s - MAP_SIZE + 1);
        const x1 = Math.min(MAP_SIZE - 1, s);
        for (let x = x0; x <= x1; x++) {
            const y = s - x;
            const wx = (x - y) * HW;
            if (wx < leftX || wx > rightX) continue;

            drawGround(x, y, t, detail);
            if (okMap) drawTileOverlay(x, y, okMap);
            if (selected && selected.x === x && selected.y === y) {
                tilePath(x, y, 0.03);
                ctx.strokeStyle = '#ffd766';
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }

            const i = idx(x, y);
            const e = Math.max(0, game.world.elev[i]);
            const gy = wy - e * ELEV_PX;
            const b = game.world.building[i];
            if (b) {
                // Um edifício de 2x2 desenha-se na sua casa da frente, a última a ser pintada.
                if (b.size === 2) {
                    if (x === b.x + 1 && y === b.y + 1) {
                        const cw = gridToWorld(b.x + 1, b.y + 1);
                        drawBuilding(b, cw.x, cw.y, t);
                    }
                } else {
                    drawBuilding(b, wx, gy, t);
                }
            } else if (hover && hover.x === x && hover.y === y) {
                drawGhost(x, y, wx, gy, okMap?.[i]);
            } else if (game.world.feature[i]) {
                drawFeature(game.world.feature[i], x, y, wx, gy, t);
            }
            if (hover && hover.x === x && hover.y === y && b) drawGhost(x, y, wx, gy, false);
        }
    }

    if (game.phase === 'playing') drawTerritoryBorder(!!ui.placing);
    for (const c of fx.caravans) drawCaravan(c, t);
    drawPuffs(dt);
    drawCloudShadows(t);

    drawScreenOverlays(dt, t);
}
