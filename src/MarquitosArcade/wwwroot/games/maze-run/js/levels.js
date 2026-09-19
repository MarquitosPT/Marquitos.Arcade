// Os níveis do Maze Run.
//
// Um nível é uma receita: o tamanho do labirinto, a semente, quantos cristais,
// que guardas e quanto tempo. O labirinto sai da semente (ver maze.js) e as
// colocações saem daqui — por isso **acrescentar um nível é acrescentar uma
// entrada ao array `LEVELS`**, e mais nada. Não há mapas desenhados à mão para
// manter nem ficheiros de dados à parte.
//
// O que cada campo faz:
//
//   cols, rows   tamanho do labirinto em células (acertados para ímpar)
//   seed         a semente: o mesmo número dá sempre o mesmo labirinto
//   braid        de 0 a 1, quantos becos sem saída se abrem (ver maze.js)
//   crystals     cristais a apanhar antes de a saída abrir
//   guards       os guardas, pela ordem por que aparecem: { kind, speed }
//   seconds      o tempo da tentativa
//   par          o tempo-alvo: abaixo dele ganha-se a segunda estrela
//   lives        vidas da tentativa (por omissão, DEFAULT_LIVES)
//   accent       a cor do nível — paredes, HUD e cartão do menu

import { DEFAULT_LIVES, MAX_STARS } from './config.js';
import { buildMaze, distanceField, exitsFrom } from './maze.js';

/**
 * Os guardas:
 *
 *   roam     anda ao acaso, só não volta para trás — é o que enche o labirinto
 *   chase    desce o mapa de distâncias até ao jogador: vem mesmo atrás
 *   ambush   persegue uma célula à frente do jogador, para lhe cortar o caminho
 *
 * A diferença entre eles é só a célula que tomam por alvo (ver enemies.js), e é
 * de propósito: um guarda novo é uma forma nova de escolher o alvo, não um
 * motor de movimento novo.
 */
export const GUARD_ROAM = 'roam';
export const GUARD_CHASE = 'chase';
export const GUARD_AMBUSH = 'ambush';

export const LEVELS = [
    {
        id: 1,
        name: 'Cripta dos Ecos',
        hint: 'Apanha os cristais e foge pelo portal.',
        cols: 13, rows: 11, seed: 19070, braid: 0.32,
        crystals: 6,
        guards: [{ kind: GUARD_ROAM, speed: 0.66 }, { kind: GUARD_CHASE, speed: 0.7 }],
        seconds: 95, par: 45,
        accent: '#35e0ff'
    },
    {
        id: 2,
        name: 'Corredores de Néon',
        hint: 'Um deles já não anda ao acaso.',
        cols: 15, rows: 13, seed: 42110, braid: 0.38,
        crystals: 8,
        guards: [
            { kind: GUARD_ROAM, speed: 0.7 },
            { kind: GUARD_CHASE, speed: 0.76 },
            { kind: GUARD_AMBUSH, speed: 0.74 }
        ],
        seconds: 105, par: 55,
        accent: '#8b7cff'
    },
    {
        id: 3,
        name: 'Jardim de Ferro',
        hint: 'Mais laços, mais saídas — e mais companhia.',
        cols: 17, rows: 13, seed: 77660, braid: 0.46,
        crystals: 10,
        guards: [
            { kind: GUARD_CHASE, speed: 0.8 },
            { kind: GUARD_CHASE, speed: 0.78 },
            { kind: GUARD_AMBUSH, speed: 0.78 },
            { kind: GUARD_ROAM, speed: 0.74 }
        ],
        seconds: 115, par: 62,
        accent: '#5ef3a0'
    },
    {
        id: 4,
        name: 'Fornalha',
        hint: 'Dois a cortar-te o caminho. Não pares no meio de um corredor.',
        cols: 19, rows: 15, seed: 91430, braid: 0.52,
        crystals: 12,
        guards: [
            { kind: GUARD_CHASE, speed: 0.86 },
            { kind: GUARD_CHASE, speed: 0.84 },
            { kind: GUARD_AMBUSH, speed: 0.84 },
            { kind: GUARD_AMBUSH, speed: 0.82 }
        ],
        seconds: 125, par: 70,
        accent: '#ffc14d'
    }
];

export const levelCount = () => LEVELS.length;

/** O nível com este número (1-based), ou `null`. */
export const levelById = (id) => LEVELS.find((level) => level.id === id) || null;

/** Vidas do nível — a receita manda, e quase nenhuma tem de o dizer. */
export const livesOf = (level) => level.lives ?? DEFAULT_LIVES;

/**
 * As estrelas de uma tentativa concluída. Ver MAX_STARS no config.js para o
 * porquê de serem condições e não escalões de pontuação.
 */
export function starsFor(level, { seconds, livesLost }) {
    let stars = 1;
    if (seconds <= level.par) stars++;
    if (livesLost === 0) stars++;
    return Math.min(MAX_STARS, stars);
}

/**
 * Monta o nível jogável: o labirinto e onde fica cada coisa.
 *
 * As colocações saem do mesmo gerador com semente que escavou o labirinto, por
 * isso o nível é sempre igual — o jogador que repete encontra os cristais onde
 * os deixou, e o cartão do menu mostra o labirinto que vai mesmo jogar.
 */
export function buildLevelLayout(level) {
    const maze = buildMaze(level);
    const spawn = { x: 1, y: 1 };

    // A saída é a célula mais longe do início: o nível é sempre uma travessia,
    // e nunca uma porta ao lado de onde se começa.
    const fromSpawn = distanceField(maze, spawn.x, spawn.y);
    const exit = farthest(maze, fromSpawn);
    const maxDistance = fromSpawn[exit.y * maze.cols + exit.x];

    const crystals = placeCrystals(maze, fromSpawn, maxDistance, level.crystals, exit, spawn);
    const guards = placeGuards(maze, fromSpawn, maxDistance, level.guards, [exit, ...crystals]);

    return { level, maze, spawn, exit, crystals, guards };
}

/** A célula de chão mais longe do alvo do campo de distâncias. */
function farthest(maze, field) {
    let best = { x: 1, y: 1 };
    let bestDistance = -1;
    for (const cell of maze.floors) {
        const distance = field[cell.y * maze.cols + cell.x];
        if (distance > bestDistance) {
            bestDistance = distance;
            best = cell;
        }
    }
    return { x: best.x, y: best.y };
}

/**
 * Os cristais espalham-se por faixas de distância ao início — um por faixa —,
 * com preferência para os becos sem saída. Assim não se apanham todos no mesmo
 * corredor e o nível obriga mesmo a percorrer o labirinto.
 */
function placeCrystals(maze, fromSpawn, maxDistance, count, exit, spawn) {
    const taken = new Set([key(exit), key(spawn)]);
    const placed = [];
    const band = Math.max(1, maxDistance / count);

    for (let i = 0; i < count; i++) {
        const low = Math.max(2, Math.floor(band * i));
        const high = Math.ceil(band * (i + 1));
        const cell = pickInBand(maze, fromSpawn, low, high, taken)
            // Faixa sem célula livre (acontece nos cantos mais apertados):
            // procura-se em todo o labirinto para não ficarem cristais por pôr.
            || pickInBand(maze, fromSpawn, 2, maxDistance, taken);
        if (!cell) break;
        taken.add(key(cell));
        placed.push(cell);
    }

    return placed;
}

/** Uma célula livre dentro da faixa, preferindo becos sem saída. */
function pickInBand(maze, field, low, high, taken) {
    const options = [];
    const deadEnds = [];
    for (const cell of maze.floors) {
        if (taken.has(key(cell))) continue;
        const distance = field[cell.y * maze.cols + cell.x];
        if (distance < low || distance > high) continue;
        options.push(cell);
        if (exitsFrom(maze, cell.x, cell.y).length === 1) deadEnds.push(cell);
    }

    const pool = deadEnds.length ? deadEnds : options;
    if (!pool.length) return null;
    return pool[Math.floor(maze.random() * pool.length)];
}

/**
 * Os guardas começam na metade mais afastada do início, e nunca em cima de um
 * cristal ou da saída: a primeira coisa que se vê ao arrancar não pode ser um
 * guarda em cima do jogador.
 */
function placeGuards(maze, fromSpawn, maxDistance, guards, avoid) {
    const taken = new Set(avoid.map(key));
    const minDistance = Math.max(4, Math.floor(maxDistance * 0.45));
    const placed = [];

    for (const guard of guards) {
        const cell = pickInBand(maze, fromSpawn, minDistance, maxDistance, taken)
            || pickInBand(maze, fromSpawn, 4, maxDistance, taken);
        if (!cell) break;
        taken.add(key(cell));
        placed.push({ ...guard, x: cell.x, y: cell.y });
    }

    return placed;
}

const key = (cell) => `${cell.x},${cell.y}`;
