// Cache das partes estáticas dos desenhos (ver sprites.js).
//
// Desenhar uma árvore são uma dúzia de caminhos; desenhar quatrocentas a cada
// frame, num telemóvel, já se sente. Por isso cada desenho estático é pintado
// uma vez numa imagem à parte e depois só se carimba.
//
// A imagem é pintada à escala do ecrã (zoom x devicePixelRatio), em degraus de
// um terço de oitava: dentro do mesmo degrau reaproveita-se, ao mudar de degrau
// deita-se a cache fora e volta-se a pintar — assim fica nítida em qualquer
// zoom sem se pintar de novo a cada roda do rato.
//
// Ao mudar de degrau, as imagens do degrau anterior não vão logo fora: ficam
// de reserva e mostram-se esticadas enquanto as novas se pintam, umas poucas
// por frame (`PAINT_BUDGET`) — pintar de uma vez todas as casas à vista dava
// um solavanco no zoom.
//
// As peças rodam com a vista (ver draw.js), por isso ao rodar a cache vai
// toda fora: as imagens guardadas eram as do lado de onde se olhava antes.

import { camera } from './iso.js';
import { BOUNDS, STATIC } from './sprites.js';

const MAX_SCALE = 5;
/** Imagens pintadas por frame quando há uma de reserva para mostrar entretanto. */
const PAINT_BUDGET = 6;
let cache = new Map();
/** As imagens do degrau de escala anterior, de reserva (ver acima). */
let stale = new Map();
let scale = 0;
let rot = 0;
let budget = 0;

/** Chamar a cada frame com a escala efetiva (zoom x dpr). */
export function setSpriteScale(value) {
    const next = Math.min(MAX_SCALE, 2 ** (Math.round(Math.log2(Math.max(0.25, value)) * 3) / 3));
    if (camera.rot !== rot) {
        cache.clear();
        stale.clear();
        scale = next;
        rot = camera.rot;
    } else if (next !== scale) {
        // As que ainda não se tinham repintado ficam da reserva de antes.
        for (const [key, entry] of cache) stale.set(key, entry);
        cache = new Map();
        scale = next;
    }
    budget = PAINT_BUDGET;
}

/**
 * A imagem de uma peça. `key` identifica a variante (tipo + cor + fase...);
 * duas chamadas com a mesma chave têm de pedir o mesmo desenho.
 */
export function getSprite(key, kind, opts, k = 1) {
    const full = k === 1 ? key : `${key}|${k}`;
    let entry = cache.get(full);
    if (entry) return entry;
    // Sem vez para pintar neste frame: mostra-se a de reserva, esticada.
    const old = stale.get(full);
    if (old && budget <= 0) return old;
    budget--;
    stale.delete(full);
    const [x0, y0, w, h] = BOUNDS[kind] || BOUNDS.default;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * k * scale);
    canvas.height = Math.ceil(h * k * scale);
    const g = canvas.getContext('2d');
    g.scale(scale * k, scale * k);
    g.translate(-x0, -y0);
    STATIC[kind](g, opts);
    entry = { canvas, x0: x0 * k, y0: y0 * k, w: w * k, h: h * k };
    cache.set(full, entry);
    return entry;
}

/**
 * Carimba a peça no ponto de mundo (wx, wy) — o contexto já tem a câmara
 * aplicada. `k` encolhe a peça à volta desse ponto (as árvores e os rochedos
 * ocupam uma casa, mais pequena do que a de um edifício); a imagem é pintada
 * já nesse tamanho, para o carimbo não ter de a encolher a cada frame.
 */
export function stamp(ctx, key, kind, opts, wx, wy, k = 1) {
    const s = getSprite(key, kind, opts, k);
    ctx.drawImage(s.canvas, wx + s.x0, wy + s.y0, s.w, s.h);
}
