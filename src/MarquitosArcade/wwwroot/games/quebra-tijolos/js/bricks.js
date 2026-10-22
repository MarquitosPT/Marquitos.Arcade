// Os tijolos: que tipos há, e como um nível desenhado em texto vira tijolos.
//
// Cada nível (js/levels.js) é uma grelha de texto com COLS letras por linha.
// Cada letra é um tijolo — `.` é um buraco:
//
//   w o c g r b p y v   tijolos de cor, partem-se com um golpe
//   S                   prata: dois golpes
//   T                   titânio: três golpes
//   E                   TNT: rebenta e leva os vizinhos com ele
//   #                   aço: não se parte, só faz ricochete
//
// Os tijolos de cor valem mais quanto mais "quente" a cor (como na máquina de
// salão de onde o jogo vem); os especiais valem pelo trabalho que dão.

import { BRICK_H, BRICK_W, BRICKS_TOP, COLS } from './config.js';

/** Cores dos tijolos simples: base, clara (topo) e escura (fundo). */
export const BRICK_COLORS = {
    w: { name: 'branco', base: '#e8ecf5', light: '#ffffff', dark: '#a9b2c6', points: 50 },
    o: { name: 'laranja', base: '#ff9a3c', light: '#ffc58a', dark: '#c95f12', points: 60 },
    c: { name: 'ciano', base: '#3fd8f2', light: '#9cf1ff', dark: '#1192b0', points: 70 },
    g: { name: 'verde', base: '#4ade80', light: '#a4f5c1', dark: '#15964a', points: 80 },
    r: { name: 'vermelho', base: '#ff4d6a', light: '#ff9cad', dark: '#b81d3a', points: 90 },
    b: { name: 'azul', base: '#4f7dff', light: '#9db6ff', dark: '#2443b8', points: 100 },
    p: { name: 'rosa', base: '#ff6ec7', light: '#ffb3e3', dark: '#c02f8c', points: 110 },
    v: { name: 'violeta', base: '#a46bff', light: '#cfb0ff', dark: '#6a2fd0', points: 110 },
    y: { name: 'amarelo', base: '#ffd23f', light: '#fff0a8', dark: '#c99700', points: 120 }
};

/** Os especiais. `hits: Infinity` é o aço. */
export const SPECIAL_KINDS = {
    S: { kind: 'silver', hits: 2, points: 150 },
    T: { kind: 'titanium', hits: 3, points: 250 },
    E: { kind: 'tnt', hits: 1, points: 100 },
    '#': { kind: 'steel', hits: Infinity, points: 0 }
};

/** As etiquetas do que cada nível tem de especial, nos cartões e no ecrã de resultados. */
export const KIND_TAGS = {
    silver: ['🥈', 'prata'],
    titanium: ['🔩', 'titânio'],
    tnt: ['🧨', 'TNT'],
    steel: ['🛡️', 'aço']
};

/** Lê uma letra da grelha. Devolve null para um buraco. */
export function brickSpec(letter) {
    if (letter === '.' || letter === ' ') return null;
    if (SPECIAL_KINDS[letter]) return SPECIAL_KINDS[letter];
    const color = BRICK_COLORS[letter];
    if (!color) throw new Error(`Letra de tijolo desconhecida: "${letter}"`);
    return { kind: 'color', color: letter, hits: 1, points: color.points };
}

/** Os tijolos de um nível, prontos a jogar, com a posição em unidades do campo. */
export function buildBricks(level) {
    const bricks = [];
    level.grid.forEach((line, row) => {
        [...line].forEach((letter, col) => {
            const spec = brickSpec(letter);
            if (!spec) return;
            bricks.push({
                col,
                row,
                x: col * BRICK_W,
                y: BRICKS_TOP + row * BRICK_H,
                w: BRICK_W,
                h: BRICK_H,
                kind: spec.kind,
                color: spec.color || null,
                hits: spec.hits,
                maxHits: spec.hits,
                points: spec.points,
                alive: true,
                /** Brilho do golpe: sobe a 1 e apaga-se. */
                flash: 0
            });
        });
    });
    return bricks;
}

export const isBreakable = (brick) => brick.alive && brick.hits !== Infinity;

/** Quantos golpes os tijolos do nível pedem, ao todo — a base do tempo-alvo. */
export function hitsToClear(level) {
    let hits = 0;
    for (const line of level.grid) {
        for (const letter of line) {
            const spec = brickSpec(letter);
            if (spec && spec.hits !== Infinity) hits += spec.hits;
        }
    }
    return hits;
}

/** Os tipos especiais que o nível tem, pela ordem de KIND_TAGS. */
export function specialKinds(level) {
    const found = new Set();
    for (const line of level.grid) {
        for (const letter of line) if (SPECIAL_KINDS[letter]) found.add(SPECIAL_KINDS[letter].kind);
    }
    return Object.keys(KIND_TAGS).filter((kind) => found.has(kind));
}

/** Os vizinhos de um tijolo (as oito casas à volta) — o raio da TNT. */
export function neighbours(bricks, brick) {
    return bricks.filter((other) => other !== brick && other.alive
        && Math.abs(other.col - brick.col) <= 1 && Math.abs(other.row - brick.row) <= 1);
}

/** Validação dos desenhos: cada linha com COLS letras e todas conhecidas. */
export function checkGrid(level) {
    level.grid.forEach((line, row) => {
        if (line.length !== COLS) throw new Error(`Nível ${level.id}, linha ${row + 1}: ${line.length} letras em vez de ${COLS}`);
        for (const letter of line) brickSpec(letter);
    });
}
