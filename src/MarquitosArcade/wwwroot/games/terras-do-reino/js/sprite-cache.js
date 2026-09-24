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

import { BOUNDS, STATIC } from './sprites.js';

const MAX_SCALE = 5;
const cache = new Map();
let scale = 0;

/** Chamar a cada frame com a escala efetiva (zoom x dpr). */
export function setSpriteScale(value) {
    const next = Math.min(MAX_SCALE, 2 ** (Math.round(Math.log2(Math.max(0.25, value)) * 3) / 3));
    if (next !== scale) {
        cache.clear();
        scale = next;
    }
}

/**
 * A imagem de uma peça. `key` identifica a variante (tipo + cor + fase...);
 * duas chamadas com a mesma chave têm de pedir o mesmo desenho.
 */
export function getSprite(key, kind, opts) {
    let entry = cache.get(key);
    if (entry) return entry;
    const [x0, y0, w, h] = BOUNDS[kind] || BOUNDS.default;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    g.translate(-x0, -y0);
    STATIC[kind](g, opts);
    entry = { canvas, x0, y0, w, h };
    cache.set(key, entry);
    return entry;
}

/** Carimba a peça no ponto de mundo (wx, wy) — o contexto já tem a câmara aplicada. */
export function stamp(ctx, key, kind, opts, wx, wy) {
    const s = getSprite(key, kind, opts);
    ctx.drawImage(s.canvas, wx + s.x0, wy + s.y0, s.w, s.h);
}
