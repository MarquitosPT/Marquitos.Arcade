// O desenho de cada frame: céu, tabuleiro, peças, efeitos e balões.
//
// O tabuleiro é desenhado de trás para a frente, diagonal a diagonal (x + y
// crescente) — o "algoritmo do pintor" da perspetiva isométrica. A frente e o
// trás são os da vista, que pode estar rodada (ver iso.js): as diagonais
// percorrem-se na grelha da vista e cada casa dela diz a casa do mapa que lá
// está. Em cada casa pinta-se primeiro o chão (com os lados, se estiver mais
// alta do que a casa da frente) e logo a seguir o que está em cima dela. Assim
// uma colina à frente tapa o que está atrás dela, e uma árvore nunca fica por
// baixo da relva da casa seguinte. Um edifício ocupa um bloco de casas e desenha-se na casa
// da frente do bloco, a última dele a ser pintada; as estradas pintam-se logo
// a seguir ao chão, e a gente que anda nelas depois do que está na casa.
//
// O contexto trabalha em coordenadas de mundo: a câmara (centro e zoom) e o
// devicePixelRatio vão numa só transformação no início do frame. Os balões e os
// números a subir desenham-se no fim, em coordenadas de ecrã, para terem o
// mesmo tamanho em qualquer zoom.

import {
    BUILDING, ELEV_PX, FONT_BODY, FONT_DISPLAY, MAP_SIZE, NEAR_FEATURES, RESOURCE, SLAB_PX, TILE_H, TILE_W
} from './config.js';
import { canRoad, checkPlacement, flattenBlock, inTerritory, isCrop } from './buildings.js';
import {
    blockFront, camera, cellToView, gridToWorld, viewToCell, viewToWorld, worldToScreen
} from './iso.js';
import { hash2 } from './rng.js';
import { setSpriteScale, stamp } from './sprite-cache.js';
import { HOUSE_VARIANTS, LIVE, MOUNTAIN_VARIANTS, PLAYER_ROOF } from './sprites.js';
import { castleInfo, fx, game, ui } from './state.js';
import { CATCH_SECONDS, boatAlpha, boatPlace } from './boats.js';
import { walkerAlpha, walkerPlace } from './walkers.js';
import {
    CASTLE_CENTER, ROAD_PLAYER, T_GRASS, T_HILL, T_MEADOW, T_SAND, T_WATER, idx, inMap, shoreSide
} from './world.js';

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

/** Relevo da casa (vx, vy) da vista; fora do mapa é o fundo da placa de terra. */
function viewElev(vx, vy) {
    if (vx >= MAP_SIZE || vy >= MAP_SIZE) return -SLAB_PX / ELEV_PX - 0.6;
    const c = viewToCell(vx, vy);
    return tileElev(c.x, c.y);
}

function drawSide(a, b, zTop, zBottom, color, lip) {
    // Face vertical entre os pontos de mundo a e b (ao nível do chão).
    const { x: ax, y: ay } = a;
    const { x: bx, y: by } = b;
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
    const c = gridToWorld(x + 0.5, y + 0.5, game.world.elev[i]);
    const a = Math.sin(phase * Math.PI) * 0.55;
    ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
    ctx.lineWidth = 1.2;
    const ox = (hash2(x, y, 3) - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(c.x + ox - 4, c.y + 1);
    ctx.lineTo(c.x + ox + 4, c.y + 1);
    ctx.stroke();
}

/** O chão da casa (x, y) do mapa, que na vista é a casa (vx, vy). */
function drawGround(x, y, vx, vy, detail) {
    drawTile(x, y, vx, vy, detail);
    if (game.world.road[idx(x, y)]) drawRoad(x, y, detail);
}

function drawTile(x, y, vx, vy, detail) {
    const i = idx(x, y);
    const terrain = game.world.terrain[i];
    const e = game.world.elev[i];
    const z = e * ELEV_PX;
    const water = terrain === T_WATER;

    // Lados: só onde a casa da frente (na vista) é mais baixa. A luz vem
    // sempre da esquerda do ecrã, rode a vista para onde rodar.
    const left = viewElev(vx, vy + 1);
    if (left < e) {
        const bottom = left * ELEV_PX;
        const a = viewToWorld(vx, vy + 1);
        const b = viewToWorld(vx + 1, vy + 1);
        drawSide(a, b, z, bottom, water ? '#2f6f9e' : '#8a5a35', water ? null : '#5d9a3a');
        if (vy + 1 >= MAP_SIZE) {
            // A placa de terra: um veio mais escuro a meio, como as camadas do solo.
            drawSide(a, b, z - 10, z - 13, 'rgba(60, 35, 18, 0.35)');
        }
    }
    const right = viewElev(vx + 1, vy);
    if (right < e) {
        const bottom = right * ELEV_PX;
        const a = viewToWorld(vx + 1, vy + 1);
        const b = viewToWorld(vx + 1, vy);
        drawSide(a, b, z, bottom, water ? '#27608a' : '#6e4528', water ? null : '#4f8a31');
        if (vx + 1 >= MAP_SIZE) drawSide(a, b, z - 10, z - 13, 'rgba(40, 22, 10, 0.35)');
    }

    // Tampo.
    const top = viewToWorld(vx, vy);
    const tx = top.x;
    const ty = top.y - z;
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
            const f = gridToWorld(x + 0.5 + u * 0.9, y + 0.5 + v * 0.9);
            ctx.fillStyle = colors[k];
            ctx.fillRect(f.x, f.y - z, 2, 2);
        }
    } else if (terrain === T_GRASS && hash2(x, y, 60) < 0.16) {
        const u = hash2(x, y, 61) - 0.5;
        const v = hash2(x, y, 62) - 0.5;
        const g = gridToWorld(x + 0.5 + u * 0.8, y + 0.5 + v * 0.8);
        const px = g.x;
        const py = g.y - z;
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
    const p = (gx, gy) => {
        const w = gridToWorld(gx, gy);
        return [w.x, w.y - z];
    };
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
    const p = (gx, gy) => {
        const w = gridToWorld(gx, gy);
        return [w.x, w.y];
    };
    const pts = [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    // De perto, o fundo é a argamassa entre as pedras; de longe, a cor da calçada toda.
    ctx.fillStyle = detail ? (town ? '#9d8f75' : '#a99b80') : (town ? '#b3a58c' : '#c2b69c');
    ctx.fill();
    ctx.strokeStyle = 'rgba(92, 78, 52, 0.28)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    if (detail) drawCobbles(x, y, x0, x1, y0, y1, town, p);
}

const COBBLE_PLAYER = ['#d8cfbb', '#cdc1a6', '#c2b59a', '#b8aa8e', '#ddd3bf'];
const COBBLE_TOWN = ['#c9bea8', '#bcb09a', '#b0a38a', '#a69a82', '#cfc5b2'];

/**
 * Filas de pedras por casa (ao longo de y) e pedras por fila (ao longo de x).
 * A estrada é mais estreita do que a casa nos lados sem continuação: na
 * largura de um troço cabem 4 filas.
 */
const COBBLE_ROWS = 6;
const COBBLES_PER_ROW = 7;
/** A junta entre pedras, em casas da grelha. */
const COBBLE_GAP = 0.012;

/** Se a casa (x, y) se pinta depois da casa (nx, ny) na vista de agora. */
function paintedAfter(x, y, nx, ny) {
    const a = cellToView(x, y);
    const b = cellToView(nx, ny);
    return a.x + a.y > b.x + b.y;
}

/**
 * As pedras da calçada de um troço, em juntas desencontradas: filas ao longo
 * de x, cada uma desviada meia pedra da anterior. A grelha é a do mapa todo,
 * por isso o desenho continua de uma casa para a outra: a pedra que fica em
 * cima da junta entre dois troços pinta-a inteira a casa que se pinta depois
 * (o chão da outra já lá está por baixo); na ponta de uma estrada fica meia
 * pedra. As filas cortadas pela margem da estrada juntam-se à fila do lado.
 * Cada pedra é um polígono quase regular, de cor ao acaso (mas sempre a mesma
 * na mesma pedra).
 */
function drawCobbles(x, y, x0, x1, y0, y1, town, p) {
    const rowH = 1 / COBBLE_ROWS;
    const cell = 1 / COBBLES_PER_ROW;
    const palette = town ? COBBLE_TOWN : COBBLE_PLAYER;

    // As filas: as da grelha, cortadas à margem; uma tira fina junta-se à do lado.
    const rows = [];
    for (let k = 0; k < COBBLE_ROWS; k++) {
        const a = Math.max(y + k * rowH, y0);
        const b = Math.min(y + (k + 1) * rowH, y1);
        if (b - a > 1e-6) rows.push({ a, b, g: y * COBBLE_ROWS + k });
    }
    if (rows.length > 1 && rows[0].b - rows[0].a < rowH * 0.5) rows[1].a = rows.shift().a;
    const last = rows.length - 1;
    if (last > 0 && rows[last].b - rows[last].a < rowH * 0.5) rows[last - 1].b = rows.pop().b;

    const joinLeft = hasRoad(x - 1, y) && paintedAfter(x, y, x - 1, y);
    const joinRight = hasRoad(x + 1, y) && paintedAfter(x, y, x + 1, y);
    for (const row of rows) {
        const offset = (row.g & 1) * cell * 0.5;
        const pieces = [];
        for (let k = -1; k <= COBBLES_PER_ROW; k++) {
            const s0 = x + offset + k * cell;
            const s1 = s0 + cell;
            if (s1 <= x0 + 1e-6 || s0 >= x1 - 1e-6) continue;
            let a = Math.max(s0, x0);
            let b = Math.min(s1, x1);
            // Em cima da junta com outro troço: inteira, ou nada (pinta-a o vizinho).
            if (s0 < x0 - 1e-6 && x0 === x) {
                if (!joinLeft) continue;
                a = s0;
            }
            if (s1 > x1 + 1e-6 && x1 === x + 1) {
                if (!joinRight) continue;
                b = s1;
            }
            pieces.push({ a, b, col: Math.round((s0 - offset) * COBBLES_PER_ROW) });
        }
        // Uma lasca à margem da estrada junta-se à pedra do lado.
        if (pieces.length > 1 && pieces[0].b - pieces[0].a < cell * 0.4) pieces[1].a = pieces.shift().a;
        const end = pieces.length - 1;
        if (end > 0 && pieces[end].b - pieces[end].a < cell * 0.4) pieces[end - 1].b = pieces.pop().b;

        for (const piece of pieces) {
            let n = 0;
            const rnd = () => hash2(piece.col, row.g, 90 + n++);
            const cx = (piece.a + piece.b) / 2;
            const cy = (row.a + row.b) / 2;
            const rx = (piece.b - piece.a) / 2 - COBBLE_GAP;
            const ry = (row.b - row.a) / 2 - COBBLE_GAP;
            const sides = 8;
            const turn = Math.PI / sides + (rnd() - 0.5) * 0.2;
            ctx.beginPath();
            for (let k = 0; k < sides; k++) {
                // Um octógono quase regular que enche o retângulo da pedra.
                const ang = turn + (k / sides) * Math.PI * 2 + (rnd() - 0.5) * 0.16;
                const f = 0.96 + rnd() * 0.05;
                const c = Math.cos(ang);
                const s2 = Math.sin(ang);
                const m = Math.max(Math.abs(c), Math.abs(s2)) ** 0.8;
                const [px, py] = p(cx + (c / m) * rx * f, cy + (s2 / m) * ry * f);
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
            ctx.fill();
        }
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
    const { gx, gy, dx, dy } = walkerPlace(w);
    const { x, y } = gridToWorld(gx, gy);
    // Olha para o lado do ecrã para onde anda.
    const facing = gridToWorld(gx + dx, gy + dy).x >= x ? 1 : -1;
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

// ---------- Barcos ----------

/**
 * Um barco a remar ou a pescar. O casco desenha-se na grelha — proa e popa ao
 * longo da direção em que vai, bordos para os lados — e só depois se projeta:
 * assim encolhe com a perspetiva e roda com a vista sem contas à parte.
 */
function drawBoat(boat, t) {
    const alpha = boatAlpha(boat);
    if (alpha <= 0) return;
    const { gx, gy, dir } = boatPlace(boat);
    const len = Math.hypot(dir.x, dir.y) || 1;
    const ux = dir.x / len;
    const uy = dir.y / len;
    // Perpendicular à proa, na grelha: o lado para onde o pescador lança a linha.
    const px = -uy;
    const py = ux;
    const rowing = boat.state === 'row' || boat.state === 'back';
    const bob = Math.sin(t * 2.2 + boat.seed) * 0.7;
    const at = (along, across, z = 0) => {
        const w = gridToWorld(gx + ux * along + px * across, gy + uy * along + py * across);
        return [w.x, w.y - z - bob];
    };

    ctx.save();
    ctx.globalAlpha = alpha;

    // A esteira atrás do barco quando rema; parado, os anéis na água à volta.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    if (rowing) {
        for (const side of [-1, 1]) {
            const a = at(-0.3, side * 0.12, -bob);
            const b = at(-0.75, side * 0.3, -bob);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
        }
    } else {
        const c = at(0, 0, -bob);
        const r = 13 + Math.sin(t * 1.5 + boat.seed) * 1.5;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], r, r / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha;
    }

    // O casco: um fundo mais escuro e a borda por cima, bicudo nas duas pontas.
    const hull = (z, w, k) => [
        at(0.36 * k, 0, z), at(0.2 * k, w, z), at(-0.22 * k, w, z),
        at(-0.32 * k, 0, z), at(-0.22 * k, -w, z), at(0.2 * k, -w, z)
    ];
    ctx.fillStyle = 'rgba(20, 50, 80, 0.3)';
    poly(hull(-1, 0.15, 1));
    ctx.fillStyle = boat.hull;
    poly(hull(0, 0.13, 0.9));
    const rim = hull(3.2, 0.14, 1);
    ctx.fillStyle = lighten(boat.hull);
    poly(rim);
    ctx.fillStyle = '#5a3d24';
    poly(hull(3.4, 0.09, 0.78));
    // Uma tábua de través, onde se senta.
    const s1 = at(0.02, 0.12, 3.4);
    const s2 = at(0.02, -0.12, 3.4);
    ctx.strokeStyle = '#c99d66';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(s1[0], s1[1]);
    ctx.lineTo(s2[0], s2[1]);
    ctx.stroke();

    // Os remos: quando rema vão e vêm; parado, ficam recolhidos ao longo do barco.
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1.2;
    const stroke = rowing ? Math.sin((t + boat.seed) * 5) : 0;
    for (const side of [-1, 1]) {
        const grip = at(0, side * 0.07, 6);
        const blade = rowing ? at(-0.05 + stroke * 0.15, side * 0.42, 0.5) : at(-0.3, side * 0.12, 4);
        ctx.beginPath();
        ctx.moveTo(grip[0], grip[1]);
        ctx.lineTo(blade[0], blade[1]);
        ctx.stroke();
    }

    // O pescador, sentado na tábua.
    const seat = at(-0.04, 0, 3.4);
    const [sx, sy] = seat;
    ctx.fillStyle = boat.shirt;
    ctx.beginPath();
    ctx.roundRect(sx - 1.8, sy - 5.6, 3.6, 5, 1.2);
    ctx.fill();
    ctx.fillStyle = boat.skin;
    ctx.beginPath();
    ctx.arc(sx, sy - 7.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // O chapéu de palha.
    ctx.fillStyle = boat.hat;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 8.3, 3, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy - 8.4, 1.5, Math.PI, 0);
    ctx.fill();

    if (boat.state === 'fish') drawRod(boat, at, [sx, sy - 4], t);
    ctx.restore();
}

/** A cana, a linha e a boia; com peixe, a cana verga e o peixe salta fora de água. */
function drawRod(boat, at, hands, t) {
    const biting = boat.bite >= 0;
    const k = biting ? Math.sin((boat.bite / CATCH_SECONDS) * Math.PI) : 0;
    // A ponta da cana fica por cima da água, do lado para onde lançou.
    const tipBase = at(0.1, boat.cast * 0.85, 11);
    const tip = [tipBase[0], tipBase[1] + k * 5 + Math.sin(t * 1.3 + boat.seed) * 0.6];
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hands[0], hands[1]);
    ctx.quadraticCurveTo((hands[0] + tip[0]) / 2, Math.min(hands[1], tip[1]) - 3 + k * 4, tip[0], tip[1]);
    ctx.stroke();

    // A boia na água, a cerca de uma casa do barco.
    const water = at(0.15, boat.cast * 1.25, 0);
    const bobber = [water[0], water[1] + (biting ? 1.2 : Math.sin(t * 3 + boat.seed) * 0.5)];
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.8)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(bobber[0], bobber[1] - 1);
    ctx.stroke();
    if (!biting) {
        ctx.fillStyle = '#e8483a';
        ctx.beginPath();
        ctx.arc(bobber[0], bobber[1] - 1, 1.3, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#f6f2ea';
        ctx.beginPath();
        ctx.arc(bobber[0], bobber[1] - 1, 1.3, 0, Math.PI);
        ctx.fill();
        return;
    }

    // O peixe a saltar: sobe e volta a cair, a dar ao rabo, com salpicos à volta.
    const fx0 = bobber[0];
    const fy0 = bobber[1] - k * 9;
    ctx.save();
    ctx.translate(fx0, fy0);
    ctx.rotate(Math.sin(t * 22) * 0.5 + (boat.cast > 0 ? 0.3 : -0.3));
    ctx.fillStyle = '#b9c8d4';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8fa0ad';
    ctx.beginPath();
    ctx.moveTo(-2.8, 0);
    ctx.lineTo(-5, -1.8);
    ctx.lineTo(-5, 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - k)})`;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + boat.seed;
        ctx.beginPath();
        ctx.arc(bobber[0] + Math.cos(a) * (3 + k * 4), bobber[1] - Math.abs(Math.sin(a)) * k * 4, 0.9, 0, Math.PI * 2);
        ctx.fill();
    }
}

function poly(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
    ctx.closePath();
    ctx.fill();
}

const lightCache = new Map();
/** A mesma cor, um pouco mais clara (#rrggbb): a borda do barco apanha a luz. */
function lighten(hex) {
    let c = lightCache.get(hex);
    if (!c) {
        const n = parseInt(hex.slice(1), 16);
        const up = (v) => Math.min(255, Math.round(v + (255 - v) * 0.22));
        c = `rgb(${up(n >> 16)}, ${up((n >> 8) & 255)}, ${up(n & 255)})`;
        lightCache.set(hex, c);
    }
    return c;
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
            // Os cantos da casa pelos nomes que têm na vista sem rodar.
            const corner = (gx, gy) => {
                const w = gridToWorld(gx, gy);
                return [w.x, w.y - z];
            };
            const top = corner(x, y);
            const rightP = corner(x + 1, y);
            const bottom = corner(x + 1, y + 1);
            const leftP = corner(x, y + 1);
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

/** A variante do desenho da cabana de pesca: o lado da água e a que distância está (ver `fisheryLayout`). */
function shoreVariant(x, y, size) {
    const { side, reach } = shoreSide(game.world, x, y, size);
    return side + 4 * reach;
}

function drawBuilding(b, wx, wy, t) {
    const kind = b.kind;
    // As casas têm mais variantes do que o resto (ver `house` em sprites.js).
    const variant = kind === 'house' ? Math.floor(hash2(b.x, b.y, 78) * HOUSE_VARIANTS) : variantOf(b.x, b.y);
    const roof = roofOf(b);
    let key;
    let opts;
    if (kind === 'castle') {
        key = `castle|${game.castleLevel}`;
        opts = { level: game.castleLevel };
    } else if (isCrop(kind)) {
        const growth = b.stage === 'growing' ? Math.min(5, Math.floor(b.growth * 6)) / 6 : 0;
        key = `${kind}|${b.stage}|${growth}`;
        opts = { stage: b.stage, growth };
    } else if (kind === 'fishery') {
        // O cais vira-se para a água e vai até ela: o lado e o alcance são a variante do desenho.
        b.shore ??= shoreVariant(b.x, b.y, b.size);
        key = `${kind}|${roof}|${b.shore}`;
        opts = { roof, variant: b.shore };
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

/**
 * Os montes de uma casa de colina (ver `mountain` em sprites.js): dois numa
 * casa sem nada em cima, só o de trás numa casa com rochas ou ouro.
 */
function drawMountains(x, y, wx, wy, backOnly = false) {
    const variant = Math.floor(hash2(x, y, 18) * MOUNTAIN_VARIANTS);
    const jx = (hash2(x, y, 19) - 0.5) * 4;
    const k = 0.56 + Math.round(hash2(x, y, 20) * 2) * 0.04;
    stamp(ctx, `mountain|${variant}|${backOnly ? 1 : 0}`, 'mountain', { variant, backOnly }, wx + jx, wy, k);
}

// ---------- Peças ocultas (modo de construção) ----------
//
// Com "ocultar" ligado, cada edifício fica só com a base no chão e cada
// árvore, pedra ou veio com uma marca rasa: vê-se o que ocupa cada casa sem
// tapar as casas livres que estão atrás.

function drawBuildingBase(b) {
    const z = Math.max(0, tileElev(b.x, b.y)) * ELEV_PX;
    const mine = b.owner === 'player';
    ctx.save();
    blockPath(b.x, b.y, b.size, z, 0.06);
    ctx.fillStyle = isCrop(b.kind) ? 'rgba(150, 110, 60, 0.55)' : 'rgba(168, 150, 120, 0.8)';
    ctx.fill();
    ctx.strokeStyle = mine ? 'rgba(90, 60, 30, 0.85)' : 'rgba(70, 60, 50, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Um losango mais pequeno por dentro: as fundações, a dizer "aqui há paredes".
    if (!isCrop(b.kind)) {
        blockPath(b.x, b.y, b.size, z, 0.22);
        ctx.strokeStyle = 'rgba(90, 70, 45, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function drawFeatureBase(feature, x, y, wx, wy) {
    ctx.save();
    if (feature === 'tree') {
        const jx = (hash2(x, y, 13) - 0.5) * 6;
        const jy = (hash2(x, y, 14) - 0.5) * 3;
        // A sombra da copa e o tronco cortado.
        ctx.fillStyle = 'rgba(30, 70, 25, 0.45)';
        ctx.beginPath();
        ctx.ellipse(wx + jx, wy + jy, 11, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5230';
        ctx.beginPath();
        ctx.ellipse(wx + jx, wy + jy, 3.2, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c79a62';
        ctx.beginPath();
        ctx.ellipse(wx + jx, wy + jy - 0.4, 2.2, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = 'rgba(110, 110, 105, 0.75)';
        ctx.beginPath();
        ctx.ellipse(wx, wy, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        if (feature === 'ore') {
            ctx.fillStyle = '#f2c14e';
            ctx.beginPath();
            ctx.ellipse(wx, wy, 2.4, 1.3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

/** Os montes, rasos: duas manchas de pedra, para se ver que a casa é colina sem tapar o que está atrás. */
function drawMountainsBase(wx, wy) {
    ctx.save();
    ctx.fillStyle = 'rgba(120, 105, 85, 0.5)';
    ctx.beginPath();
    ctx.ellipse(wx - 4, wy - 1, 7, 3.4, 0, 0, Math.PI * 2);
    ctx.ellipse(wx + 5, wy + 1.5, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const variant = kind === 'fishery' ? shoreVariant(x, y, 2) : 0;
    const opts = isCrop(kind) ? { stage: 'empty', growth: 0 } : { roof: PLAYER_ROOF, variant };
    stamp(ctx, `${kind}|ghost|${variant}`, kind, opts, wx, wy);
    ctx.restore();
}

// ---------- Efeitos em coordenadas de mundo ----------

function drawCaravan(c, t) {
    const gx = c.ax + (c.bx - c.ax) * c.t;
    const gy = c.ay + (c.by - c.ay) * c.t;
    const w = gridToWorld(gx, gy);
    const dir = Math.sign(gridToWorld(c.bx, c.by).x - gridToWorld(c.ax, c.ay).x) || 1;
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
    const def = BUILDING[b.kind];
    if (def?.crop) return b.stage === 'ripe' ? RESOURCE[def.crop.res].emoji : null;
    if (b.status === 'noInput') {
        const needs = def.recipe?.in || (def.serves?.drink ? { [def.serves.drink]: 1 } : {});
        const need = Object.keys(needs).find((res) => game.res[res] < needs[res]);
        return need ? RESOURCE[need].emoji : '❔';
    }
    if (b.status === 'noNear') return NEAR_FEATURES[def.near?.feature]?.icon || '❔';
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

    if (game.phase === 'playing' && camera.zoom > 0.6 && !(ui.placing && ui.hideProps)) {
        for (const b of game.buildings) {
            const icon = statusIcon(b);
            if (!icon) continue;
            const e = Math.max(0, tileElev(b.x, b.y));
            const w = gridToWorld(b.x + b.size / 2, b.y + b.size / 2, e);
            const crop = isCrop(b.kind);
            const s = worldToScreen(w.x, w.y - (crop ? 20 : 48));
            if (s.x < -20 || s.y < -20 || s.x > view.width + 20 || s.y > view.height + 20) continue;
            drawBubble(s.x, s.y, icon, t, crop);
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
/** Os blocos são da grelha da vista: ao rodar, deitam-se todos fora. */
let chunkRot = 0;
let frameNo = 0;

/** O bloco (cx, cy) da grelha da vista: as casas da vista que tem e o retângulo de mundo que ocupa. */
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
    for (let vy = Math.max(0, b.y0 - 1); vy < Math.min(MAP_SIZE, b.y1 + 1); vy++) {
        for (let vx = Math.max(0, b.x0 - 1); vx < Math.min(MAP_SIZE, b.x1 + 1); vx++) {
            const c = viewToCell(vx, vy);
            const i = idx(c.x, c.y);
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
        for (let vx = Math.max(b.x0, s - b.y1 + 1); vx <= Math.min(b.x1 - 1, s - b.y0); vx++) {
            const c = viewToCell(vx, s - vx);
            drawGround(c.x, c.y, vx, s - vx, detail);
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
    if (chunkRot !== camera.rot) {
        chunkCache.clear();
        chunkRot = camera.rot;
    }
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
    const hideProps = !!ui.placing && ui.hideProps;

    // Limites de desenho em mundo: o ecrã mais uma folga (as peças sobem acima da casa).
    const halfW = view.width / 2 / camera.zoom + TILE_W;
    const top = camera.y - view.height / 2 / camera.zoom - TILE_H * 2;
    const bottom = camera.y + view.height / 2 / camera.zoom + 220;
    const leftX = camera.x - halfW;
    const rightX = camera.x + halfW;

    // O fantasma do edifício a construir desenha-se na casa da frente do bloco.
    // Ao toque é o sítio à espera de confirmação; com rato, o que está por baixo dele.
    const hover = ui.placing && ui.placing !== 'road' ? (ui.pending ?? ui.hover) : null;
    const hoverOk = hover ? checkPlacement(ui.placing, hover.x, hover.y, { ignoreCost: true }).ok : false;
    const hoverFront = hover ? blockFront(hover.x, hover.y, 2) : null;

    // A gente na rua, arrumada pela casa onde se desenha: das duas entre as
    // quais vai, a que está mais à frente na vista, para os pés não ficarem por
    // baixo do chão da seguinte.
    const walkersAt = new Map();
    for (const w of fx.walkers) {
        const { from, to } = walkerPlace(w);
        const a = cellToView(from.x, from.y);
        const b = cellToView(to.x, to.y);
        const cell = a.x + a.y >= b.x + b.y ? from : to;
        const i = idx(cell.x, cell.y);
        if (!walkersAt.has(i)) walkersAt.set(i, []);
        walkersAt.get(i).push(w);
    }

    // Os barcos, da mesma maneira.
    const boatsAt = new Map();
    for (const boat of fx.boats) {
        const { from, to } = boatPlace(boat);
        const a = cellToView(from.x, from.y);
        const b = cellToView(to.x, to.y);
        const cell = a.x + a.y >= b.x + b.y ? from : to;
        const i = idx(cell.x, cell.y);
        if (!boatsAt.has(i)) boatsAt.set(i, []);
        boatsAt.get(i).push(boat);
    }

    drawGroundChunks({ left: leftX, right: rightX, top: top - ELEV_PX * 2, bottom }, detail);

    for (let s = 0; s <= (MAP_SIZE - 1) * 2; s++) {
        const wy = (s + 1) * HH;
        if (wy < top - ELEV_PX * 2 || wy - SLAB_PX > bottom) continue;
        const x0 = Math.max(0, s - MAP_SIZE + 1);
        const x1 = Math.min(MAP_SIZE - 1, s);
        for (let vx = x0; vx <= x1; vx++) {
            const vy = s - vx;
            const wx = (vx - vy) * HW;
            if (wx < leftX || wx > rightX) continue;
            const { x, y } = viewToCell(vx, vy);

            if (detail && game.world.terrain[idx(x, y)] === T_WATER) drawWaterShimmer(x, y, t);
            if (okMap) drawTileOverlay(x, y, okMap);

            const i = idx(x, y);
            const e = Math.max(0, game.world.elev[i]);
            const gy = wy - e * ELEV_PX;
            const b = game.world.building[i];
            if (b) {
                // Um edifício desenha-se na casa da frente do seu bloco, a última a ser pintada.
                const front = blockFront(b.x, b.y, b.size);
                if (vx === front.x && vy === front.y) {
                    if (hideProps) {
                        drawBuildingBase(b);
                    } else {
                        const cw = gridToWorld(b.x + b.size / 2, b.y + b.size / 2, e);
                        drawBuilding(b, cw.x, cw.y, t);
                    }
                }
            } else if (game.world.feature[i]) {
                const feature = game.world.feature[i];
                if (hideProps) {
                    drawFeatureBase(feature, x, y, wx, gy);
                } else {
                    if (feature !== 'tree' && game.world.terrain[i] === T_HILL) drawMountains(x, y, wx, gy, true);
                    drawFeature(feature, x, y, wx, gy, t);
                }
            } else if (game.world.terrain[i] === T_HILL && !game.world.road[i]) {
                if (hideProps) drawMountainsBase(wx, gy);
                else drawMountains(x, y, wx, gy);
            }
            const boats = boatsAt.get(i);
            if (boats) for (const boat of boats) drawBoat(boat, t);
            const people = walkersAt.get(i);
            if (people) for (const w of people) drawWalker(w, t);
            if (hover && vx === hoverFront.x && vy === hoverFront.y) drawGhost(hover.x, hover.y, hoverOk);
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
