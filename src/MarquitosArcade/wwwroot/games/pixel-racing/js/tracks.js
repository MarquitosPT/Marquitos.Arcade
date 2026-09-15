// Construção das pistas.
//
// Uma pista é uma superelipse deformada por harmónicos de seno. A superelipse
// (o expoente `edge`) estica os lados em rectas e junta a viragem nos cantos; os
// harmónicos põem curvas pelo meio para o traçado não ser um oval. Com dois ou
// três termos saem pistas com carácter — uma chicane, uma curva dupla, uma recta
// grande — sem ninguém ter de desenhar pontos à mão.
//
// A curva é amostrada em fino e só depois cortada em pontos igualmente
// espaçados (STEP). Assim cada índice vale sempre a mesma distância, esteja numa
// recta ou numa curva, e uma pista maior fica simplesmente com mais pontos: é
// disso que dependem o avanço na volta, os postos de turbo, a antecipação dos
// CPU e o espaçamento das guias.
//
// Os pontos da linha central começam a meio do lado de baixo e seguem no sentido
// contrário ao dos ponteiros do relógio; deles derivam-se as tangentes, as
// normais (para as bordas e as colisões), o comprimento total (para a distância
// percorrida) e a caixa envolvente (para o minimapa).

import { normAngle, rand } from '/lib/arcade/math.js';
import { BARRIER_SPACING, MAX_SPEED, RUNOFF, TURN_RATE } from './config.js';

/** Distância entre pontos da linha central, em unidades do mundo. */
const STEP = 6.9;
/** Amostragem fina usada antes de cortar a linha central por distância. */
const RAW = 6000;

/**
 * O raio da curva mais fechada que ainda se faz a fundo: à velocidade máxima o
 * carro roda `TURN_RATE` por segundo, e daí sai o raio que descreve. Abaixo
 * disto ou se levanta o pé ou se entra a derrapar — é a fronteira entre uma
 * curva de que nem se dá conta e uma curva a sério.
 */
const NO_LIFT_RADIUS = MAX_SPEED / TURN_RATE;
/** Meio-intervalo, em pontos, com que se mede a curvatura da linha central. */
const CURVE_WINDOW = 6;

/**
 * Ponto do traçado no ângulo `t`. Com `edge` a 2 é uma elipse; acima disso os
 * lados achatam-se em recta e a viragem concentra-se nos cantos.
 */
function shapePoint(def, t) {
    let r = 1;
    for (const h of def.harmonics) r += h.amp * Math.sin(h.freq * t + (h.phase || 0));
    const e = 2 / (def.edge || 2);
    const c = Math.cos(t), s = Math.sin(t);
    return {
        x: def.cx + def.rx * r * Math.sign(c) * Math.abs(c) ** e,
        y: def.cy + def.ry * r * Math.sign(s) * Math.abs(s) ** e
    };
}

/**
 * Linha central a passo constante. A partida fica a meio do lado de baixo
 * (t = PI/2) e o ângulo diminui, para a corrida seguir no sentido contrário ao
 * dos ponteiros do relógio.
 */
function centerLine(def) {
    const raw = [];
    for (let i = 0; i < RAW; i++) raw.push(shapePoint(def, Math.PI / 2 - (i / RAW) * Math.PI * 2));
    const cum = [0];
    for (let i = 1; i <= RAW; i++) {
        const a = raw[i - 1], b = raw[i % RAW];
        cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    const perimeter = cum[RAW];
    const N = Math.round(perimeter / STEP);
    const pts = [];
    for (let i = 0, k = 0; i < N; i++) {
        const d = (i / N) * perimeter;
        while (cum[k + 1] < d) k++;
        const f = (d - cum[k]) / (cum[k + 1] - cum[k]);
        const a = raw[k], b = raw[(k + 1) % RAW];
        pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
    return pts;
}

/**
 * Onde é que a pista aperta. O raio de cada ponto sai da rotação da tangente ao
 * longo de um pedaço fixo de pista — é a mesma conta que o carro faz, ao
 * contrário, quando tem de escolher a que velocidade entra.
 *
 * Daqui saem os dois números que o menu mostra: a curva mais fechada da volta e
 * o grau de perícia que ela exige. São medidos e não escritos à mão, por isso
 * uma pista nova descreve-se sozinha e nenhuma pode mentir sobre o que é.
 */
function corneringProfile(tang, ds) {
    const N = tang.length;
    const span = 2 * CURVE_WINDOW * ds;
    let minRadius = Infinity;
    for (let i = 0; i < N; i++) {
        const a = tang[(i - CURVE_WINDOW + N) % N], b = tang[(i + CURVE_WINDOW) % N];
        const turn = Math.abs(normAngle(Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)));
        if (turn > 1e-6) minRadius = Math.min(minRadius, span / turn);
    }
    // Quatro graus, pela folga que a curva mais fechada deixa em relação ao raio
    // que se faz a fundo: acima de uma vez e meia é uma pista de pé em baixo,
    // abaixo do próprio raio já não há volta a dar sem travar ou derrapar.
    const ratio = minRadius / NO_LIFT_RADIUS;
    const grade = ratio > 1.5 ? 1 : ratio > 1.05 ? 2 : ratio > 0.85 ? 3 : 4;
    return { minRadius, grade };
}

function buildTrack(def) {
    const pts = centerLine(def);
    const N = pts.length;
    const tang = [], norm = [];
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

    // Um posto de turbo a cada ~1600 unidades, repartidos por igual e nenhum em
    // cima da meta: numa pista comprida, três postos fixos ficavam longe demais
    // uns dos outros para o turbo contar.
    const padCount = Math.max(3, Math.round(total / 1600));
    const pads = [];
    for (let i = 0; i < padCount; i++) pads.push(Math.floor(N * (i + 0.66) / padCount));

    // Uma poça de óleo a meio caminho entre cada par de postos de turbo, de um
    // lado e do outro alternadamente: ficam repartidas pela pista, longe da
    // meta, e sempre com meia pista livre para quem as vir a tempo.
    const oils = [];
    for (let i = 0; i < pads.length - 1; i++) {
        const idx = Math.floor((pads[i] + pads[i + 1]) / 2);
        const offset = (i % 2 === 0 ? 1 : -1) * def.halfWidth * 0.42;
        oils.push({ idx, offset, x: pts[idx].x + norm[idx].x * offset, y: pts[idx].y + norm[idx].y * offset });
    }

    // Barreiras ao longo do limite da escapatória, dos dois lados e a passo
    // constante. Não travam nada por si — são a cara do limite, para se ver até
    // onde é que o carro pode ir sem ter de haver uma linha pintada no chão.
    const barrierAt = def.halfWidth + RUNOFF + 12;
    const step = Math.max(1, Math.round(BARRIER_SPACING / (total / N)));
    const barriers = [];
    for (const side of [1, -1]) {
        for (let i = 0; i < N; i += step) {
            const p = pts[i], n = norm[i], tg = tang[i];
            barriers.push({
                x: p.x + n.x * barrierAt * side, y: p.y + n.y * barrierAt * side,
                angle: Math.atan2(tg.y, tg.x), variant: (i / step) % 3
            });
        }
    }

    // A decoração acompanha o tamanho do terreno, para uma pista maior não ficar
    // com o mesmo punhado de arbustos espalhado por muito mais chão.
    const decor = [];
    if (def.theme !== 'night') {
        const area = (bbox.w + 520) * (bbox.h + 520);
        const count = Math.round(area / 28000);
        for (let i = 0; i < count; i++) {
            const x = rand(bbox.minX - 260, bbox.maxX + 260);
            const y = rand(bbox.minY - 260, bbox.maxY + 260);
            let tooClose = false;
            for (let k = 0; k < N; k += 14) {
                if (Math.hypot(pts[k].x - x, pts[k].y - y) < barrierAt + 55) { tooClose = true; break; }
            }
            if (!tooClose) decor.push({ x, y, size: rand(10, 26), variant: Math.random() });
        }
    }

    return { ...def, runoff: RUNOFF, barrierAt, pts, tang, norm, total, N, bbox, pads, oils, barriers, decor, ...corneringProfile(tang, total / N) };
}

export const TRACKS = [
    buildTrack({
        id: 'neon', name: 'Circuito Neon', cx: 800, cy: 600, rx: 1070, ry: 715, halfWidth: 100, theme: 'grass',
        edge: 3.0, harmonics: [{ freq: 3, amp: 0.14, phase: -0.15 }, { freq: 4, amp: 0.04, phase: 1.3 }]
    }),
    buildTrack({
        id: 'hairpin', name: 'Curva Dupla', cx: 800, cy: 600, rx: 1080, ry: 690, halfWidth: 92, theme: 'sand',
        edge: 2.7, harmonics: [{ freq: 4, amp: 0.14, phase: 3.3 }, { freq: 5, amp: 0.035, phase: 4.4 }]
    }),
    buildTrack({
        id: 'chicane', name: 'Deserto Rápido', cx: 800, cy: 600, rx: 1120, ry: 620, halfWidth: 96, theme: 'night',
        edge: 3.1, harmonics: [{ freq: 3, amp: 0.085, phase: -0.11 }, { freq: 5, amp: 0.044, phase: 3.14 }, { freq: 9, amp: 0.015, phase: -0.44 }]
    }),

    // As três de baixo são o degrau seguinte: mais compridas, mais estreitas e
    // com curvas abaixo do raio que se faz a fundo — nas de cima nunca é preciso
    // levantar o pé, aqui é, e quem não travar tem de entrar a derrapar.
    buildTrack({
        id: 'serra', name: 'Serra Torcida', cx: 800, cy: 600, rx: 1227, ry: 774, halfWidth: 82, theme: 'grass',
        edge: 3.1, harmonics: [{ freq: 6, amp: 0.06, phase: 2.9 }, { freq: 8, amp: 0.041, phase: -2.11 }, { freq: 12, amp: 0.018, phase: -2.77 }]
    }),
    buildTrack({
        id: 'gancho', name: 'Gancho Noturno', cx: 800, cy: 600, rx: 1226, ry: 734, halfWidth: 84, theme: 'night',
        edge: 4.26, harmonics: [{ freq: 2, amp: 0.148, phase: -2.39 }, { freq: 4, amp: 0.057, phase: -2.73 }, { freq: 8, amp: 0.01, phase: 0.44 }]
    }),
    buildTrack({
        id: 'dunas', name: 'Dunas Sinuosas', cx: 800, cy: 600, rx: 1265, ry: 739, halfWidth: 86, theme: 'sand',
        edge: 3.22, harmonics: [{ freq: 4, amp: 0.047, phase: 1.05 }, { freq: 8, amp: 0.04, phase: -2.38 }, { freq: 14, amp: 0.01, phase: -2.24 }]
    })
];

/**
 * Cara de cada ambiente no menu: o emoji e o nome do terreno. Fica aqui, ao lado
 * das cores, para uma pista nova só ter de se descrever num sítio.
 */
export const THEME_INFO = {
    grass: { emoji: '🌿', label: 'Relva' },
    sand: { emoji: '🏜️', label: 'Areia' },
    night: { emoji: '🌃', label: 'Noite' }
};

export const THEME_COLORS = {
    grass: { terrain: '#0d2b12', runoff: '#2e3a2a', asphalt: '#2a2e3a', decor: '#123a1c' },
    sand: { terrain: '#2c1a10', runoff: '#4a3826', asphalt: '#332c22', decor: '#5b4326' },
    night: { terrain: '#0a0820', runoff: '#241c33', asphalt: '#181422', decor: '#ff2fa0' }
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
