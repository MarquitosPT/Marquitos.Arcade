// Perspetiva isométrica e câmara.
//
// Três espaços de coordenadas:
//
//   grelha  — (gx, gy) em casas; a casa (x, y) ocupa [x, x+1] x [y, y+1].
//   mundo   — píxeis com zoom 1; o ponto de grelha (0, 0) está na origem.
//   ecrã    — píxeis CSS do canvas, depois da câmara (centro e zoom).
//
// O relevo (colinas, lagos) só mexe no y de mundo: sobe `ELEV_PX` por nível.

import { ELEV_PX, MAP_SIZE, TILE_H, TILE_W, ZOOM_MAX, ZOOM_MIN } from './config.js';
import { clamp } from '/lib/arcade/math.js';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

/** Ponto de grelha -> mundo. `elev` em níveis de relevo. */
export function gridToWorld(gx, gy, elev = 0) {
    return { x: (gx - gy) * HW, y: (gx + gy) * HH - elev * ELEV_PX };
}

/** Mundo -> ponto de grelha, ao nível do chão (sem relevo). */
export function worldToGrid(wx, wy) {
    return { x: (wx / HW + wy / HH) / 2, y: (wy / HH - wx / HW) / 2 };
}

export const camera = {
    /** Ponto do mundo no centro do ecrã. */
    x: 0,
    y: MAP_SIZE * HH,
    zoom: 1,
    /** Tamanho do ecrã em px CSS, atualizado pelo viewport. */
    width: 1,
    height: 1
};

export function worldToScreen(wx, wy) {
    return {
        x: (wx - camera.x) * camera.zoom + camera.width / 2,
        y: (wy - camera.y) * camera.zoom + camera.height / 2
    };
}

export function screenToWorld(sx, sy) {
    return {
        x: (sx - camera.width / 2) / camera.zoom + camera.x,
        y: (sy - camera.height / 2) / camera.zoom + camera.y
    };
}

/** Centra a câmara num ponto de grelha. */
export function lookAt(gx, gy) {
    const w = gridToWorld(gx, gy);
    camera.x = w.x;
    camera.y = w.y;
    clampCamera();
}

/**
 * A câmara não pode fugir do mapa: o centro do ecrã fica sempre dentro do
 * losango do tabuleiro. Sem isto, um arrasto largo deixava só céu à vista.
 */
export function clampCamera() {
    const g = worldToGrid(camera.x, camera.y);
    const gx = clamp(g.x, 0, MAP_SIZE);
    const gy = clamp(g.y, 0, MAP_SIZE);
    if (gx !== g.x || gy !== g.y) {
        const w = gridToWorld(gx, gy);
        camera.x = w.x;
        camera.y = w.y;
    }
}

/** Zoom à volta de um ponto do ecrã: o que está debaixo do dedo fica debaixo do dedo. */
export function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    camera.zoom = clamp(camera.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    const after = screenToWorld(sx, sy);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
}

export function panBy(dxScreen, dyScreen) {
    camera.x -= dxScreen / camera.zoom;
    camera.y -= dyScreen / camera.zoom;
    clampCamera();
}

/**
 * A casa debaixo de um ponto do ecrã, tendo em conta o relevo: uma colina à
 * frente tapa o que está atrás dela, por isso testam-se primeiro as casas mais
 * próximas de quem olha.
 *
 * Devolve também onde, dentro da casa, caiu o ponto (`u`, `v`, de 0 a 1): é
 * o que diz a que canto se encosta um edifício de 2x2 (ver `anchorFor`).
 *
 * @param {(x: number, y: number) => number} elevAt Relevo da casa.
 * @returns {{x: number, y: number, u: number, v: number} | null}
 */
export function pickTile(sx, sy, elevAt) {
    const w = screenToWorld(sx, sy);
    const ground = worldToGrid(w.x, w.y);
    const bx = Math.floor(ground.x);
    const by = Math.floor(ground.y);

    // Candidatas: a casa ao nível do chão e as vizinhas da frente (que, se
    // forem colinas, sobem para cima do ponto).
    const candidates = [];
    for (let d = 2; d >= -1; d--) {
        for (let k = -1; k <= 1; k++) {
            candidates.push({ x: bx + d + k, y: by + d - k });
        }
    }
    candidates.push({ x: bx, y: by });

    let best = null;
    let bestDepth = -Infinity;
    for (const c of candidates) {
        if (c.x < 0 || c.y < 0 || c.x >= MAP_SIZE || c.y >= MAP_SIZE) continue;
        const e = elevAt(c.x, c.y);
        const g = worldToGrid(w.x, w.y + e * ELEV_PX);
        if (g.x >= c.x && g.x < c.x + 1 && g.y >= c.y && g.y < c.y + 1) {
            const depth = c.x + c.y;
            if (depth > bestDepth) {
                best = { x: c.x, y: c.y, u: g.x - c.x, v: g.y - c.y };
                bestDepth = depth;
            }
        }
    }
    return best;
}

/**
 * O canto de cima do bloco de `size` casas que fica centrado no canto de casa
 * mais perto do ponto escolhido — o edifício aparece debaixo do dedo.
 */
export function anchorFor(tile, size) {
    const half = Math.floor(size / 2);
    return {
        x: tile.x - half + (tile.u >= 0.5 ? 1 : 0),
        y: tile.y - half + (tile.v >= 0.5 ? 1 : 0)
    };
}
