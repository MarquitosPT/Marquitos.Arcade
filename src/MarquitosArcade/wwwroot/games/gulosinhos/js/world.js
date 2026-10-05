// O gerador dos percursos.
//
// Os níveis não estão desenhados à mão: cada um sai de uma semente e de uma
// receita (ver levels.js), como os labirintos do Maze Run. O percurso é
// montado da esquerda para a direita, troço a troço — um buraco, uma escada,
// um guardião a patrulhar, uma parede de caixotes com uma bomba-relógio à
// frente — até o tempo estimado chegar ao que a receita pede. É por isso que
// todos os níveis duram mais ou menos o mesmo (1:30 a 2:00 a jogar), sejam
// feitos de troços rápidos ou de troços de esperar.
//
// Cada troço é escrito a contar com o salto do bicho (config.js): nenhum
// degrau sobe mais do que `MAX_STEP_UP`, nenhum buraco é mais largo do que o
// salto alcança, e as guloseimas ficam só onde se chega. Quem acrescentar um
// troço novo tem de cumprir as mesmas contas — o smoke-test
// (`gulosinhos-percursos`) verifica-as nos níveis todos.
//
// Este módulo não importa nada do SDK nem do DOM: corre também no Node, que é
// onde se afinam os níveis.

import { BOMB_FUSE, ROWS, RUN_SPEED } from './config.js';
import { createRng } from './rng.js';

/** Os tipos de tile. O que não é tile (guloseimas, guardiões, molas…) é entidade. */
export const T = {
    EMPTY: 0,
    /** Terra, com relva por cima quando nada a tapa. */
    GROUND: 1,
    /** Bloco flutuante, sólido de todos os lados. */
    BLOCK: 2,
    /** Plataforma que só segura por cima: atravessa-se a subir. */
    PLATFORM: 3,
    /** Picos: não seguram, picam. */
    SPIKES: 4,
    /** Caixote: sólido até uma bomba o desfazer. */
    CRATE: 5,
    /** Bolacha que se desfaz pouco depois de se pôr o pé em cima. */
    CRUMBLE: 6
};

export const isSolidTile = (t) => t === T.GROUND || t === T.BLOCK || t === T.CRATE;
export const isOneWayTile = (t) => t === T.PLATFORM || t === T.CRUMBLE;

/** O salto mais alto sobe ~2,8 tiles: dois de degrau deixam folga. */
export const MAX_STEP_UP = 2;
/** O salto a correr vai ~4,8 tiles: quatro de buraco deixam folga. */
export const MAX_GAP = 4;

/** Linhas onde pode estar o chão: nem colado ao céu, nem sem terra por baixo. */
const TOP_LIMIT = 7;
const BOTTOM_LIMIT = 13;
/** Mais alto do que isto só os planaltos das molas e dos elevadores. */
const PLATEAU_LIMIT = 4;
const START_GROUND = 12;

/** Quanto mais devagar do que a correr a direito se faz um percurso bem jogado. */
const PAR_FACTOR = 1.15;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- O construtor ----------

function createBuilder(level) {
    const rng = createRng(level.seed);
    /** Uma coluna de `ROWS` tiles por cada coluna do percurso. */
    const columns = [];
    const ensure = (c) => {
        while (columns.length <= c) columns.push(new Uint8Array(ROWS));
    };

    const out = {
        candies: [],
        guards: [],
        plants: [],
        bombs: [],
        springs: [],
        movers: [],
        checkpoints: [],
        decor: [],
        /** Que troço começa em que coluna — para quem afina os níveis. */
        segments: [],
        spawn: null,
        goal: null
    };

    let candyKind = 0;

    const b = {
        rng,
        /** Dificuldade da receita, de 0 a 1: alarga buracos e acelera guardiões. */
        d: level.difficulty,
        level,
        out,
        /** A próxima coluna por escrever. */
        x: 0,
        /** A linha do topo do chão onde se vai (a linha onde assentam os pés). */
        g: START_GROUND,
        /** Segundos estimados de percurso, para quem joga bem. */
        est: 0,

        set(c, r, t) {
            if (r < 0 || r >= ROWS || c < 0) return;
            ensure(c);
            columns[c][r] = t;
        },
        get(c, r) {
            if (c < 0 || c >= columns.length || r < 0 || r >= ROWS) return T.EMPTY;
            return columns[c][r];
        },

        /** Chão de `len` colunas com o topo em `top`. */
        ground(len, top = b.g) {
            for (let i = 0; i < len; i++) {
                for (let r = top; r < ROWS; r++) b.set(b.x + i, r, T.GROUND);
            }
            b.x += len;
            b.g = top;
            b.est += len / RUN_SPEED;
        },

        /** Buraco sem fundo: cair é perder um coração. */
        pit(len) {
            ensure(b.x + len - 1);
            b.x += len;
            b.est += len / RUN_SPEED + 0.08;
        },

        /** Segundos que um troço obriga a esperar (uma planta, uma bomba, uma plataforma). */
        wait(seconds) {
            b.est += seconds;
        },

        platform(c0, len, row, type = T.PLATFORM) {
            for (let i = 0; i < len; i++) b.set(c0 + i, row, type);
        },

        /** Uma guloseima com o centro em (cx, cy), em tiles. */
        candy(cx, cy, big = false) {
            out.candies.push({ x: cx, y: cy, big, kind: big ? 0 : candyKind++ % 4 });
        },

        /** Uma fila de guloseimas na linha `row`, de `step` em `step` colunas. */
        candyRow(c0, count, row, step = 1) {
            for (let i = 0; i < count; i++) b.candy(c0 + i * step + 0.5, row + 0.5);
        },

        /**
         * Um arco de guloseimas por cima de um salto: de (x0, chão g0) a (x1,
         * chão g1), a subir `peak` tiles acima da reta entre os dois. É o
         * caminho do bicho no ar, por isso apanha-se a saltar.
         */
        candyArc(x0, g0, x1, g1, peak = 1.8) {
            const n = Math.max(2, Math.round((x1 - x0) / 1.6));
            for (let i = 1; i < n; i++) {
                const t = i / n;
                const base = g0 + (g1 - g0) * t;
                const y = base - 0.55 - peak * 4 * t * (1 - t);
                // O teto do arco é o do salto: nada acima de 2,2 tiles do chão de partida.
                b.candy(x0 + (x1 - x0) * t, Math.max(y, Math.min(g0, g1) - 2.6));
            }
        },

        /** Plantas, arbustos e pedras de enfeite — não seguram nem picam. */
        decorate(c0, c1, top = b.g) {
            for (let c = c0; c < c1; c++) {
                if (rng.chance(0.22)) out.decor.push({ x: c + 0.5, y: top, kind: rng.int(0, 3), size: 0.7 + rng.next() * 0.6 });
            }
        }
    };

    function finish() {
        const cols = columns.length;
        const tiles = new Uint8Array(cols * ROWS);
        columns.forEach((column, c) => {
            for (let r = 0; r < ROWS; r++) tiles[r * cols + c] = column[r];
        });
        return { cols, rows: ROWS, tiles, ...out };
    }

    return { b, finish };
}

// ---------- Os troços ----------

/** Escolhe uma mudança de altura que deixe o chão entre os limites. */
function pickDh(b, options) {
    const ok = options.filter((dh) => b.g + dh >= TOP_LIMIT && b.g + dh <= BOTTOM_LIMIT);
    return ok.length ? b.rng.pick(ok) : 0;
}

/**
 * Quando o chão está lá em cima (depois de uma mola ou de um elevador), os
 * troços que descem ganham peso: senão o percurso ficava colado ao céu.
 */
const isHigh = (b) => b.g < TOP_LIMIT + 1;

const SEGMENTS = {
    /** Chão a direito, com umas guloseimas e enfeites. O respiro entre desafios. */
    flat: {
        weight: 0.8,
        build(b) {
            const len = b.rng.int(5, 8);
            const x0 = b.x;
            b.ground(len);
            if (b.rng.chance(0.5)) b.candyRow(x0 + 1, Math.min(3, len - 2), b.g - 1);
            else b.candyArc(x0 + 0.5, b.g, x0 + len - 0.5, b.g, 1.5);
            b.decorate(x0, x0 + len);
        }
    },

    /** Uma escada de dois ou três degraus, a subir ou a descer. */
    stairs: {
        weight: 1,
        build(b) {
            const up = isHigh(b) ? false : b.g >= 11 ? true : b.rng.chance(0.5);
            const steps = b.rng.int(2, 3);
            for (let s = 0; s < steps; s++) {
                const h = b.rng.int(1, b.d > 0.35 ? MAX_STEP_UP : 1);
                const top = clamp(b.g + (up ? -h : h), up ? TOP_LIMIT : PLATEAU_LIMIT, BOTTOM_LIMIT);
                const width = b.rng.int(2, 4);
                const x0 = b.x;
                b.ground(width, top);
                b.candy(x0 + width / 2, top - 1.6);
            }
            b.wait(0.15 * steps);
        }
    },

    /** Um salto por cima de um buraco, para o mesmo nível, um acima ou uns abaixo. */
    gap: {
        weight: 1.4,
        build(b) {
            const dh = isHigh(b) ? b.rng.pick([2, 3]) : pickDh(b, [0, 0, -1, 1, 2]);
            const maxWidth = dh < 0 ? 3 : MAX_GAP;
            const width = clamp(2 + Math.round(b.d * 1.6 + b.rng.next() * 1.4), 2, maxWidth);
            const x0 = b.x;
            const g0 = b.g;
            b.pit(width);
            const g1 = clamp(g0 + dh, TOP_LIMIT, BOTTOM_LIMIT);
            b.ground(b.rng.int(4, 6), g1);
            b.candyArc(x0 - 0.5, g0, x0 + width + 0.5, g1, 1.7);
            b.wait(0.1);
        }
    },

    /** Pilares por cima de um buraco comprido: saltinhos de precisão. */
    pillars: {
        feature: 'pillars',
        weight: 1,
        build(b) {
            const count = b.rng.int(2, 3 + Math.round(b.d));
            for (let k = 0; k < count; k++) {
                const top = clamp(b.g + b.rng.pick([-1, 0, 0, 1]), TOP_LIMIT, BOTTOM_LIMIT);
                // A subir, o buraco é mais curto; e nenhum pilar é tão estreito
                // que obrigue a parar no ar ao píxel.
                b.pit(top < b.g ? 2 : b.rng.int(2, b.d > 0.5 ? 3 : 2));
                const width = b.rng.int(2, 3);
                const x0 = b.x;
                b.ground(width, top);
                b.candy(x0 + width / 2, top - 1.6);
            }
            b.pit(2);
            b.ground(4, clamp(b.g + b.rng.pick([0, 1]), TOP_LIMIT, BOTTOM_LIMIT));
            b.wait(0.25 * count);
        }
    },

    /**
     * Plataformas em escada por cima do caminho, com a guloseima grande lá no
     * alto. É um desvio: quem tem pressa passa por baixo.
     */
    tower: {
        weight: 0.7,
        fits: (b) => b.g >= TOP_LIMIT,
        build(b) {
            const x0 = b.x;
            b.ground(12);
            b.platform(x0 + 2, 3, b.g - 2);
            b.candyRow(x0 + 2, 3, b.g - 3);
            b.platform(x0 + 6, 3, b.g - 4);
            b.candy(x0 + 7.5, b.g - 5, true);
            b.platform(x0 + 10, 2, b.g - 2);
            b.candy(x0 + 11, b.g - 3);
            b.decorate(x0, x0 + 2);
            b.wait(1.4);
        }
    },

    /** Um guardião de geleia a patrulhar as guloseimas. Salta-se-lhe em cima. */
    jelly: {
        feature: 'jelly',
        weight: 1.1,
        build(b) {
            const len = b.rng.int(10, 13);
            const x0 = b.x;
            b.ground(len);
            b.out.guards.push(guard('jelly', x0, len, b.g, 1.6 + b.d * 1.2, b.rng));
            b.candyRow(x0 + 3, 3, b.g - 1, 2);
            b.wait(0.7);
        }
    },

    /** Um ressalto de blocos com um guardião em cima e guloseimas por cima e por baixo. */
    ledge: {
        feature: 'jelly',
        weight: 0.8,
        fits: (b) => b.g >= TOP_LIMIT + 1,
        build(b) {
            const x0 = b.x;
            b.ground(13);
            const row = b.g - 2;
            b.platform(x0 + 3, 7, row, T.BLOCK);
            b.out.guards.push(guard('jelly', x0 + 3, 7, row, 1.5 + b.d, b.rng));
            b.candyRow(x0 + 4, 3, row - 1, 2);
            b.candyRow(x0 + 5, 2, b.g - 1, 2);
            b.wait(0.8);
        }
    },

    /** O ouriço: pica por cima, por isso salta-se por cima dele — ou pela plataforma. */
    hedgehog: {
        feature: 'hedgehog',
        weight: 1,
        build(b) {
            const len = b.rng.int(11, 14);
            const x0 = b.x;
            b.ground(len);
            b.out.guards.push(guard('hedgehog', x0, len, b.g, 2 + b.d * 1.4, b.rng));
            b.platform(x0 + 3, 5, b.g - 2);
            b.candyRow(x0 + 3, 3, b.g - 3, 2);
            b.wait(0.9);
        }
    },

    /** Abelhas a subir e a descer por cima do caminho. Passa-se quando estão lá em cima. */
    bees: {
        feature: 'bees',
        weight: 1,
        build(b) {
            const len = b.rng.int(11, 14);
            const x0 = b.x;
            b.ground(len);
            const count = b.d > 0.5 ? 2 : 1;
            for (let k = 0; k < count; k++) {
                const bx = x0 + 3.5 + k * 5;
                b.out.guards.push({
                    type: 'bee', x: bx, y: b.g - 2.6, baseY: b.g - 2.6, amp: 1.5,
                    rate: 2.2 + b.d * 1.2, phase: b.rng.next() * Math.PI * 2, minX: bx, maxX: bx
                });
                b.candy(bx, b.g - 4.6);
                b.candy(bx + 2, b.g - 0.5);
            }
            b.wait(0.9 * count);
        }
    },

    /** Plantas carnívoras em vasos: sai-se de baixo delas a tempo. */
    plants: {
        feature: 'plants',
        weight: 1.1,
        build(b) {
            const len = b.rng.int(10, 14);
            const x0 = b.x;
            b.ground(len);
            const count = b.d > 0.45 ? 2 : 1;
            for (let k = 0; k < count; k++) {
                const px = x0 + 4 + k * 5;
                b.out.plants.push({ x: px + 0.5, y: b.g, phase: k * 1.3 + b.rng.next() * 0.8 });
                b.candy(px + 0.5, b.g - 3.2);
                b.candy(px + 2.5, b.g - 0.5);
            }
            b.wait(1.1 * count);
        }
    },

    /** Uma mola ao pé de uma parede que nenhum salto vence. Lá em cima, um planalto. */
    spring: {
        feature: 'springs',
        weight: 1,
        fits: (b) => b.g - 4 >= PLATEAU_LIMIT,
        build(b) {
            const top = Math.max(PLATEAU_LIMIT, b.g - 5);
            const x0 = b.x;
            const g0 = b.g;
            b.ground(4);
            b.out.springs.push({ x: x0 + 2.5, y: g0 });
            for (let y = g0 - 2; y > top - 1; y -= 1.5) b.candy(x0 + 2.5, y - 0.5);
            const len = b.rng.int(5, 7);
            const x1 = b.x;
            b.ground(len, top);
            b.candy(x1 + len - 1.5, top - 0.5, true);
            b.decorate(x1, x1 + len - 2, top);
            b.wait(0.5);
        }
    },

    /** Um elevador para um planalto. Cair ao lado é cair num buraco. */
    lift: {
        feature: 'lifts',
        weight: 0.9,
        fits: (b) => b.g - 4 >= PLATEAU_LIMIT,
        build(b) {
            const top = Math.max(PLATEAU_LIMIT, b.g - b.rng.int(4, 5));
            const x0 = b.x;
            const g0 = b.g;
            b.ground(3);
            b.pit(2);
            const speed = 2.2 + b.d * 0.8;
            b.out.movers.push({ x: x0 + 3, y: g0, w: 2, axis: 'y', from: g0, to: top, speed });
            for (let y = g0 - 2; y > top - 1; y -= 1.5) b.candy(x0 + 4, y - 0.5);
            b.ground(b.rng.int(5, 7), top);
            b.wait((g0 - top) / speed * 1.4);
        }
    },

    /** Uma plataforma a ir e vir por cima de um buraco largo de mais para saltar. */
    mover: {
        feature: 'movers',
        weight: 1.1,
        build(b) {
            const width = b.rng.int(6, 8 + Math.round(b.d * 2));
            const x0 = b.x;
            b.pit(width);
            const speed = 2 + b.d * 1.2;
            const from = x0 + 0.15;
            const to = x0 + width - 2.65;
            b.out.movers.push({ x: from, y: b.g, w: 2.5, axis: 'x', from, to, speed });
            for (let cx = x0 + 1.5; cx < x0 + width - 0.5; cx += 2) b.candy(cx, b.g - 1.6);
            b.ground(4);
            b.wait((to - from) / speed * 0.9);
        }
    },

    /** Uma ponte de bolachas que se desfazem: não se pode parar a meio. */
    crumble: {
        feature: 'crumble',
        weight: 1,
        build(b) {
            const width = b.rng.int(6, 8 + Math.round(b.d * 3));
            const x0 = b.x;
            const g0 = b.g;
            b.pit(width);
            b.platform(x0, width, g0, T.CRUMBLE);
            b.candyRow(x0 + 1, Math.floor(width / 2), g0 - 2, 2);
            b.ground(4, g0);
        }
    },

    /**
     * Uma parede de caixotes alta de mais para saltar, com uma bomba-relógio à
     * frente. Chega-se perto, ela começa a contar, e quem se afastar a tempo
     * vê a parede ir pelos ares. Atrás dela, a guloseima grande.
     */
    bombWall: {
        feature: 'bombs',
        weight: 1,
        fits: (b) => b.g - 4 >= 1,
        build(b) {
            const x0 = b.x;
            b.ground(10);
            // A bomba encostada à parede: para fugir dela basta recuar, sem ter
            // de passar por cima dela.
            b.out.bombs.push({ x: x0 + 4.45, y: b.g });
            for (let c = x0 + 5; c <= x0 + 6; c++) {
                for (let r = b.g - 4; r < b.g; r++) b.set(c, r, T.CRATE);
            }
            b.candy(x0 + 1.5, b.g - 0.5);
            b.candy(x0 + 8.5, b.g - 0.5, true);
            b.wait(BOMB_FUSE + 0.6);
        }
    },

    /** Um corredor de bombas: a correr passa-se; quem parar a meio leva com elas. */
    bombAlley: {
        feature: 'bombs',
        weight: 0.8,
        build(b) {
            const len = b.rng.int(15, 18);
            const x0 = b.x;
            b.ground(len);
            const count = b.d > 0.5 ? 3 : 2;
            for (let k = 0; k < count; k++) {
                const bx = x0 + 4.5 + k * 5;
                b.out.bombs.push({ x: bx, y: b.g });
                b.candy(bx, b.g - 1.8);
            }
            b.wait(0.4);
        }
    },

    /** Picos no chão: salta-se por cima, ou pelas plataformas quando são muitos. */
    spikes: {
        feature: 'spikes',
        weight: 1,
        build(b) {
            const x0 = b.x;
            if (b.d < 0.45 || b.rng.chance(0.5)) {
                const count = b.rng.int(2, 3);
                b.ground(8);
                for (let c = x0 + 3; c < x0 + 3 + count; c++) b.set(c, b.g - 1, T.SPIKES);
                b.candyArc(x0 + 2, b.g, x0 + 4 + count, b.g, 1.7);
                return;
            }
            const len = b.rng.int(10, 12);
            b.ground(len);
            for (let c = x0 + 2; c < x0 + len - 2; c++) b.set(c, b.g - 1, T.SPIKES);
            for (let c = x0 + 2; c < x0 + len - 3; c += 4) {
                b.platform(c, 2, b.g - 2);
                b.candy(c + 1, b.g - 3.5);
            }
            b.wait(0.6);
        }
    },

    /** Uma descida a pique: cair do alto não magoa. */
    drop: {
        weight: 0.4,
        fits: (b) => b.g <= BOTTOM_LIMIT - 2,
        build(b) {
            const top = clamp(b.g + b.rng.int(2, 4), TOP_LIMIT, BOTTOM_LIMIT);
            const x0 = b.x;
            b.ground(b.rng.int(5, 7), top);
            b.candy(x0 + 1, top - 2);
            b.decorate(x0 + 2, b.x, top);
        }
    }
};

/** Os troços que se podem pôr num planalto, colado ao céu. */
const HIGH_SEGMENTS = ['flat', 'stairs', 'gap', 'drop'];

/** Um guardião que patrulha o chão de um troço, de ponta a ponta com uma folga. */
function guard(type, x0, len, y, speed, rng) {
    return {
        type,
        x: x0 + len / 2,
        y,
        minX: x0 + 1.4,
        maxX: x0 + len - 1.4,
        speed,
        dir: rng.chance(0.5) ? 1 : -1
    };
}

// ---------- O nível ----------

/** O troço com a bandeira onde se recomeça depois de cair. */
function checkpoint(b) {
    const x0 = b.x;
    b.ground(6);
    b.out.checkpoints.push({ x: x0 + 3, y: b.g });
    b.decorate(x0 + 4, x0 + 6);
}

/**
 * Monta o percurso de um nível a partir da receita. A mesma receita dá sempre
 * o mesmo percurso.
 *
 * @returns o mundo: `tiles` (linha a linha), `cols` e `rows`, as entidades nos
 *   sítios de partida, `spawn`, `goal`, `par` (tempo-alvo, em segundos) e
 *   `estimate` (o tempo de quem corre o nível sem hesitar).
 */
export function buildWorld(level) {
    const { b, finish } = createBuilder(level);
    const available = Object.keys(SEGMENTS).filter((name) => {
        const feature = SEGMENTS[name].feature;
        return !feature || level.features.includes(feature);
    });

    // A partida: chão a direito para olhar à volta.
    b.ground(7);
    b.out.spawn = { x: 2.5, y: b.g };
    b.decorate(4, 7);

    // A meta conta para o tempo: o último troço é sempre o mesmo.
    const finishEstimate = 16 / RUN_SPEED;
    const target = level.target - finishEstimate;
    const checkpointsAt = [target / 3, (target * 2) / 3];
    let last = null;

    while (b.est < target) {
        if (checkpointsAt.length && b.est >= checkpointsAt[0]) {
            checkpointsAt.shift();
            checkpoint(b);
            last = null;
            continue;
        }

        // Lá em cima (num planalto) só há troços que descem ou andam a direito:
        // os outros contam com céu por cima do chão.
        const entries = available
            .filter((name) => name !== last && (SEGMENTS[name].fits?.(b) ?? true))
            .filter((name) => !isHigh(b) || HIGH_SEGMENTS.includes(name))
            .map((name) => {
                const seg = SEGMENTS[name];
                let weight = seg.weight;
                // O que o nível apresenta pela primeira vez aparece mais vezes.
                if (seg.feature && level.focus?.includes(seg.feature)) weight *= 2.2;
                if (isHigh(b) && (name === 'gap' || name === 'stairs' || name === 'drop')) weight *= 3;
                return [name, weight];
            });
        last = b.rng.weighted(entries);
        b.out.segments.push({ name: last, x: b.x });
        SEGMENTS[last].build(b);
    }

    // A meta: o frasco das guloseimas, com chão a direito à volta.
    const x0 = b.x;
    b.ground(16);
    b.out.goal = { x: x0 + 8, y: b.g };
    b.decorate(x0 + 11, x0 + 16);

    const world = finish();
    world.estimate = b.est;
    world.par = Math.ceil((b.est * PAR_FACTOR) / 5) * 5;
    return world;
}

// ---------- Leitura do mundo ----------

/** O tile em (c, r). As paredes dos lados seguram; o céu e o fundo não. */
export function tileAt(world, c, r) {
    if (c < 0 || c >= world.cols) return T.GROUND;
    if (r < 0 || r >= world.rows) return T.EMPTY;
    return world.tiles[r * world.cols + c];
}

export function setTile(world, c, r, t) {
    if (c < 0 || c >= world.cols || r < 0 || r >= world.rows) return;
    world.tiles[r * world.cols + c] = t;
}

/**
 * O perfil do chão: para cada coluna, a linha do primeiro tile sólido, ou
 * `rows` onde há buraco. É o que os cartões do menu desenham.
 */
export function groundProfile(world) {
    const profile = new Array(world.cols);
    for (let c = 0; c < world.cols; c++) {
        let top = world.rows;
        for (let r = 0; r < world.rows; r++) {
            const t = tileAt(world, c, r);
            if (t === T.GROUND) { top = r; break; }
        }
        profile[c] = top;
    }
    return profile;
}
