// Construção das pistas.
//
// Há duas maneiras de descrever uma pista. A primeira é uma superelipse
// deformada por harmónicos de seno: a superelipse (o expoente `edge`) estica os
// lados em retas e junta a viragem nos cantos; os harmónicos põem curvas pelo
// meio para o traçado não ser um oval. Com dois ou três termos saem pistas com
// carácter — uma chicane, uma curva dupla, uma reta grande — sem ninguém ter de
// desenhar pontos à mão.
//
// Só que uma superelipse nunca dá um gancho nem uma serpentina: o traçado anda
// sempre à volta do centro. Para essas há a segunda maneira, `points`: uma
// lista de pontos de controlo, pela ordem em que se corre, por onde passa uma
// curva suave fechada (Catmull-Rom centrípeta, que não faz laçadas nem bicos
// mesmo com os pontos a distâncias desiguais).
//
// A curva é amostrada em fino e só depois cortada em pontos igualmente
// espaçados (STEP). Assim cada índice vale sempre a mesma distância, esteja numa
// reta ou numa curva, e uma pista maior fica simplesmente com mais pontos: é
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
 * Quanto tem de haver de reta depois de uma rampa: o voo mais comprido (a
 * fundo e com boost) mais uma folga para aterrar. E quanto pode a pista virar,
 * no total, desde um pouco antes da rampa até ao fim desse troço.
 */
const RAMP_STRAIGHT = 480;
const RAMP_MAX_TURN = 0.3;
/** Que parte da largura da faixa de rodagem a rampa ocupa. */
const RAMP_LANE_SHARE = 0.6;

/**
 * Ponto do traçado no ângulo `t`. Com `edge` a 2 é uma elipse; acima disso os
 * lados achatam-se em reta e a viragem concentra-se nos cantos.
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
 * Ponto da curva fechada que passa pelos pontos de controlo, com `u` de 0 ao
 * número de pontos: a parte inteira diz em que troço se está, a fracionária
 * onde dentro dele. É a Catmull-Rom centrípeta (parâmetros espaçados pela raiz
 * da distância entre pontos), calculada pelo algoritmo de Barry-Goldman.
 */
function splinePoint(ctrl, u) {
    const K = ctrl.length;
    const i = Math.floor(u) % K;
    const f = u - Math.floor(u);
    const P = [ctrl[(i - 1 + K) % K], ctrl[i], ctrl[(i + 1) % K], ctrl[(i + 2) % K]];
    const knot = (a, b) => Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0, t1 = t0 + knot(P[0], P[1]), t2 = t1 + knot(P[1], P[2]), t3 = t2 + knot(P[2], P[3]);
    const t = t1 + (t2 - t1) * f;
    const lerp = (a, b, ta, tb) => {
        const w = (t - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
    };
    const A1 = lerp(P[0], P[1], t0, t1), A2 = lerp(P[1], P[2], t1, t2), A3 = lerp(P[2], P[3], t2, t3);
    const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
    const [x, y] = lerp(B1, B2, t1, t2);
    return { x, y };
}

/**
 * Linha central a passo constante. Nas superelipses a partida fica a meio do
 * lado de baixo (t = PI/2) e o ângulo diminui, para a corrida seguir no
 * sentido contrário ao dos ponteiros do relógio; nas pistas por pontos a
 * partida é o primeiro ponto, e corre-se pela ordem da lista.
 */
function centerLine(def) {
    const raw = [];
    for (let i = 0; i < RAW; i++) {
        raw.push(def.points
            ? splinePoint(def.points, (i / RAW) * def.points.length)
            : shapePoint(def, Math.PI / 2 - (i / RAW) * Math.PI * 2));
    }
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
 * Quanto custa a pista a quem a corre. Entram duas coisas: a curva mais
 * fechada e o quanto se vira ao longo da volta toda.
 *
 * O raio de cada ponto sai da rotação da tangente ao longo de um pedaço fixo de
 * pista — é a mesma conta que o carro faz, ao contrário, quando tem de escolher
 * a que velocidade entra. Comparado com o raio que se faz a fundo, diz se há
 * curvas onde é preciso travar ou derrapar. Mas uma pista de ganchos seguidos
 * custa mais do que uma com uma curva apertada só, e é isso que mede a viragem
 * por cada 1000 unidades de pista.
 *
 * Daqui saem a ordem das pistas (da mais fácil à mais difícil, que é também a
 * ordem do campeonato) e o grau de perícia que o menu mostra. São medidos e não
 * escritos à mão, por isso uma pista nova arruma-se sozinha e nenhuma pode
 * mentir sobre o que é.
 */
function corneringProfile(tang, ds) {
    const N = tang.length;
    const span = 2 * CURVE_WINDOW * ds;
    let minRadius = Infinity, totalTurn = 0;
    for (let i = 0; i < N; i++) {
        const a = tang[(i - CURVE_WINDOW + N) % N], b = tang[(i + CURVE_WINDOW) % N];
        const turn = Math.abs(normAngle(Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)));
        if (turn > 1e-6) minRadius = Math.min(minRadius, span / turn);
        const c = tang[(i + 1) % N];
        totalTurn += Math.abs(normAngle(Math.atan2(c.y, c.x) - Math.atan2(tang[i].y, tang[i].x)));
    }
    const twist = (totalTurn / (N * ds)) * 1000;
    const difficulty = NO_LIFT_RADIUS / minRadius + twist * 0.5;
    const grade = difficulty < 1.6 ? 1 : difficulty < 2.0 ? 2 : difficulty < 2.4 ? 3 : 4;
    return { minRadius, difficulty, grade };
}

/**
 * Onde ficam as rampas: nas retas mais compridas da pista, uma ou duas.
 *
 * O voo é a direito, por isso a rampa tem de estar no começo de um troço que
 * continue reto até lá à frente, para quem entra bem alinhado aterrar no
 * alcatrão — quem entra torto é que sai da pista, e esse é o castigo. Nada de
 * rampas em cima da meta, de um posto de turbo ou de uma poça de óleo.
 *
 * Cada uma fica numa das faixas de rodagem (uma de cada lado, alternadamente),
 * centrada nela e com 60% da sua largura: sobra margem dos dois lados da
 * rampa, e saltar é uma escolha — quem não quer passa pela outra faixa.
 *
 * Numa pista sem retas compridas (o Trevo é só ganchos) contenta-se com retas
 * mais curtas, de degrau em degrau, até caber pelo menos uma rampa.
 */
function placeRamps(track) {
    for (const straight of [RAMP_STRAIGHT, RAMP_STRAIGHT * 0.8, RAMP_STRAIGHT * 0.65, RAMP_STRAIGHT * 0.5]) {
        const ramps = placeRampsWithin(track, straight);
        if (ramps.length) return ramps;
    }
    return [];
}

function placeRampsWithin({ pts, tang, norm, N, total, pads, oils, halfWidth }, straight) {
    const ds = total / N;
    const before = Math.round(60 / ds), after = Math.round(straight / ds);
    const angle = (i) => Math.atan2(tang[i % N].y, tang[i % N].x);
    const near = (i, j, d) => { let k = Math.abs(i - j); if (k > N / 2) k = N - k; return k <= d; };
    const keepClear = Math.round(200 / ds);
    const candidates = [];
    for (let i = Math.round(400 / ds); i < N - Math.round(300 / ds); i++) {
        if (pads.some((p) => near(i, p, keepClear)) || oils.some((o) => near(i, o.idx, keepClear))) continue;
        let turn = 0;
        for (let k = i - before; k < i + after; k++) turn += Math.abs(normAngle(angle(k + 1) - angle(k)));
        if (turn < RAMP_MAX_TURN) candidates.push({ i, turn });
    }
    candidates.sort((a, b) => a.turn - b.turn);
    const chosen = [];
    for (const c of candidates) {
        if (chosen.length >= 2) break;
        if (chosen.some((r) => near(c.i, r, N / 3))) continue;
        chosen.push(c.i);
    }
    chosen.sort((a, b) => a - b);
    return chosen.map((idx, k) => {
        // A faixa vai da linha central à guia (largura `halfWidth`): o centro
        // dela fica a meio caminho, e a rampa ocupa RAMP_LANE_SHARE dela.
        const offset = (k % 2 === 0 ? -1 : 1) * halfWidth * 0.5;
        const p = pts[idx], n = norm[idx];
        return { idx, offset, halfSpan: halfWidth * 0.5 * RAMP_LANE_SHARE, x: p.x + n.x * offset, y: p.y + n.y * offset, angle: angle(idx) };
    });
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
    // As pistas por pontos não dizem onde é o centro: é o da caixa envolvente
    // (é para lá que o menu aponta a câmara).
    if (def.points) def = { ...def, cx: minX + bbox.w / 2, cy: minY + bbox.h / 2 };

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

    const ramps = placeRamps({ pts, tang, norm, N, total, pads, oils, halfWidth: def.halfWidth });

    // Barreiras ao longo do limite da escapatória, dos dois lados e a passo
    // constante. Não travam nada por si — são a cara do limite, para se ver até
    // onde é que o carro pode ir sem ter de haver uma linha pintada no chão.
    const barrierAt = def.halfWidth + RUNOFF + 12;
    const step = Math.max(1, Math.round(BARRIER_SPACING / (total / N)));
    const barriers = [];
    // Do lado de dentro de um gancho apertado o limite da escapatória cruza a
    // própria pista; uma barreira ali ficava pousada em cima do alcatrão. Só se
    // põem as que ficam de facto à distância do limite de toda a linha central.
    const clearOfTrack = (x, y) => {
        const min2 = (barrierAt - 8) ** 2;
        for (let k = 0; k < N; k += 2) {
            const dx = pts[k].x - x, dy = pts[k].y - y;
            if (dx * dx + dy * dy < min2) return false;
        }
        return true;
    };
    for (const side of [1, -1]) {
        for (let i = 0; i < N; i += step) {
            const p = pts[i], n = norm[i], tg = tang[i];
            const x = p.x + n.x * barrierAt * side, y = p.y + n.y * barrierAt * side;
            if (!clearOfTrack(x, y)) continue;
            barriers.push({ x, y, angle: Math.atan2(tg.y, tg.x), variant: (i / step) % 3 });
        }
    }
    // O mesmo para o rail corrido das pistas de noite: ponto a ponto, se aquele
    // bocado do limite fica fora da pista. O render só o traça onde fica.
    const railClear = {};
    for (const side of [1, -1]) {
        railClear[side] = pts.map((p, i) => clearOfTrack(p.x + norm[i].x * barrierAt * side, p.y + norm[i].y * barrierAt * side));
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

    return { ...def, runoff: RUNOFF, barrierAt, pts, tang, norm, total, N, bbox, pads, oils, ramps, barriers, railClear, decor, ...corneringProfile(tang, total / N) };
}

/**
 * As pistas, da mais fácil à mais difícil pela medida de `corneringProfile`.
 * É esta a ordem dos cartões no menu e a ordem das corridas do campeonato, que
 * as corre todas: começa-se a aquecer e acaba-se nos ganchos.
 */
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
    }),
    // As de baixo descrevem-se por pontos de controlo (ver splinePoint): são as
    // que têm ganchos, serpentinas e esses, que nenhuma superelipse dá.
    buildTrack({
        id: 'feijao', name: 'Feijão', halfWidth: 92, theme: 'grass',
        points: [[700, 1450], [1300, 1460], [1900, 1400], [2350, 1220], [2560, 900], [2480, 540], [2150, 300], [1700, 260], [1350, 420], [1150, 700], [850, 780], [560, 620], [420, 360], [180, 380], [60, 750], [150, 1150], [380, 1380]]
    }),
    buildTrack({
        id: 'serpentina', name: 'Serpentina', halfWidth: 88, theme: 'sand',
        points: [[900, 1550], [400, 1550], [150, 1300], [150, 900], [350, 650], [750, 600], [1050, 750], [1250, 1000], [1550, 1050], [1800, 850], [1850, 500], [2050, 250], [2450, 250], [2650, 500], [2600, 850], [2350, 1100], [2100, 1300], [1700, 1450], [1300, 1550]]
    }),
    buildTrack({
        id: 'trevo', name: 'Trevo', halfWidth: 86, theme: 'night',
        points: [[1520, 1380], [1520, 1480], [1470, 1640], [1300, 1720], [1130, 1640], [1080, 1480], [1080, 1290], [1036, 1164], [910, 1120], [700, 1120], [520, 1120], [330, 1070], [250, 900], [330, 730], [520, 680], [700, 680], [910, 680], [1036, 636], [1080, 510], [1080, 350], [1130, 160], [1300, 80], [1470, 160], [1520, 350], [1520, 510], [1564, 636], [1690, 680], [1900, 680], [2080, 680], [2270, 730], [2350, 900], [2270, 1070], [2080, 1120], [1900, 1120], [1690, 1120], [1564, 1164], [1520, 1290]]
    }),
    buildTrack({
        id: 'ziguezague', name: 'Ziguezague', halfWidth: 84, theme: 'grass',
        points: [[1500, 1480], [900, 1480], [380, 1470], [170, 1320], [150, 900], [150, 420], [206, 286], [340, 230], [474, 286], [530, 420], [530, 700], [530, 900], [586, 1034], [720, 1090], [854, 1034], [910, 900], [910, 700], [910, 420], [966, 286], [1100, 230], [1234, 286], [1290, 420], [1290, 700], [1290, 900], [1346, 1034], [1480, 1090], [1614, 1034], [1670, 900], [1670, 700], [1670, 420], [1726, 286], [1860, 230], [1994, 286], [2050, 420], [2050, 900], [2010, 1250], [1880, 1450]]
    }),
    buildTrack({
        id: 'esses', name: 'Esses do Lago', halfWidth: 86, theme: 'sand',
        points: [[500, 1500], [1200, 1500], [1900, 1500], [2350, 1350], [2500, 1000], [2300, 700], [1900, 650], [1600, 800], [1300, 1050], [950, 1100], [750, 850], [900, 550], [800, 250], [450, 180], [200, 400], [150, 800], [200, 1200]]
    }),
    buildTrack({
        id: 'grampo', name: 'Grampo Neon', halfWidth: 82, theme: 'night',
        points: [[460, 1600], [960, 1600], [1260, 1660], [1560, 1600], [1740, 1600], [2100, 1500], [2236, 1150], [2236, 600], [2100, 300], [1740, 250], [1100, 250], [620, 260], [364, 380], [324, 620], [500, 760], [1020, 760], [1540, 760], [1740, 800], [1836, 970], [1740, 1140], [1540, 1180], [1020, 1180], [540, 1180], [364, 1280], [324, 1450]]
    })
].sort((a, b) => a.difficulty - b.difficulty);

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
