// Os níveis do Maze Run.
//
// Um nível é uma receita: o tamanho do labirinto, a semente, quantos cristais,
// que guardas, que peças e quanto tempo. O labirinto sai da semente (ver
// maze.js) e as colocações saem daqui — por isso **acrescentar um nível é
// acrescentar uma entrada ao array `LEVELS`**, e mais nada. Não há mapas
// desenhados à mão para manter nem ficheiros de dados à parte.
//
// O que cada campo faz:
//
//   cols, rows   tamanho do labirinto em células (acertados para ímpar)
//   seed         a semente: o mesmo número dá sempre o mesmo labirinto
//                (num nível com portas, a semente escolhe-se pelo que sai: nem
//                 todos os labirintos dão para trancar — ver `placeDoors`)
//   braid        de 0 a 1, quantos becos sem saída se abrem (ver maze.js)
//   crystals     cristais a apanhar antes de a saída abrir
//   freezers     cristais de gelo que congelam os guardas (opcionais)
//   portals      pares de portais que ligam dois pontos do labirinto
//   doors        portas trancadas, cada uma com a sua chave
//   guards       os guardas, pela ordem por que aparecem: { kind, speed }
//   seconds      o tempo da tentativa
//   par          o tempo-alvo: abaixo dele ganha-se a segunda estrela
//   lives        vidas da tentativa (por omissão, DEFAULT_LIVES)
//   accent       a cor do nível — paredes, HUD e cartão do menu

import { DEFAULT_LIVES, MAX_STARS } from './config.js';
import { buildMaze, canReach, cellKey, distanceField, exitsFrom, shortestPath, STEPS } from './maze.js';

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

/** As cores dos pares de portais e dos pares chave/porta, por ordem de uso. */
export const PORTAL_COLORS = ['#35e0ff', '#ffc14d', '#ff5d9e'];
export const DOOR_COLORS = ['#ffc14d', '#5ef3a0', '#ff8a3d'];

/**
 * Os níveis, por ordem. Cada um apresenta uma peça de cada vez e o seguinte
 * conta com ela — é por isso que o 1 não tem nada além do básico e o último tem
 * tudo: quem chega lá já sabe o que cada coisa faz.
 */
export const LEVELS = [
    {
        id: 1,
        name: 'Cripta dos Ecos',
        hint: 'Apanha os cristais todos: é isso que abre a saída.',
        cols: 13, rows: 11, seed: 19070, braid: 0.32,
        crystals: 6,
        guards: [{ kind: GUARD_ROAM, speed: 0.66 }, { kind: GUARD_CHASE, speed: 0.7 }],
        seconds: 95, par: 45,
        accent: '#35e0ff'
    },
    {
        id: 2,
        name: 'Corredores de Néon',
        hint: 'O cristal de gelo congela os guardas. Guarda-o para quando precisares.',
        cols: 15, rows: 13, seed: 42110, braid: 0.38,
        crystals: 8,
        freezers: 2,
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
        hint: 'Os portais levam-te ao outro lado num instante — mas os guardas também os usam.',
        cols: 17, rows: 13, seed: 77660, braid: 0.46,
        crystals: 10,
        freezers: 2,
        portals: 1,
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
        hint: 'A chave abre a porta trancada — e enquanto estiver fechada, nem os guardas passam.',
        cols: 19, rows: 15, seed: 91430, braid: 0.52,
        crystals: 12,
        freezers: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.86 },
            { kind: GUARD_CHASE, speed: 0.84 },
            { kind: GUARD_AMBUSH, speed: 0.84 },
            { kind: GUARD_AMBUSH, speed: 0.82 }
        ],
        seconds: 125, par: 70,
        accent: '#ffc14d'
    },
    {
        id: 5,
        name: 'Passagem Selada',
        hint: 'Duas portas em cadeia: a primeira chave abre o caminho para a segunda.',
        cols: 19, rows: 15, seed: 71234, braid: 0.46,
        crystals: 12,
        freezers: 3,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.88 },
            { kind: GUARD_AMBUSH, speed: 0.86 },
            { kind: GUARD_AMBUSH, speed: 0.84 },
            { kind: GUARD_ROAM, speed: 0.8 }
        ],
        seconds: 140, par: 80,
        accent: '#ff8a3d'
    },
    {
        id: 6,
        name: 'Roda dos Espelhos',
        hint: 'Portais, portas e gelo, tudo ao mesmo tempo. Decide antes de entrar no corredor.',
        cols: 21, rows: 17, seed: 24680, braid: 0.4,
        crystals: 14,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.9 },
            { kind: GUARD_CHASE, speed: 0.88 },
            { kind: GUARD_AMBUSH, speed: 0.88 },
            { kind: GUARD_AMBUSH, speed: 0.86 },
            { kind: GUARD_ROAM, speed: 0.82 }
        ],
        seconds: 155, par: 95,
        accent: '#ff5d9e'
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
 * isso o nível é sempre igual — o jogador que repete encontra tudo onde deixou,
 * e o cartão do menu mostra o labirinto que vai mesmo jogar.
 *
 * A ordem em que se põem as peças não é arbitrária:
 *
 *   1. a saída, no ponto mais longe do início — o nível é uma travessia;
 *   2. os portais, porque mudam o que é perto de quê;
 *   3. as portas, que precisam de saber o caminho já com os portais contados —
 *      uma porta que se contorne por um portal não tranca nada;
 *   4. o resto, que só precisa de células livres.
 */
export function buildLevelLayout(level) {
    const maze = buildMaze(level);
    const spawn = { x: 1, y: 1 };
    const wantsDoors = (level.doors || 0) > 0;

    const fromSpawn = distanceField(maze, spawn.x, spawn.y);
    // Num nível com portas, a saída vai para o fundo de um beco. É o que garante
    // que existe onde pôr a porta: a boca de um beco corta-o do resto do
    // labirinto por construção, e num labirinto cheio de laços (ver `braid`)
    // uma célula ao calhar quase nunca corta nada.
    const exit = farthest(maze, fromSpawn, { deadEnd: wantsDoors });
    const maxDistance = fromSpawn[exit.y * maze.cols + exit.x];

    const taken = new Set([cellKey(spawn.x, spawn.y), cellKey(exit.x, exit.y)]);

    const portals = placePortals(maze, fromSpawn, maxDistance, level.portals || 0, taken);
    const doors = placeDoors(maze, spawn, exit, level.doors || 0, taken);

    // Os guardas ficam do lado de cá das portas: um guarda trancado do outro
    // lado não faz nada até a porta abrir, e o nível seria mais fácil do que
    // parece no cartão.
    const fromSpawnNow = distanceField(maze, spawn.x, spawn.y);
    const guards = placeGuards(maze, fromSpawnNow, reachableDistance(maze, fromSpawnNow), level.guards, taken);

    // Os cristais, esses, espalham-se pelo labirinto todo — contando que as
    // portas acabam por abrir. Um cristal do outro lado de uma porta é o que dá
    // sentido à chave: sem ele, a porta só estaria entre o jogador e a saída.
    const { freezers, crystals } = withDoorsOpen(maze, () => {
        const spread = distanceField(maze, spawn.x, spawn.y);
        const reach = reachableDistance(maze, spread);
        return {
            freezers: placeSpread(maze, spread, reach, level.freezers || 0, taken),
            crystals: placeSpread(maze, spread, reach, level.crystals, taken)
        };
    });

    return { level, maze, spawn, exit, portals, doors, freezers, crystals, guards };
}

/**
 * Corre uma colocação com as portas do nível destrancadas e volta a fechá-las.
 * Serve a quem tem de olhar para o labirinto inteiro — que é como ele vai estar
 * a meio do nível, não como está no primeiro segundo.
 */
function withDoorsOpen(maze, fn) {
    const closed = [...maze.blocked];
    maze.blocked.clear();
    try {
        return fn();
    } finally {
        for (const key of closed) maze.blocked.add(key);
    }
}

/**
 * A célula de chão mais longe do alvo do campo de distâncias. Com `deadEnd`,
 * procura-se primeiro entre os becos sem saída — e só se não houver nenhum é
 * que serve a mais longe de todas.
 */
function farthest(maze, field, { deadEnd = false } = {}) {
    const pick = (onlyDeadEnds) => {
        let best = null;
        let bestDistance = -1;
        for (const cell of maze.floors) {
            if (onlyDeadEnds && exitsFrom(maze, cell.x, cell.y).length !== 1) continue;
            const distance = field[cell.y * maze.cols + cell.x];
            if (distance > bestDistance) {
                bestDistance = distance;
                best = cell;
            }
        }
        return best;
    };

    const best = (deadEnd && pick(true)) || pick(false) || { x: 1, y: 1 };
    return { x: best.x, y: best.y };
}

/** A maior distância alcançável, para as faixas de colocação saberem onde acabam. */
function reachableDistance(maze, field) {
    let max = 0;
    for (const cell of maze.floors) {
        max = Math.max(max, field[cell.y * maze.cols + cell.x]);
    }
    return max;
}

// ---------- Portais ----------

/**
 * Cada par liga duas pontas afastadas do labirinto. Afastadas é o ponto: um
 * portal entre duas células vizinhas não é um atalho, é um enfeite. Por isso
 * uma ponta fica na metade de cá e a outra na metade de lá.
 */
function placePortals(maze, fromSpawn, maxDistance, count, taken) {
    const placed = [];

    for (let i = 0; i < count; i++) {
        const near = pickInBand(maze, fromSpawn, 2, Math.floor(maxDistance * 0.4), taken, { deadEnds: false });
        const far = pickInBand(maze, fromSpawn, Math.ceil(maxDistance * 0.6), maxDistance, taken, { deadEnds: false });
        if (!near || !far) break;

        taken.add(cellKey(near.x, near.y));
        taken.add(cellKey(far.x, far.y));
        maze.portals.set(cellKey(near.x, near.y), far);
        maze.portals.set(cellKey(far.x, far.y), near);
        placed.push({ a: near, b: far, color: PORTAL_COLORS[i % PORTAL_COLORS.length] });
    }

    return placed;
}

// ---------- Portas e chaves ----------

/**
 * Uma porta só é uma porta se trancar mesmo alguma coisa.
 *
 * Num labirinto com laços (e todos têm, por causa do `braid`), fechar uma
 * célula ao calhar quase nunca corta o caminho — dá-se a volta e a porta passa
 * a enfeite. Por isso a procura é pelo contrário: percorre-se o caminho mais
 * curto até ao que se quer trancar e fecha-se cada célula à experiência, até
 * encontrar uma que deixe mesmo o destino inalcançável.
 *
 * Com mais do que uma porta, elas encadeiam-se: a primeira tranca a saída e a
 * segunda tranca a chave da primeira. Quem joga percebe a ordem sem lhe
 * explicarem — a chave que se encontra é sempre a do próximo cadeado.
 */
function placeDoors(maze, spawn, exit, count, taken) {
    const placed = [];
    let target = exit;

    for (let i = 0; i < count; i++) {
        const cell = findCut(maze, spawn, target, taken);
        if (!cell) break;

        maze.blocked.add(cellKey(cell.x, cell.y));
        taken.add(cellKey(cell.x, cell.y));

        // A chave da última porta pode ir para o melhor sítio que houver. As
        // outras não: a porta seguinte vai trancar *esta* chave, por isso ela
        // tem de ficar onde ainda seja possível cortar o caminho até lá. Sem
        // esta verificação, a melhor chave era às vezes a que deixava o nível
        // com uma porta a menos do que a receita pedia.
        const lastDoor = i === count - 1;
        const candidates = keyCandidates(maze, spawn, cell, taken);
        const key = (lastDoor ? null : candidates.find((candidate) => findCut(maze, spawn, candidate, taken)))
            // Labirinto onde a cadeia não dá para continuar: fica-se pela melhor
            // chave e a porta seguinte não se coloca. Uma porta a menos é melhor
            // do que uma chave num sítio mau — e o varrimento de sementes (ver a
            // nota da receita) é que evita que isso aconteça nos níveis que
            // contam com as duas.
            || candidates[0];

        if (!key) {
            maze.blocked.delete(cellKey(cell.x, cell.y));
            taken.delete(cellKey(cell.x, cell.y));
            break;
        }

        taken.add(cellKey(key.x, key.y));
        placed.push({ cell, key, color: DOOR_COLORS[i % DOOR_COLORS.length], open: false });
        target = key;
    }

    return placed;
}

/**
 * Uma célula que, fechada, deixa `target` inalcançável a partir de `spawn`.
 * Preferem-se corredores (duas saídas): uma porta num cruzamento não se lê — não
 * se percebe o que é que ela está a fechar.
 */
function findCut(maze, spawn, target, taken) {
    // O caminho mais curto primeiro, de trás para a frente: a porta mais perto
    // do que guarda é a que deixa mais labirinto aberto, e é a que se percebe
    // melhor. Quase sempre é aqui que se encontra, e é uma procura barata.
    const path = shortestPath(maze, spawn, target).reverse();
    const onPath = cutAmong(maze, spawn, target, taken, path);
    if (onPath) return onPath;

    // Não havendo no caminho, procura-se em todo o labirinto — das células mais
    // afastadas do início para as mais próximas, pela mesma razão.
    const fromSpawn = distanceField(maze, spawn.x, spawn.y);
    const everywhere = maze.floors
        .filter((cell) => fromSpawn[cell.y * maze.cols + cell.x] >= 0)
        .sort((a, b) => fromSpawn[b.y * maze.cols + b.x] - fromSpawn[a.y * maze.cols + a.x]);

    return cutAmong(maze, spawn, target, taken, everywhere);
}

/**
 * A primeira das candidatas que, fechada, deixa `target` inalcançável. Os
 * corredores (duas saídas) ganham sempre aos cruzamentos: uma porta num
 * cruzamento não se lê — não se percebe o que é que ela está a fechar.
 */
function cutAmong(maze, spawn, target, taken, candidates) {
    let fallback = null;

    for (const cell of candidates) {
        const key = cellKey(cell.x, cell.y);
        if (taken.has(key) || maze.portals.has(key) || maze.blocked.has(key)) continue;
        if (cell.x === target.x && cell.y === target.y) continue;
        if (cell.x === spawn.x && cell.y === spawn.y) continue;

        maze.blocked.add(key);
        const cuts = !canReach(maze, spawn, target);
        maze.blocked.delete(key);
        if (!cuts) continue;

        if (exitsFrom(maze, cell.x, cell.y).length === 2) return { x: cell.x, y: cell.y };
        fallback = fallback || { x: cell.x, y: cell.y };
    }

    return fallback;
}

/**
 * Os melhores sítios para a chave de uma porta, por ordem: o mais longe **da
 * porta** que se consiga, sem sair do que ainda é alcançável com ela fechada.
 * Devolve uma lista, e não um sítio, porque quem escolhe tem mais uma condição
 * a cumprir — ver `placeDoors`.
 *
 * Longe da porta e não longe do início, que é a medida que parecia óbvia e não
 * é: a porta está lá ao fundo, longe do início, e a célula mais longe do início
 * ainda alcançável é precisamente a que está encostada a ela. A chave calhava
 * colada ao cadeado e abrir a porta não custava nada. Medindo a partir da
 * porta, a chave vai parar ao canto oposto do que se pode andar — que é a
 * viagem que a porta devia estar a cobrar.
 *
 * Um beco sem saída vale um bónus, não um veto: se houver outra porta a seguir,
 * é a boca de um beco que lhe serve de sítio (ver `findCut`), por isso convém.
 * Mas *só* becos era pior do que nada — quando o único beco alcançável está
 * encostado à porta, a chave voltava a ficar ao lado do cadeado. O bónus é
 * pequeno de propósito: um beco a um passo nunca ganha a um corredor a dez.
 */
function keyCandidates(maze, spawn, doorCell, taken, limit = 8) {
    const reachable = distanceField(maze, spawn.x, spawn.y);
    const isReachable = (cell) => reachable[cell.y * maze.cols + cell.x] >= 0;

    // A porta está fechada, por isso não se mede a partir dela: mede-se a partir
    // do vizinho dela que ficou do lado de cá.
    const doorSide = STEPS
        .map((step) => ({ x: doorCell.x + step.x, y: doorCell.y + step.y }))
        .find((cell) => maze.isFloor(cell.x, cell.y) && isReachable(cell));
    if (!doorSide) return [];

    const fromDoor = distanceField(maze, doorSide.x, doorSide.y);
    const scored = [];

    for (const cell of maze.floors) {
        const key = cellKey(cell.x, cell.y);
        if (taken.has(key) || maze.portals.has(key) || maze.blocked.has(key)) continue;
        if (!isReachable(cell)) continue;

        const distance = fromDoor[cell.y * maze.cols + cell.x];
        if (distance < 0) continue;

        scored.push({
            x: cell.x,
            y: cell.y,
            score: distance + (exitsFrom(maze, cell.x, cell.y).length === 1 ? DEAD_END_BONUS : 0)
        });
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((cell) => ({ x: cell.x, y: cell.y }));
}

/** Quanto vale um beco sem saída na escolha do sítio da chave, em passos. */
const DEAD_END_BONUS = 3;

// ---------- Cristais, gelo e guardas ----------

/**
 * Espalha `count` peças por faixas de distância ao início — uma por faixa —,
 * com preferência para os becos sem saída. Assim não se apanha tudo no mesmo
 * corredor e o nível obriga mesmo a percorrer o labirinto.
 */
function placeSpread(maze, field, maxDistance, count, taken) {
    const placed = [];
    const band = Math.max(1, maxDistance / Math.max(1, count));

    for (let i = 0; i < count; i++) {
        const low = Math.max(2, Math.floor(band * i));
        const high = Math.ceil(band * (i + 1));
        const cell = pickInBand(maze, field, low, high, taken)
            // Faixa sem célula livre (acontece nos cantos mais apertados):
            // procura-se em todo o labirinto para não ficarem peças por pôr.
            || pickInBand(maze, field, 2, maxDistance, taken);
        if (!cell) break;
        taken.add(cellKey(cell.x, cell.y));
        placed.push(cell);
    }

    return placed;
}

/** Uma célula livre dentro da faixa, preferindo becos sem saída. */
function pickInBand(maze, field, low, high, taken, { deadEnds = true } = {}) {
    const options = [];
    const preferred = [];

    for (const cell of maze.floors) {
        const key = cellKey(cell.x, cell.y);
        if (taken.has(key) || maze.portals.has(key) || maze.blocked.has(key)) continue;
        const distance = field[cell.y * maze.cols + cell.x];
        if (distance < low || distance > high) continue;
        options.push(cell);
        if (deadEnds && exitsFrom(maze, cell.x, cell.y).length === 1) preferred.push(cell);
    }

    const pool = preferred.length ? preferred : options;
    if (!pool.length) return null;
    const chosen = pool[Math.floor(maze.random() * pool.length)];
    return { x: chosen.x, y: chosen.y };
}

/**
 * Os guardas começam na metade mais afastada do início, e nunca em cima de
 * outra peça: a primeira coisa que se vê ao arrancar não pode ser um guarda em
 * cima do jogador.
 */
function placeGuards(maze, field, maxDistance, guards, taken) {
    const minDistance = Math.max(4, Math.floor(maxDistance * 0.45));
    const placed = [];

    for (const guard of guards) {
        const cell = pickInBand(maze, field, minDistance, maxDistance, taken, { deadEnds: false })
            || pickInBand(maze, field, 2, maxDistance, taken, { deadEnds: false })
            // Região inicial pequena de mais para tantos guardas (acontece quando
            // uma porta tranca logo metade do labirinto): antes um guarda do
            // outro lado da porta do que um nível com menos guardas do que a
            // receita pede.
            || withDoorsOpen(maze, () => {
                const open = distanceField(maze, 1, 1);
                return pickInBand(maze, open, 4, reachableDistance(maze, open), taken, { deadEnds: false });
            });
        if (!cell) break;
        taken.add(cellKey(cell.x, cell.y));
        placed.push({ ...guard, x: cell.x, y: cell.y });
    }

    return placed;
}
