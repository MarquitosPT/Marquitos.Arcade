// O desenho de cada frame: céu, tabuleiro, peças, efeitos e balões.
//
// O tabuleiro é desenhado de trás para a frente, diagonal a diagonal (x + y
// crescente) — o "algoritmo do pintor" da perspetiva isométrica. Em cada casa
// pinta-se primeiro o chão (com os lados, se estiver mais alta do que a casa
// da frente) e logo a seguir o que está em cima dela. Assim uma colina à
// frente tapa o que está atrás dela, e uma árvore nunca fica por baixo da relva
// da casa seguinte. Um edifício ocupa um bloco de casas e desenha-se na casa
// da frente do bloco, a última dele a ser pintada; as estradas pintam-se logo
// a seguir ao chão, e a gente que anda nelas depois do que está na casa.
//
// O contexto trabalha em coordenadas de mundo: a câmara (centro e zoom) e o
// devicePixelRatio vão numa só transformação no início do frame. Os balões e os
// números a subir desenham-se no fim, em coordenadas de ecrã, para terem o
// mesmo tamanho em qualquer zoom.

import {
    BUILDING, ELEV_PX, FONT_BODY, FONT_DISPLAY, MAP_SIZE, RESOURCE, SLAB_PX, TILE_H, TILE_W
} from './config.js';
import { canRoad, checkPlacement, flattenBlock, inTerritory } from './buildings.js';
import { camera, gridToWorld, worldToScreen } from './iso.js';
import { hash2 } from './rng.js';
import { setSpriteScale, stamp } from './sprite-cache.js';
import { LIVE, PLAYER_ROOF } from './sprites.js';
import { castleInfo, fx, game, ui } from './state.js';
import { walkerAlpha, walkerPlace } from './walkers.js';
import { CASTLE_CENTER, ROAD_PLAYER, T_GRASS, T_HILL, T_MEADOW, T_SAND, T_WATER, idx, inMap } from './world.js';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

/** O contexto onde se desenha: o do ecrã, ou o de um bloco do chão enquanto se pinta (ver "Chão em blocos"). */
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
    const bucket = Math.round(tint * 12);
    const key = terrain * 20 + bucket;
    let color = tileColorCache.get(key);
    if (!color) {
        const [h, s, l] = GROUND[terrain];
        color = `hsl(${h}, ${s}%, ${l + (bucket - 6) * 0.65}%)`;
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
    // Como no tampo: um traço da mesma cor tapa a frincha entre lados vizinhos.
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();
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

/** Reflexos que vão e vêm na água. Não vão para a cache do chão: mexem-se. */
function drawWaterShimmer(x, y, t) {
    const i = idx(x, y);
    const phase = (t * 0.6 + game.world.tint[i] * 5 + hash2(x, y, 4) * 3) % 2;
    if (phase >= 1) return;
    const tx = (x - y) * HW;
    const ty = (x + y) * HH - game.world.elev[i] * ELEV_PX;
    const a = Math.sin(phase * Math.PI) * 0.55;
    ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
    ctx.lineWidth = 1.2;
    const ox = (hash2(x, y, 3) - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(tx + ox - 4, ty + HH + 1);
    ctx.lineTo(tx + ox + 4, ty + HH + 1);
    ctx.stroke();
}

function drawGround(x, y, t, detail) {
    drawTile(x, y, t, detail);
    if (game.world.road[idx(x, y)]) drawRoad(x, y, detail);
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
    // Sem juntas entre as peças: um traço da própria cor tapa a frincha que o
    // antialiasing deixa entre dois losangos vizinhos.
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    if (!detail || water) return;

    if (terrain === T_MEADOW) {
        const colors = ['#fff6c8', '#f7a9c4', '#fde68a'];
        for (let k = 0; k < 3; k++) {
            if (hash2(x, y, 30 + k) < 0.45) continue;
            const u = hash2(x, y, 40 + k) - 0.5;
            const v = hash2(x, y, 50 + k) - 0.5;
            ctx.fillStyle = colors[k];
            ctx.fillRect(tx + (u - v) * HW * 0.9, ty + HH + (u + v) * HH * 0.9, 2, 2);
        }
    } else if (terrain === T_GRASS && hash2(x, y, 60) < 0.16) {
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

// ---------- Território e modo de construção ----------

/**
 * Mapa das casas onde cabe o que se está a construir, refeito só quando algo
 * muda. Para um edifício, uma casa fica verde se algum bloco válido a cobre;
 * para uma estrada, se lá se pode abrir estrada.
 */
const placement = { key: '', ok: null };

function placementMap() {
    const kind = ui.placing;
    const key = `${kind}|${game.buildings.length}|${game.castleLevel}|${game.planted.length}|${game.flattened.length}|${game.roadsVersion}|${Math.floor(fx.time * 2)}`;
    if (placement.key === key) return placement.ok;
    placement.key = key;
    const ok = new Uint8Array(MAP_SIZE * MAP_SIZE);
    placement.ok = ok;
    if (kind === 'road') {
        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) if (canRoad(x, y)) ok[idx(x, y)] = 1;
        }
        return ok;
    }
    const radius = castleInfo().radius + 2;
    for (let y = Math.max(0, Math.floor(CASTLE_CENTER.y - radius)); y < Math.min(MAP_SIZE - 1, CASTLE_CENTER.y + radius); y++) {
        for (let x = Math.max(0, Math.floor(CASTLE_CENTER.x - radius)); x < Math.min(MAP_SIZE - 1, CASTLE_CENTER.x + radius); x++) {
            if (!checkPlacement(kind, x, y, { ignoreCost: true }).ok) continue;
            ok[idx(x, y)] = ok[idx(x + 1, y)] = ok[idx(x, y + 1)] = ok[idx(x + 1, y + 1)] = 1;
        }
    }
    return ok;
}

/** Caminho do losango de um bloco de casas (canto de cima em x, y), ao nível `z` px, encolhido `inset` casas. */
function blockPath(x, y, size, z, inset = 0) {
    const p = (gx, gy) => [(gx - gy) * HW, (gx + gy) * HH - z];
    const a = p(x + inset, y + inset);
    const b = p(x + size - inset, y + inset);
    const c = p(x + size - inset, y + size - inset);
    const d = p(x + inset, y + size - inset);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
}

function tilePath(x, y, inset = 0) {
    blockPath(x, y, 1, Math.max(0, tileElev(x, y)) * ELEV_PX, inset);
}

function drawTileOverlay(x, y, okMap) {
    tilePath(x, y, 0.03);
    if (okMap[idx(x, y)]) {
        ctx.fillStyle = 'rgba(126, 217, 87, 0.28)';
        ctx.fill();
    } else if (!inTerritory(x, y)) {
        ctx.fillStyle = 'rgba(10, 20, 30, 0.16)';
        ctx.fill();
    }
}

// ---------- Estradas ----------

const hasRoad = (x, y) => inMap(x, y) && game.world.road[idx(x, y)] !== 0;

/**
 * Um troço de estrada de pedra. É um retângulo da grelha, encolhido dos lados
 * onde não há estrada ao lado e encostado à aresta onde há: os troços vizinhos
 * juntam-se sem costura e as curvas saem sozinhas.
 */
function drawRoad(x, y, detail) {
    const town = game.world.road[idx(x, y)] !== ROAD_PLAYER;
    const ins = 0.14;
    const x0 = x + (hasRoad(x - 1, y) ? 0 : ins);
    const x1 = x + 1 - (hasRoad(x + 1, y) ? 0 : ins);
    const y0 = y + (hasRoad(x, y - 1) ? 0 : ins);
    const y1 = y + 1 - (hasRoad(x, y + 1) ? 0 : ins);
    const p = (gx, gy) => [(gx - gy) * HW, (gx + gy) * HH];
    const pts = [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fillStyle = town ? '#b3a58c' : '#c2b69c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(92, 78, 52, 0.28)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    if (!detail) return;
    // As pedras da calçada: quatro por casa, com um pouco de acaso na cor.
    for (let k = 0; k < 4; k++) {
        const gx = x + 0.28 + (k % 2) * 0.44 + (hash2(x, y, 90 + k) - 0.5) * 0.1;
        const gy = y + 0.28 + Math.floor(k / 2) * 0.44 + (hash2(x, y, 94 + k) - 0.5) * 0.1;
        if (gx < x0 + 0.08 || gx > x1 - 0.08 || gy < y0 + 0.08 || gy > y1 - 0.08) continue;
        const [px, py] = p(gx, gy);
        const shade = hash2(x, y, 98 + k);
        ctx.fillStyle = shade < 0.33 ? '#d8cfbb' : shade < 0.66 ? '#aa9c80' : '#b9ac92';
        ctx.beginPath();
        ctx.ellipse(px, py, 3.4, 1.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** A estrada que se vai abrir, a tracejado, antes de se confirmar. */
function drawRoadPreview() {
    const path = ui.roadPreview;
    if (!path?.length) return;
    ctx.save();
    for (const c of path) {
        tilePath(c.x, c.y, 0.08);
        ctx.fillStyle = ui.roadPreviewOk ? 'rgba(250, 240, 210, 0.6)' : 'rgba(235, 87, 87, 0.45)';
        ctx.fill();
    }
    ctx.restore();
}

// ---------- Gente ----------

function drawWalker(w, t) {
    const { gx, gy, facing } = walkerPlace(w);
    const [x, y] = [(gx - gy) * HW, (gx + gy) * HH];
    const alpha = walkerAlpha(w);
    if (alpha <= 0) return;
    const moving = w.pos < w.path.length - 1;
    const swing = moving ? Math.sin((t + w.seed) * 11) * 1.4 : 0;
    const bob = moving ? Math.abs(Math.sin((t + w.seed) * 11)) * 0.6 : 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = 'rgba(20, 40, 10, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pernas.
    ctx.strokeStyle = '#3a2e24';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-0.6, -3.6 - bob);
    ctx.lineTo(-0.6 + swing, 0);
    ctx.moveTo(0.6, -3.6 - bob);
    ctx.lineTo(0.6 - swing, 0);
    ctx.stroke();
    // Corpo, cabeça e cabelo.
    ctx.fillStyle = w.shirt;
    ctx.beginPath();
    ctx.roundRect(-1.8, -8.2 - bob, 3.6, 5, 1.2);
    ctx.fill();
    ctx.fillStyle = w.skin;
    ctx.beginPath();
    ctx.arc(0, -9.8 - bob, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.hair;
    ctx.beginPath();
    ctx.arc(0, -10.3 - bob, 1.6, Math.PI, 0);
    ctx.fill();
    if (w.load) {
        // Um saco às costas.
        ctx.fillStyle = '#c9a36b';
        ctx.beginPath();
        ctx.ellipse(-2.2, -6.6 - bob, 1.6, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
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
        const jx = (hash2(x, y, 13) - 0.5) * 6;
        const jy = (hash2(x, y, 14) - 0.5) * 3;
        const k = 0.6 + Math.round(hash2(x, y, 17) * 3) * 0.04;
        stamp(ctx, `tree|${variant}|${tint}`, 'tree', { variant, tint }, wx + jx, wy + jy, k);
    } else if (feature === 'rock') {
        const variant = Math.floor(hash2(x, y, 15) * 3);
        stamp(ctx, `rock|${variant}`, 'rock', { variant }, wx, wy, 0.55);
    } else if (feature === 'ore') {
        stamp(ctx, 'ore', 'ore', {}, wx, wy, 0.55);
        ctx.save();
        ctx.translate(wx, wy);
        ctx.scale(0.55, 0.55);
        LIVE.ore(ctx, null, t, { seed: hash2(x, y, 16) });
        ctx.restore();
    }
}

/** O edifício a construir, por cima do bloco onde ficaria (canto de cima em x, y). */
function drawGhost(x, y, ok) {
    const kind = ui.placing;
    const z = Math.max(0, tileElev(x + 1, y + 1)) * ELEV_PX;
    const center = gridToWorld(x + 1, y + 1);
    const wx = center.x;
    const wy = center.y - z;
    ctx.save();
    blockPath(x, y, 2, z, 0.02);
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
            const w = gridToWorld(b.x + b.size / 2, b.y + b.size / 2, e);
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

// ---------- Chão em blocos ----------
//
// O chão (relva, lados, estradas) não mexe de um frame para o outro,
// e são milhares de casas: pintá-lo todo a cada frame pesava mais do que o
// resto junto. Por isso o mapa é cortado em blocos de CHUNK x CHUNK casas, e
// cada bloco é pintado uma vez numa imagem à parte, à escala do ecrã. Só se
// repinta quando muda o que tem dentro — a assinatura soma o terreno, o relevo
// e as estradas das casas dele — ou quando muda a escala; enquanto espera a
// vez, mostra-se a imagem velha esticada. Os blocos compõem-se de trás para a
// frente, como as casas; o que uma casa pinta fora do seu losango (os lados,
// o tampo de uma colina) cabe na margem da imagem do bloco.
//
// A troca: com o chão todo por baixo, uma árvore logo atrás de uma colina já
// não fica com o pé tapado pela aresta dela — são 7 píxeis, não se nota.

const CHUNK = 11;
const CHUNKS = Math.ceil(MAP_SIZE / CHUNK);
const CHUNK_MARGIN_TOP = ELEV_PX * 2 + 8;
const CHUNK_MARGIN_BOTTOM = SLAB_PX + 16;
const CHUNK_MARGIN_SIDE = 4;
/** Blocos repintados por frame, fora os que ainda não têm imagem nenhuma. */
const CHUNK_BUDGET = 4;
/** Um bloco que não se vê há tantos frames larga a imagem (a memória conta, num telemóvel). */
const CHUNK_FORGET_FRAMES = 180;
const chunkCache = new Map();
let frameNo = 0;

function chunkBounds(cx, cy) {
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const x1 = Math.min(MAP_SIZE, x0 + CHUNK);
    const y1 = Math.min(MAP_SIZE, y0 + CHUNK);
    return {
        x0, y0, x1, y1,
        left: (x0 - y1) * HW - CHUNK_MARGIN_SIDE,
        right: (x1 - y0) * HW + CHUNK_MARGIN_SIDE,
        top: (x0 + y0) * HH - CHUNK_MARGIN_TOP,
        bottom: (x1 + y1) * HH + CHUNK_MARGIN_BOTTOM
    };
}

/** Uma impressão digital do que o bloco tem, mais uma casa à volta (os lados e as juntas das estradas dependem dos vizinhos). */
function chunkSignature(b, detail) {
    const w = game.world;
    let sig = (w.seed | 0) ^ (detail ? 0x5bd1e995 : 0);
    for (let y = Math.max(0, b.y0 - 1); y < Math.min(MAP_SIZE, b.y1 + 1); y++) {
        for (let x = Math.max(0, b.x0 - 1); x < Math.min(MAP_SIZE, b.x1 + 1); x++) {
            const i = idx(x, y);
            sig = (Math.imul(sig, 31) + w.terrain[i] * 7 + (w.elev[i] + 1) * 3 + w.road[i] * 17) | 0;
        }
    }
    return sig;
}

function paintChunk(entry, b, scale, detail) {
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const width = Math.ceil(w * scale);
    const height = Math.ceil(h * scale);
    if (!entry.canvas || entry.canvas.width !== width || entry.canvas.height !== height) {
        entry.canvas = document.createElement('canvas');
        entry.canvas.width = width;
        entry.canvas.height = height;
    }
    const g = entry.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width, height);
    g.setTransform(scale, 0, 0, scale, -b.left * scale, -b.top * scale);
    const screen = ctx;
    ctx = g;
    for (let s = b.x0 + b.y0; s <= b.x1 + b.y1 - 2; s++) {
        for (let x = Math.max(b.x0, s - b.y1 + 1); x <= Math.min(b.x1 - 1, s - b.y0); x++) {
            drawGround(x, s - x, 0, detail);
        }
    }
    ctx = screen;
    entry.scale = scale;
    entry.detail = detail;
}

/** Compõe os blocos de chão à vista, de trás para a frente. */
function drawGroundChunks(view, detail) {
    frameNo++;
    // O chão pinta-se à escala exata do ecrã (e não aos degraus das peças):
    // assim cada bloco vai para o ecrã pixel a pixel, sem ser reamostrado —
    // compor dezenas de imagens grandes reamostradas custava mais do que o resto.
    const scale = ctx.getTransform().a;
    let budget = CHUNK_BUDGET;
    for (let s = 0; s <= (CHUNKS - 1) * 2; s++) {
        for (let cx = Math.max(0, s - CHUNKS + 1); cx <= Math.min(CHUNKS - 1, s); cx++) {
            const cy = s - cx;
            const b = chunkBounds(cx, cy);
            if (b.right < view.left || b.left > view.right || b.bottom < view.top || b.top > view.bottom) continue;
            const key = cy * CHUNKS + cx;
            let entry = chunkCache.get(key);
            if (!entry) {
                entry = { canvas: null, scale: 0, sig: 0, detail: detail };
                chunkCache.set(key, entry);
            }
            const sig = chunkSignature(b, detail);
            const stale = entry.scale !== scale || entry.sig !== sig || entry.detail !== detail;
            // Um bloco sem imagem pinta-se já; um que só está desatualizado espera
            // pela sua vez e, entretanto, mostra-se a imagem velha esticada.
            if (!entry.canvas || (stale && budget > 0)) {
                if (entry.canvas) budget--;
                paintChunk(entry, b, scale, detail);
                entry.sig = sig;
            }
            entry.used = frameNo;
            if (entry.scale === scale) {
                // À escala certa, a imagem vai pixel a pixel, sem ser reamostrada.
                const m = ctx.getTransform();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(entry.canvas, Math.round(m.a * b.left + m.e), Math.round(m.d * b.top + m.f));
                ctx.setTransform(m);
            } else {
                ctx.drawImage(entry.canvas, b.left, b.top, b.right - b.left, b.bottom - b.top);
            }
        }
    }
    if (frameNo % 60 === 0) {
        for (const [key, entry] of chunkCache) {
            if (frameNo - entry.used > CHUNK_FORGET_FRAMES) chunkCache.delete(key);
        }
    }
}

/** A moldura dourada da casa escolhida: o bloco inteiro de um edifício, ou o bloco que se aplana numa colina. */
function drawSelection() {
    const sel = ui.selected;
    if (!sel || !inMap(sel.x, sel.y)) return;
    const b = game.world.building[idx(sel.x, sel.y)];
    let x = sel.x;
    let y = sel.y;
    let size = 1;
    if (b) {
        ({ x, y, size } = b);
    } else if (game.world.terrain[idx(sel.x, sel.y)] === T_HILL) {
        ({ x, y } = flattenBlock(sel.x, sel.y));
        size = 2;
    }
    const z = Math.max(0, tileElev(sel.x, sel.y)) * ELEV_PX;
    ctx.save();
    blockPath(x, y, size, z, 0.03);
    ctx.strokeStyle = '#ffd766';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
}

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

    // O fantasma do edifício a construir desenha-se na casa da frente do bloco.
    const hover = ui.placing && ui.placing !== 'road' ? ui.hover : null;
    const hoverOk = hover ? checkPlacement(ui.placing, hover.x, hover.y, { ignoreCost: true }).ok : false;

    // A gente na rua, arrumada pela casa onde se desenha.
    const walkersAt = new Map();
    for (const w of fx.walkers) {
        const { cell } = walkerPlace(w);
        const i = idx(cell.x, cell.y);
        if (!walkersAt.has(i)) walkersAt.set(i, []);
        walkersAt.get(i).push(w);
    }

    drawGroundChunks({ left: leftX, right: rightX, top: top - ELEV_PX * 2, bottom }, detail);

    for (let s = 0; s <= (MAP_SIZE - 1) * 2; s++) {
        const wy = (s + 1) * HH;
        if (wy < top - ELEV_PX * 2 || wy - SLAB_PX > bottom) continue;
        const x0 = Math.max(0, s - MAP_SIZE + 1);
        const x1 = Math.min(MAP_SIZE - 1, s);
        for (let x = x0; x <= x1; x++) {
            const y = s - x;
            const wx = (x - y) * HW;
            if (wx < leftX || wx > rightX) continue;

            if (detail && game.world.terrain[idx(x, y)] === T_WATER) drawWaterShimmer(x, y, t);
            if (okMap) drawTileOverlay(x, y, okMap);

            const i = idx(x, y);
            const e = Math.max(0, game.world.elev[i]);
            const gy = wy - e * ELEV_PX;
            const b = game.world.building[i];
            if (b) {
                // Um edifício desenha-se na casa da frente do seu bloco, a última a ser pintada.
                if (x === b.x + b.size - 1 && y === b.y + b.size - 1) {
                    const cw = gridToWorld(b.x + b.size / 2, b.y + b.size / 2, e);
                    drawBuilding(b, cw.x, cw.y, t);
                }
            } else if (game.world.feature[i]) {
                drawFeature(game.world.feature[i], x, y, wx, gy, t);
            }
            const people = walkersAt.get(i);
            if (people) for (const w of people) drawWalker(w, t);
            if (hover && x === hover.x + 1 && y === hover.y + 1) drawGhost(hover.x, hover.y, hoverOk);
        }
    }

    if (ui.placing === 'road') drawRoadPreview();
    drawSelection();
    if (game.phase === 'playing') drawTerritoryBorder(!!ui.placing);
    for (const c of fx.caravans) drawCaravan(c, t);
    drawPuffs(dt);
    drawCloudShadows(t);

    drawScreenOverlays(dt, t);
}
