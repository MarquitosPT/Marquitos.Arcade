// Perspetiva isométrica e câmara.
//
// Três espaços de coordenadas:
//
//   grelha  — (gx, gy) em casas; a casa (x, y) ocupa [x, x+1] x [y, y+1].
//   mundo   — píxeis com zoom 1; o ponto de grelha (0, 0) está na origem.
//   ecrã    — píxeis CSS do canvas, depois da câmara (centro e zoom).
//
// O relevo (colinas, lagos) só mexe no y de mundo: sobe `ELEV_PX` por nível.
//
// A vista roda de 90 em 90 graus (`camera.rot`, de 0 a 3, no sentido dos
// ponteiros do relógio). A rotação vive entre a grelha e o mundo: a grelha
// passa primeiro para a "grelha da vista" — a mesma grelha, rodada à volta do
// centro do mapa — e só essa é projetada. Assim o resto do jogo continua a
// falar em casas do mapa, e só quem desenha precisa de saber para onde se olha
// (a ordem do pintor e as faces à vista são as da grelha da vista).

import { ELEV_PX, MAP_SIZE, TILE_H, TILE_W, ZOOM_MAX, ZOOM_MIN } from './config.js';
import { clamp } from '/lib/arcade/math.js';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

export const camera = {
    /** Ponto do mundo no centro do ecrã. */
    x: 0,
    y: MAP_SIZE * HH,
    zoom: 1,
    /** Para onde se olha: quartos de volta, no sentido dos ponteiros do relógio. */
    rot: 0,
    /** Tamanho do ecrã em px CSS, atualizado pelo viewport. */
    width: 1,
    height: 1
};

/** Ponto de grelha -> ponto da grelha da vista. */
export function toView(gx, gy) {
    switch (camera.rot) {
        case 1: return { x: MAP_SIZE - gy, y: gx };
        case 2: return { x: MAP_SIZE - gx, y: MAP_SIZE - gy };
        case 3: return { x: gy, y: MAP_SIZE - gx };
        default: return { x: gx, y: gy };
    }
}

/** Ponto da grelha da vista -> ponto de grelha. */
export function fromView(vx, vy) {
    switch (camera.rot) {
        case 1: return { x: vy, y: MAP_SIZE - vx };
        case 2: return { x: MAP_SIZE - vx, y: MAP_SIZE - vy };
        case 3: return { x: MAP_SIZE - vy, y: vx };
        default: return { x: vx, y: vy };
    }
}

/** A casa da vista onde fica a casa (x, y) do mapa, e o contrário. */
export function cellToView(x, y) {
    const v = toView(x + 0.5, y + 0.5);
    return { x: Math.floor(v.x), y: Math.floor(v.y) };
}

export function viewToCell(vx, vy) {
    const g = fromView(vx + 0.5, vy + 0.5);
    return { x: Math.floor(g.x), y: Math.floor(g.y) };
}

/** A casa da vista mais à frente de um bloco de `size` casas (canto de cima em x, y) — a última a ser pintada. */
export function blockFront(x, y, size) {
    const a = cellToView(x, y);
    const b = cellToView(x + size - 1, y + size - 1);
    return { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
}

/** Ponto da grelha da vista -> mundo. */
export function viewToWorld(vx, vy, elev = 0) {
    return { x: (vx - vy) * HW, y: (vx + vy) * HH - elev * ELEV_PX };
}

/** Ponto de grelha -> mundo. `elev` em níveis de relevo. */
export function gridToWorld(gx, gy, elev = 0) {
    const v = toView(gx, gy);
    return viewToWorld(v.x, v.y, elev);
}

/** Mundo -> ponto de grelha, ao nível do chão (sem relevo). */
export function worldToGrid(wx, wy) {
    return fromView((wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2);
}

/**
 * Roda a vista um quarto de volta (`turns` = 1 no sentido dos ponteiros do
 * relógio, -1 ao contrário), sem sair do sítio: o ponto do mapa que estava no
 * centro do ecrã continua lá.
 */
export function rotateView(turns) {
    const center = worldToGrid(camera.x, camera.y);
    camera.rot = (((camera.rot + turns) % 4) + 4) % 4;
    lookAt(center.x, center.y);
}

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
    // Tudo em casas da vista, onde "à frente" é x + y maior; no fim volta-se ao mapa.
    const w = screenToWorld(sx, sy);
    const vx0 = (w.x / HW + w.y / HH) / 2;
    const vy0 = (w.y / HH - w.x / HW) / 2;
    const bx = Math.floor(vx0);
    const by = Math.floor(vy0);

    // Candidatas: a casa ao nível do chão e as que estão à volta dela, sobretudo
    // as da frente (que, se forem colinas, sobem para cima do ponto).
    const candidates = [];
    for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) candidates.push({ x: bx + dx, y: by + dy });
    }

    let best = null;
    let bestDepth = -Infinity;
    for (const c of candidates) {
        if (c.x < 0 || c.y < 0 || c.x >= MAP_SIZE || c.y >= MAP_SIZE) continue;
        const cell = viewToCell(c.x, c.y);
        const lift = elevAt(cell.x, cell.y) * ELEV_PX;
        const vx = (w.x / HW + (w.y + lift) / HH) / 2;
        const vy = ((w.y + lift) / HH - w.x / HW) / 2;
        if (vx >= c.x && vx < c.x + 1 && vy >= c.y && vy < c.y + 1) {
            const depth = c.x + c.y;
            if (depth > bestDepth) {
                const g = fromView(vx, vy);
                best = { x: cell.x, y: cell.y, u: clamp(g.x - cell.x, 0, 0.999), v: clamp(g.y - cell.y, 0, 0.999) };
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
