// Construção das pistas.
//
// Uma pista é uma elipse deformada por harmónicos de seno: com dois ou três
// termos saem curvas com carácter (uma chicane, uma curva dupla) sem ninguém ter
// de desenhar pontos à mão. A partir dos 420 pontos da linha central derivam-se
// as tangentes, as normais (para as bordas e as colisões), o comprimento total
// (para a distância percorrida) e a caixa envolvente (para o minimapa).

import { rand } from '/lib/arcade/math.js';

function buildTrack(def) {
    const N = 420;
    const pts = [];
    for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        let r = 1;
        for (const h of def.harmonics) r += h.amp * Math.sin(h.freq * t + (h.phase || 0));
        pts.push({
            x: def.cx + def.rx * r * Math.cos(t),
            y: def.cy + def.ry * r * Math.sin(t)
        });
    }
    const tang = [], norm = [], segLen = [];
    for (let i = 0; i < N; i++) {
        const p0 = pts[(i - 1 + N) % N], p1 = pts[(i + 1) % N];
        let dx = p1.x - p0.x, dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        tang.push({ x: dx, y: dy });
        norm.push({ x: -dy, y: dx });
    }
    let total = 0;
    for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        total += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const bbox = { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
    const pads = [Math.floor(N * 0.22), Math.floor(N * 0.52), Math.floor(N * 0.82)];

    const decor = [];
    if (def.theme !== 'night') {
        for (let i = 0; i < 70; i++) {
            const x = rand(bbox.minX - 260, bbox.maxX + 260);
            const y = rand(bbox.minY - 260, bbox.maxY + 260);
            let tooClose = false;
            for (let k = 0; k < N; k += 14) {
                if (Math.hypot(pts[k].x - x, pts[k].y - y) < def.halfWidth + 55) { tooClose = true; break; }
            }
            if (!tooClose) decor.push({ x, y, size: rand(10, 26), variant: Math.random() });
        }
    }

    return { ...def, pts, tang, norm, total, N, bbox, pads, decor };
}

export const TRACKS = [
    buildTrack({ id: 'neon', name: 'Circuito Neon', cx: 800, cy: 600, rx: 560, ry: 340, halfWidth: 100, theme: 'grass', harmonics: [{ freq: 2, amp: 0.05, phase: 0 }] }),
    buildTrack({ id: 'hairpin', name: 'Curva Dupla', cx: 800, cy: 600, rx: 520, ry: 300, halfWidth: 92, theme: 'sand', harmonics: [{ freq: 3, amp: 0.22, phase: 0.6 }] }),
    buildTrack({ id: 'chicane', name: 'Deserto Rápido', cx: 800, cy: 600, rx: 600, ry: 260, halfWidth: 96, theme: 'night', harmonics: [{ freq: 2, amp: 0.10, phase: 0 }, { freq: 5, amp: 0.05, phase: 1.2 }] })
];

export const THEME_COLORS = {
    grass: { terrain: '#0d2b12', asphalt: '#2a2e3a', decor: '#123a1c' },
    sand: { terrain: '#2c1a10', asphalt: '#332c22', decor: '#5b4326' },
    night: { terrain: '#0a0820', asphalt: '#181422', decor: '#ff2fa0' }
};

export function findNearestIdx(track, x, y, hint) {
    let best = -1, bestD = Infinity;
    const N = track.N;
    for (let k = -24; k <= 48; k++) {
        const i = ((hint + k) % N + N) % N;
        const p = track.pts[i];
        const dx = p.x - x, dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = i; }
    }
    return best;
}
