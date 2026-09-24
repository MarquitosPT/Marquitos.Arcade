#!/usr/bin/env node
/**
 * Smoke-test dos jogos da arcada.
 *
 * Abre cada jogo num Chromium headless, joga-o durante alguns segundos e falha se
 * alguma coisa correr mal: erro de JavaScript, módulo ou folha de estilos que não
 * carrega, ecrã inicial em branco, ou canvas que não chega a desenhar nada.
 *
 * Serve os ficheiros com um servidor estático próprio (tools/games/static-server.mjs),
 * por isso não é preciso ter o ASP.NET a correr nem o SDK do .NET instalado. Os
 * pedidos a /api/* respondem 503 de propósito: os jogos têm de aguentar o servidor
 * em baixo, e isso fica assim coberto pelo teste.
 *
 * Uso:
 *   node tools/games/smoke-test.mjs
 *   node tools/games/smoke-test.mjs --only pong
 *   node tools/games/smoke-test.mjs --out /tmp/antes      # grava os screenshots
 *   node tools/games/smoke-test.mjs --out /tmp/depois --compare /tmp/antes
 *   node tools/games/smoke-test.mjs --root /outra/wwwroot --out /tmp/antes
 *   node tools/games/smoke-test.mjs --skip pixel-racing-resultados
 *
 * O par --out/--compare serve para refactors: capturam-se os ecrãs antes da
 * mudança e comparam-se depois. O ecrã de menu é determinístico e tem de bater
 * certo ao pixel; os fotogramas de jogo variam e são só informativos.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WWWROOT = resolve(HERE, '../../src/MarquitosArcade/wwwroot');
/**
 * Onde está o Chromium. Alguns ambientes (containers de desenvolvimento) trazem-no
 * pré-instalado e desligam o download do Playwright; noutros (CI, máquina local
 * depois de `npx playwright install`) quem sabe o caminho é o próprio Playwright.
 * Devolve null para o Playwright resolver sozinho.
 */
function findChromium() {
    if (process.env.ARCADE_CHROMIUM) return process.env.ARCADE_CHROMIUM;
    const preinstalled = '/opt/pw-browsers/chromium';
    return existsSync(preinstalled) ? preinstalled : null;
}

const args = process.argv.slice(2);
const argValue = (name, fallback = null) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const ONLY = argValue('--only');
const OUT = argValue('--out');
const COMPARE = argValue('--compare');
const SKIP = (argValue('--skip') || '').split(',').filter(Boolean);
// Serve outra cópia do site. Útil em refactors: aponta-se para uma worktree do
// git na versão anterior e capturam-se os screenshots de referência.
const WWWROOT = resolve(argValue('--root', DEFAULT_WWWROOT));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera por um elemento ou por uma navegação. Curto de propósito: um jogo partido
 *  tem de falhar em segundos, não ao fim dos 30s por omissão do Playwright. */
const SELECTOR_TIMEOUT_MS = 10000;
const NAVIGATION_TIMEOUT_MS = 20000;
/** Teto por cenário. Protege contra um guião que encrave à espera de algo que não vem. */
const SCENARIO_TIMEOUT_MS = 120000;
/** O ecrã de arranque está no ar 2s de propósito; isto é só a rede de segurança. */
const SPLASH_TIMEOUT_MS = 20000;

/**
 * Torna o jogo determinístico: Math.random passa a ser um gerador com semente
 * fixa (mulberry32). Sem isto, o ângulo da bola, os pedidos e os carros mudam a
 * cada execução e os screenshots nunca batem certo.
 */
const SEED_RANDOM = `
(() => {
  let a = 0x9e3779b9;
  Math.random = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
`;

const GAMES = [
    {
        slug: 'pong',
        // Contra o CPU ao alto: raquetes em cima e em baixo, arrasta-se de lado.
        name: 'pong-1jogador',
        viewport: { width: 450, height: 800 },
        canvas: true,
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('#startBtn');
            // Arrasta a raquete de baixo para devolver a bola à IA.
            await page.mouse.move(225, 760);
            await page.mouse.down();
            for (let i = 0; i < 40; i++) {
                await page.mouse.move(225 + Math.sin(i / 4) * 150, 760);
                await sleep(40);
            }
            await page.mouse.up();
        }
    },
    {
        slug: 'pong',
        // O mesmo modo ao comprido usa o outro campo — raquetes nos lados, a do
        // CPU à direita —, por isso é código diferente e leva cenário próprio.
        name: 'pong-1jogador-paisagem',
        viewport: { width: 800, height: 450 },
        canvas: true,
        async play(page) {
            await page.click('#startBtn');
            // Ao comprido a raquete de quem joga é a da esquerda e sobe e desce.
            await page.mouse.move(400, 225);
            await page.mouse.down();
            for (let i = 0; i < 40; i++) {
                await page.mouse.move(400, 225 + Math.sin(i / 4) * 150);
                await sleep(40);
            }
            await page.mouse.up();
        }
    },
    {
        slug: 'pong',
        name: 'pong-2jogadores',
        viewport: { width: 800, height: 450 },
        canvas: true,
        async play(page) {
            await page.click('.modeBtn[data-mode="two"]');
            await page.click('#startBtn');
            await page.mouse.move(120, 225);
            await page.mouse.down();
            for (let i = 0; i < 30; i++) {
                await page.mouse.move(120, 225 + Math.sin(i / 3.5) * 150);
                await sleep(40);
            }
            await page.mouse.up();
        }
    },
    {
        slug: 'tasca-do-ze',
        // Jogo em DOM (sem canvas), num layout de telemóvel com max-width 480px.
        viewport: { width: 480, height: 880 },
        canvas: false,
        async play(page) {
            await page.click('#playBtn');
            await sleep(400);
            await page.fill('#nameInput', 'Chef Marquitos');
            await page.click('#startBtn');
            await sleep(2500);
            // Serve um pedido correto: exercita toque nos ingredientes + campainha.
            const wanted = await page.$$eval('#reqList .req-chip', (els) => els.map((e) => e.textContent.trim()));
            for (const requirement of wanted) {
                await tapIngredient(page, requirement);
                await sleep(200);
            }
            await sleep(300);
            await page.click('#bellBtn');
            await sleep(1200);
        }
    },
    {
        slug: 'tasca-do-ze',
        name: 'tasca-do-ze-ecras',
        viewport: { width: 480, height: 880 },
        canvas: false,
        // O menu deste cenário é o mesmo do anterior, mas o fotograma final é
        // outro ecrã — por isso a referência do menu não se compara aqui.
        stableMenu: false,
        async play(page) {
            // Quadro de pontuações a partir do menu principal (sem servidor:
            // tem de cair na cópia local e mostrar o aviso de offline).
            await page.click('#scoresBtn');
            await page.waitForSelector('#leaderboardOverlay:not(.hidden)');
            await sleep(600);
            await page.click('#closeLeaderboardBtn');
            await page.waitForSelector('#mainMenuOverlay:not(.hidden)');

            // Turno: pausar, retomar e sair para o menu.
            await page.click('#playBtn');
            await sleep(400);
            await page.fill('#nameInput', 'Chef Marquitos');
            await page.click('#startBtn');
            await sleep(1200);

            await page.click('#pauseBtn');
            await page.waitForSelector('#pauseOverlay:not(.hidden)');
            await sleep(300);
            await page.click('#resumeBtn');
            await page.waitForSelector('#pauseOverlay.hidden', { state: 'attached' });

            // Alternar a bancada para os doces e voltar aos salgados.
            await page.click('#tabSweet');
            await sleep(200);
            await page.click('#tabSavory');
            await sleep(200);

            await page.click('#pauseBtn');
            await page.click('#quitBtn');
            await page.waitForSelector('#mainMenuOverlay:not(.hidden)');
            await sleep(400);
        }
    },
    {
        slug: 'pixel-racing',
        viewport: { width: 800, height: 450 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            // O menu tem dois passos: o modo leva ao ecrã da pista e da dificuldade.
            await page.click('.modeBtn[data-mode="quick"]');
            await page.click('.trackCard[data-value="1"]');
            await page.click('#startBtn');
            await waitForRacing(page);
            await page.keyboard.down('ArrowUp');
            await sleep(1200);
            await page.keyboard.up('ArrowUp');
        }
    },
    {
        slug: 'pixel-racing',
        name: 'pixel-racing-taca-pro',
        viewport: { width: 800, height: 450 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            // A taça Pro: confirma que o seletor de taça troca os cartões pelas
            // pistas apertadas e que uma delas arranca e se conduz como as outras.
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('.modeBtn[data-mode="tournament"]');
            await page.click('#cupRow .cupBtn[data-value="1"]');
            const first = await page.textContent('#trackRow .trackName');
            if (first !== 'Serra Torcida') throw new Error(`taça Pro não trocou as pistas: ${first}`);
            await page.click('#startBtn');
            await waitForRacing(page);
            await page.keyboard.down('ArrowUp');
            await sleep(1200);
            await page.keyboard.up('ArrowUp');
        }
    },
    {
        slug: 'maze-run',
        // Ao alto, que é como se joga um labirinto no telemóvel.
        viewport: { width: 450, height: 800 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('#playBtn');
            await waitForMazePlaying(page);
            // Umas curvas: confirma que o jogador vira nos cruzamentos e que os
            // guardas andam sem rebentar a IA.
            for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
                await page.keyboard.press(key);
                await sleep(500);
            }
        }
    },
    {
        slug: 'maze-run',
        name: 'maze-run-niveis',
        viewport: { width: 450, height: 800 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            // O ecrã dos níveis: o primeiro aberto, os outros por desbloquear.
            await page.click('#chooseBtn');
            await page.waitForSelector('.levelCard');
            await sleep(500); // o painel entra com uma animação; clicar a meio dela é instável
            const locked = await page.$$eval('.levelCard.is-locked', (cards) => cards.length);
            const total = await page.$$eval('.levelCard', (cards) => cards.length);
            if (total < 2) throw new Error(`só ${total} nível(eis) no ecrã de níveis`);
            if (locked !== total - 1) throw new Error(`${locked} níveis fechados de ${total} — o primeiro devia ser o único aberto`);

            // O carrossel: os níveis vêm repartidos por páginas e as setas mudam
            // de página. A que não tem para onde ir fica desativada.
            const carousel = () => page.evaluate(() => ({
                paginas: document.querySelectorAll('.levelPage').length,
                porPagina: document.querySelector('.levelPage')?.childElementCount ?? 0,
                ativa: [...document.querySelectorAll('.carouselDot')].findIndex((d) => d.classList.contains('active')),
                prevOff: document.getElementById('prevPageBtn').disabled,
                nextOff: document.getElementById('nextPageBtn').disabled
            }));

            const inicio = await carousel();
            if (inicio.paginas < 2) throw new Error(`os níveis não ficaram em páginas (${inicio.paginas})`);
            if (inicio.porPagina * inicio.paginas < total) throw new Error('há níveis que não ficaram em página nenhuma');
            if (inicio.ativa !== 0 || !inicio.prevOff) throw new Error('o carrossel não abriu na primeira página');

            await page.click('#nextPageBtn');
            await sleep(500);
            const depois = await carousel();
            if (depois.ativa !== 1 || depois.prevOff) throw new Error('a seta seguinte não mudou de página');

            await page.click('#prevPageBtn');
            await sleep(500);
            if ((await carousel()).ativa !== 0) throw new Error('a seta anterior não voltou atrás');
            // Um nível fechado não arranca nada.
            await page.click('.levelCard.is-locked');
            await sleep(400);
            if (!(await page.isVisible('#levelsScreen'))) throw new Error('um nível fechado abriu');
            await page.click('.levelCard:not(.is-locked)');
            await waitForMazePlaying(page);
            await sleep(600);
        }
    },
    {
        slug: 'maze-run',
        name: 'maze-run-mecanicas',
        viewport: { width: 500, height: 900 },
        canvas: true,
        menuSelector: '#startScreen',
        // Os níveis com portais, portas e gelo estão fechados de origem; o
        // progresso guardado é a forma de lá chegar sem os jogar todos. Fica no
        // 25 de propósito: é o nível que o guião joga, e é assim que o menu o
        // aponta e o carrossel abre já na página dele.
        storage: { mazeRunProgress_v1: JSON.stringify({ v: 2, unlocked: 25, levels: {} }) },
        async play(page) {
            // Primeiro a montagem: cada receita tem de dar um nível jogável.
            // É aqui que se apanha uma receita nova que gere uma porta que não
            // tranca nada, uma chave inalcançável ou um cristal fora do mundo.
            const broken = await page.evaluate(async () => {
                const { LEVELS, buildLevelLayout } = await import('/games/maze-run/js/levels.js');
                const { canReach, cellKey, distanceField, exitsFrom, STEPS } = await import('/games/maze-run/js/maze.js');
                const problems = [];

                for (const level of LEVELS) {
                    const layout = buildLevelLayout(level);
                    const { maze, spawn, exit } = layout;
                    const say = (what) => problems.push(`nível ${level.id}: ${what}`);

                    if (layout.crystals.length !== level.crystals) say(`${layout.crystals.length} cristais em vez de ${level.crystals}`);
                    if (layout.freezers.length !== (level.freezers || 0)) say(`${layout.freezers.length} cristais de gelo em vez de ${level.freezers || 0}`);
                    if (layout.portals.length !== (level.portals || 0)) say(`${layout.portals.length} portais em vez de ${level.portals || 0}`);
                    if (layout.doors.length !== (level.doors || 0)) say(`${layout.doors.length} portas em vez de ${level.doors || 0}`);
                    if (layout.guards.length !== level.guards.length) say(`${layout.guards.length} guardas em vez de ${level.guards.length}`);

                    // Uma porta que não tranque a saída é um enfeite.
                    if (layout.doors.length && canReach(maze, spawn, exit)) say('as portas não trancam a saída');

                    // Do sítio onde se nasce tem de haver volta a dar: com uma
                    // saída só, o primeiro guarda que entre no corredor acaba o
                    // nível antes de ele começar (ver `openStart` em maze.js).
                    const around = exitsFrom(maze, spawn.x, spawn.y);
                    if (around.length < 2) say(`o jogador nasce num beco sem saída (${around.length} saída)`);
                    else {
                        // Duas saídas não chegam: têm de ligar uma à outra sem
                        // passar pelo início, senão são dois becos em vez de um.
                        maze.blocked.add(cellKey(spawn.x, spawn.y));
                        const sides = around.map((step) => ({ x: spawn.x + step.x, y: spawn.y + step.y }));
                        const loops = canReach(maze, sides[0], sides[1]);
                        maze.blocked.delete(cellKey(spawn.x, spawn.y));
                        if (!loops) say('as saídas do início não fecham laço: não há volta a dar');
                    }

                    // As chaves têm de sair em cadeia: sempre há uma alcançável.
                    let opened = 0;
                    for (let round = 0; round < layout.doors.length; round++) {
                        const field = distanceField(maze, spawn.x, spawn.y);
                        const next = layout.doors.find((door) => !door.open && field[door.key.y * maze.cols + door.key.x] >= 0);
                        if (!next) break;
                        next.open = true;
                        maze.blocked.delete(cellKey(next.cell.x, next.cell.y));
                        opened++;
                    }
                    if (opened !== layout.doors.length) say(`só ${opened} de ${layout.doors.length} portas se conseguem abrir`);

                    // Com tudo aberto, tudo tem de estar ao alcance.
                    const open = distanceField(maze, spawn.x, spawn.y);
                    const unreachable = [exit, ...layout.crystals, ...layout.freezers, ...layout.guards]
                        .filter((cell) => open[cell.y * maze.cols + cell.x] < 0);
                    if (unreachable.length) say(`${unreachable.length} peça(s) fora do alcance`);

                    // E há sempre volta a dar a um portal. Quem chega ao centro de
                    // um portal é levado para a outra ponta (ver `enterPortal` em
                    // walker.js), por isso uma célula com portal nunca se atravessa
                    // a pé: com todas elas fechadas, o labirinto tem de continuar
                    // todo alcançável. Sem isto há zonas onde só se entra caindo do
                    // outro portal — e uma saída ou um cristal lá dentro faziam um
                    // nível que parece impossível (era o caso do 11).
                    const shut = new Set(layout.portals.flatMap((portal) => [
                        cellKey(portal.a.x, portal.a.y),
                        cellKey(portal.b.x, portal.b.y)
                    ]));
                    if (shut.size) {
                        const seen = new Set([cellKey(spawn.x, spawn.y)]);
                        const stack = [spawn];
                        while (stack.length) {
                            const cell = stack.pop();
                            for (const step of STEPS) {
                                const next = { x: cell.x + step.x, y: cell.y + step.y };
                                const key = cellKey(next.x, next.y);
                                if (seen.has(key) || shut.has(key) || !maze.isFloor(next.x, next.y)) continue;
                                seen.add(key);
                                stack.push(next);
                            }
                        }

                        const onlyByPortal = maze.floors
                            .filter((cell) => maze.isFloor(cell.x, cell.y))
                            .filter((cell) => !shut.has(cellKey(cell.x, cell.y)) && !seen.has(cellKey(cell.x, cell.y)));
                        if (onlyByPortal.length) say(`${onlyByPortal.length} célula(s) só se alcançam por portal — não há volta a dar`);

                        // Nem duas pontas encostadas uma à outra: quem sai de uma
                        // segue em frente, cai na outra e é atirado outra vez.
                        const ends = layout.portals.flatMap((portal) => [portal.a, portal.b]);
                        const touching = ends.some((end, i) => ends.slice(i + 1)
                            .some((other) => Math.abs(end.x - other.x) + Math.abs(end.y - other.y) <= 1));
                        if (touching) say('duas pontas de portal encostadas uma à outra');
                    }
                }

                return problems;
            });
            if (broken.length) throw new Error(`receitas com problemas:\n  ${broken.join('\n  ')}`);

            // E agora as peças em jogo, no nível que tem tudo.
            await page.click('#chooseBtn');
            await page.waitForSelector('.levelCard[data-value="25"]');
            await sleep(500);
            // O 25 é o primeiro que tem portais, duas portas e gelo ao mesmo tempo.
            await page.click('.levelCard[data-value="25"]');
            await waitForMazePlaying(page);

            // Portal: entrar num leva ao outro.
            const hop = await page.evaluate(async () => {
                const { game } = await import('/games/maze-run/js/state.js');
                const { exitsFrom } = await import('/games/maze-run/js/maze.js');
                const portal = game.portals[0];
                const dir = exitsFrom(game.maze, portal.a.x, portal.a.y)[0];
                game.player.cx = portal.a.x + dir.x;
                game.player.cy = portal.a.y + dir.y;
                game.player.t = 0;
                game.player.moving = false;
                game.player.portalHop = false;
                game.player.queued = { x: -dir.x, y: -dir.y };
                return { b: portal.b };
            });
            // Vê-se por onde o jogador passa, e não onde está no fim: depois do
            // salto ele continua a andar, e ao fim de quase um segundo já pode
            // ir umas casas à frente do par. Antes, só passava porque um guarda
            // o apanhava logo à saída e o deixava parado ali.
            const landed = await page.evaluate(async (b) => {
                const { game } = await import('/games/maze-run/js/state.js');
                const until = performance.now() + 900;
                let last = null;
                while (performance.now() < until) {
                    last = { x: game.player.cx, y: game.player.cy };
                    if (Math.abs(last.x - b.x) + Math.abs(last.y - b.y) <= 2) return { ...last, near: true };
                    await new Promise((resolve) => setTimeout(resolve, 30));
                }
                return { ...last, near: false };
            }, hop.b);
            if (!landed.near) throw new Error(`o portal não saiu do outro lado: ficou em ${landed.x},${landed.y} e o par é ${hop.b.x},${hop.b.y}`);

            // Gelo: congela os guardas, e congelados não apanham ninguém.
            //
            // Nos níveis adiantados há guardas que chegam para apanhar o jogador
            // a meio do guião — e aí o nível está em 'caught' e nada do que se
            // segue acontece. Daí repor os guardas nos sítios deles e escolher o
            // cristal mais longe de todos: o que se testa é o gelo, não a sorte.
            await waitForMazePlaying(page);
            const frozen = await page.evaluate(async () => {
                const { game } = await import('/games/maze-run/js/state.js');
                const { resetGuards } = await import('/games/maze-run/js/enemies.js');
                resetGuards(game.guards);

                const longe = (cell) => Math.min(...game.guards
                    .map((g) => Math.hypot(g.walker.cx - cell.x, g.walker.cy - cell.y)));
                const freezer = game.freezers
                    .filter((f) => !f.taken)
                    .sort((a, b) => longe(b) - longe(a))[0];

                game.player.cx = freezer.x;
                game.player.cy = freezer.y;
                game.player.t = 0;
                game.player.moving = false;
                await new Promise((resolve) => setTimeout(resolve, 300));

                // Um guarda em cima do jogador: sem gelo era uma vida a menos.
                const guard = game.guards[0];
                guard.walker.cx = game.player.cx;
                guard.walker.cy = game.player.cy;
                guard.walker.t = 0;
                guard.walker.moving = false;
                const before = game.guards.map((g) => `${g.walker.cx},${g.walker.cy}`);
                const livesBefore = game.lives;
                await new Promise((resolve) => setTimeout(resolve, 700));
                return {
                    timer: game.freezeTimer,
                    lives: game.lives,
                    lost: livesBefore - game.lives,
                    phase: game.phase,
                    moved: game.guards.some((g, i) => `${g.walker.cx},${g.walker.cy}` !== before[i])
                };
            });
            if (!(frozen.timer > 0)) throw new Error('o cristal de gelo não congelou nada');
            if (frozen.moved) throw new Error('um guarda congelado andou');
            if (frozen.lost !== 0 || frozen.phase !== 'playing') throw new Error(`um guarda congelado apanhou o jogador (perdeu ${frozen.lost} vida(s), fase ${frozen.phase})`);

            // Porta: fechada não deixa passar, e a chave abre-a.
            await waitForMazePlaying(page);
            const door = await page.evaluate(async () => {
                const { game } = await import('/games/maze-run/js/state.js');
                const target = game.doors[0];
                const before = game.maze.isFloor(target.cell.x, target.cell.y);
                game.player.cx = target.key.x;
                game.player.cy = target.key.y;
                game.player.t = 0;
                game.player.moving = false;
                await new Promise((resolve) => setTimeout(resolve, 400));
                return { before, after: game.maze.isFloor(target.cell.x, target.cell.y), open: game.doors[0].open, keys: game.keysTaken };
            });
            if (door.before) throw new Error('a porta trancada deixava passar');
            if (!door.open || !door.after) throw new Error('a chave não abriu a porta');
            if (door.keys !== 1) throw new Error(`contou ${door.keys} chaves em vez de 1`);

            await sleep(400);
        }
    },
    {
        slug: 'maze-run',
        name: 'maze-run-resultados',
        viewport: { width: 450, height: 800 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            // Jogar o nível a sério levaria um minuto. Em vez disso arranca-se e
            // força-se a chegada à saída pelos próprios módulos do jogo — o ecrã
            // de resultados e o desbloqueio são montados pelo código real.
            await page.click('#playBtn');
            await waitForMazePlaying(page);

            await page.evaluate(async () => {
                const { game } = await import('/games/maze-run/js/state.js');
                for (const crystal of game.crystals) crystal.taken = true;
                game.collected = game.crystals.length;
                game.exitOpen = true;
                game.player.cx = game.layout.exit.x;
                game.player.cy = game.layout.exit.y;
                game.player.t = 0;
                game.player.moving = false;
            });

            await page.waitForSelector('#nextLevelBtn');
            await sleep(500);

            const unlocked = await page.evaluate(() => {
                const raw = localStorage.getItem('mazeRunProgress_v1');
                return raw ? JSON.parse(raw).unlocked : 0;
            });
            if (unlocked < 2) throw new Error(`o nível 2 não ficou desbloqueado (unlocked=${unlocked})`);

            await page.click('#nextLevelBtn');
            await waitForMazePlaying(page);
            await sleep(600);
        }
    },
    {
        slug: 'terras-do-reino',
        // Ao comprido, como se joga num computador: construir, semear, colher e
        // vender, tudo pelos botões e toques a sério.
        viewport: { width: 900, height: 560 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            await enterKingdom(page);

            // Primeiro o mapa: cada semente tem de dar um começo jogável.
            const broken = await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { generateWorld, idx, castleDistance, blockDistance, countFeatureNear, isFreeBlock, isMineBlock, CASTLE_TILE, CASTLE_SIZE, T_WATER } = await import(G + 'world.js');
                const { BUILDING, CASTLE_LEVELS, MAP_SIZE } = await import(G + 'config.js');
                const problems = [];
                for (let seed = 1; seed <= 200; seed++) {
                    const w = generateWorld(seed * 7919);
                    const say = (what) => problems.push(`semente ${seed * 7919}: ${what}`);
                    // O lenhador e a pedreira têm de caber no território inicial,
                    // e a mina no do nível 3 — senão o castelo encrava. Os
                    // edifícios são blocos de 2x2 e não encostam à praça do castelo.
                    const square = (x, y) => x < CASTLE_TILE.x + CASTLE_SIZE + 1 && x + 2 > CASTLE_TILE.x - 1
                        && y < CASTLE_TILE.y + CASTLE_SIZE + 1 && y + 2 > CASTLE_TILE.y - 1;
                    const spot = (radius, test) => {
                        for (let y = 0; y < MAP_SIZE - 1; y++) for (let x = 0; x < MAP_SIZE - 1; x++) {
                            if (blockDistance(x, y, 2) <= radius && !square(x, y) && test(x, y)) return true;
                        }
                        return false;
                    };
                    const near = (kind) => (x, y) => isFreeBlock(w, x, y, 2)
                        && countFeatureNear(w, x, y, 2, BUILDING[kind].near.feature, BUILDING[kind].near.radius) >= BUILDING[kind].near.min;
                    if (!spot(CASTLE_LEVELS[1].radius, near('woodcutter'))) say('não há onde pôr um lenhador no começo');
                    if (!spot(CASTLE_LEVELS[1].radius, near('quarry'))) say('não há onde pôr uma pedreira no começo');
                    if (!spot(CASTLE_LEVELS[3].radius, (x, y) => isMineBlock(w, x, y, 2))) say('sem sítio para uma mina ao alcance do castelo no nível 3');
                    for (let dy = 0; dy < CASTLE_SIZE; dy++) for (let dx = 0; dx < CASTLE_SIZE; dx++) {
                        const i = idx(CASTLE_TILE.x + dx, CASTLE_TILE.y + dy);
                        if (w.terrain[i] === T_WATER || w.feature[i]) say('o castelo não está em terra limpa');
                    }
                    if (w.towns.length !== 3) say(`${w.towns.length} vilas em vez de 3`);
                    for (const t of w.towns) {
                        let land = 0;
                        for (let dy = -6; dy <= 7; dy++) for (let dx = -6; dx <= 7; dx++) {
                            const x = t.x + dx; const y = t.y + dy;
                            if (x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && w.terrain[idx(x, y)] !== T_WATER) land++;
                        }
                        if (land < 100) say(`${t.name} sem terra para crescer (${land} casas)`);
                        if (castleDistance(t.x + 1, t.y + 1) <= CASTLE_LEVELS[CASTLE_LEVELS.length - 1].radius + 2) say(`${t.name} dentro do território máximo do castelo`);
                    }
                }
                return problems;
            });
            if (broken.length) throw new Error(`mapas com problemas:\n  ${broken.join('\n  ')}`);

            // Constrói uma casa pelo painel e pelo toque no mapa.
            await page.click('.toolBtn[data-sheet="build"]');
            await page.click('.buildCard[data-arg="house"]');
            const before = await kingdomCount(page);
            await tapPlaceable(page, 'house');
            await sleep(300);
            if (await kingdomCount(page) !== before + 1) throw new Error('a casa não foi construída');

            // Um campo: nasce semeado; dá-se-lhe tempo, colhe-se com um toque.
            await page.click('.toolBtn[data-sheet="build"]');
            await page.click('.buildCard[data-arg="field"]');
            await tapPlaceable(page, 'field');
            await page.click('#placeCancelBtn');
            const ripe = await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { game } = await import(G + 'state.js');
                const { stepEconomy } = await import(G + 'economy.js');
                const { gridToWorld, worldToScreen } = await import(G + 'iso.js');
                const field = game.buildings.find((b) => b.kind === 'field');
                if (!field || field.stage !== 'growing') return { error: `campo em ${field?.stage}` };
                const { BUILDING } = await import(G + 'config.js');
                for (let i = 0; i <= BUILDING.field.grow; i++) stepEconomy(1);
                const w = gridToWorld(field.x + 1, field.y + 1);
                const s = worldToScreen(w.x, w.y);
                return { stage: field.stage, x: s.x, y: s.y, wheat: game.res.wheat };
            });
            if (ripe.error) throw new Error(ripe.error);
            if (ripe.stage !== 'ripe') throw new Error(`o campo não amadureceu (${ripe.stage})`);
            await page.mouse.click(ripe.x, ripe.y);
            await sleep(200);
            const wheat = await page.evaluate(async () => (await import('/games/terras-do-reino/js/state.js')).game.res.wheat);
            if (!(wheat > ripe.wheat)) throw new Error('tocar no campo maduro não colheu nada');

            // Mercado: construir, vender o trigo e ver as moedas entrar.
            await page.click('.toolBtn[data-sheet="market"]');
            await page.click('#sheetBody [data-action="place"][data-arg="market"]');
            await tapPlaceable(page, 'market');
            await sleep(200);
            await page.click('.toolBtn[data-sheet="market"]');
            const coins = await page.evaluate(async () => (await import('/games/terras-do-reino/js/state.js')).game.res.coins);
            await page.click('.tradeBtn[data-action="sell"][data-arg="wheat"][data-n="all"]');
            await sleep(200);
            const sold = await page.evaluate(async () => (await import('/games/terras-do-reino/js/state.js')).game.res);
            if (sold.wheat !== 0 || !(sold.coins > coins)) throw new Error(`a venda não correu (trigo ${sold.wheat}, moedas ${coins} -> ${sold.coins})`);

            // Estradas: pelo modo de estrada, um toque onde começa e outro onde acaba.
            await page.click('.toolBtn[data-sheet="build"]');
            await page.click('.buildCard[data-arg="road"]');
            const ends = await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { canRoad, roadPath } = await import(G + 'buildings.js');
                const { gridToWorld, worldToScreen, camera } = await import(G + 'iso.js');
                const onScreen = (x, y) => {
                    const s = worldToScreen(gridToWorld(x + 0.5, y + 0.5).x, gridToWorld(x + 0.5, y + 0.5).y);
                    return s.x > 480 && s.y > 150 && s.x < camera.width - 30 && s.y < camera.height - 110 ? s : null;
                };
                for (let y = 30; y < 58; y++) for (let x = 30; x < 58; x++) {
                    const a = onScreen(x, y);
                    if (!a || !canRoad(x, y) || !canRoad(x + 3, y)) continue;
                    const b = onScreen(x + 3, y);
                    const path = b && roadPath(x, y, x + 3, y);
                    if (path && path.length <= 6) return [a, b];
                }
                return null;
            });
            if (!ends) throw new Error('não há onde abrir uma estrada à vista');
            for (const end of ends) {
                await page.mouse.click(end.x, end.y);
                await sleep(100);
            }
            await page.click('#placeCancelBtn');
            const roads = await page.evaluate(async () => {
                const { game } = await import('/games/terras-do-reino/js/state.js');
                return game.world.road.reduce((n, r) => n + (r === 1 ? 1 : 0), 0);
            });
            if (roads < 4) throw new Error(`a estrada não abriu (${roads} casas)`);

            // Uma estrada entre dois edifícios põe gente a andar nela.
            const walkers = await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { game, fx } = await import(G + 'state.js');
                const { buildRoad, roadPath, canRoad } = await import(G + 'buildings.js');
                const { stepWalkers } = await import(G + 'walkers.js');
                // As portas: casas à volta do bloco onde há ou pode haver estrada.
                const doors = (b) => {
                    const list = [];
                    for (let y = b.y - 1; y <= b.y + b.size; y++) for (let x = b.x - 1; x <= b.x + b.size; x++) {
                        if (canRoad(x, y) || game.world.road[y * 88 + x] === 1) list.push({ x, y });
                    }
                    return list;
                };
                const [a, b] = game.buildings;
                // Um par de portas afastadas: dois edifícios encostados davam um
                // caminho de uma casa, curto de mais para alguém andar nele.
                let path = null;
                for (const da of doors(a)) {
                    for (const db of doors(b)) {
                        const p = roadPath(da.x, da.y, db.x, db.y);
                        if (p && p.length >= 4 && (!path || p.length < path.length)) path = p;
                    }
                }
                if (!path) return -1;
                buildRoad(path);
                for (let i = 0; i < 40; i++) stepWalkers(0.25);
                return fx.walkers.filter((w) => w.group === 'player').length;
            });
            if (walkers < 0) throw new Error('não deu para ligar dois edifícios por estrada');
            if (walkers < 1) throw new Error('ninguém anda na estrada entre dois edifícios');

            await page.click('.toolBtn[data-sheet="castle"]');
            await sleep(200);
            await page.click('.toolBtn[data-sheet="kingdoms"]');
            await sleep(200);
            if ((await page.$$('.rankRow')).length !== 4) throw new Error('a tabela dos reinos não tem o jogador e as três vilas');
            await page.click('#sheetCloseBtn');
            await sleep(400);
        }
    },
    {
        slug: 'terras-do-reino',
        name: 'terras-do-reino-gravacao',
        // Ao alto, como num telemóvel.
        viewport: { width: 400, height: 820 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            await enterKingdom(page);
            const built = await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { game } = await import(G + 'state.js');
                const { checkPlacement, place, upgradeCastle } = await import(G + 'buildings.js');
                // Uma semente conhecida, com colinas para aplanar dentro do território.
                (await import(G + 'save.js')).newGame(2107662309);
                Object.assign(game.res, { coins: 3000, wood: 400, stone: 400 });
                if (!upgradeCastle()) return -1;
                let n = 0;
                for (let y = 0; y < 88 && n < 20; y++) for (let x = 0; x < 88 && n < 20; x++) {
                    const kind = n % 2 ? 'field' : 'house';
                    if (checkPlacement(kind, x, y).ok && place(kind, x, y)) n++;
                }
                return game.buildings.length;
            });
            if (built < 20) throw new Error(`só se construíram ${built} edifícios`);

            // Aplanar uma colina pelo botão da ficha dela: fica terra livre e a gravação lembra-se.
            const hill = await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { checkFlatten } = await import(G + 'buildings.js');
                const { openSheet } = await import(G + 'sheets.js');
                for (let y = 0; y < 88; y++) for (let x = 0; x < 88; x++) {
                    if (checkFlatten(x, y).ok) {
                        openSheet('tile', `${x},${y}`);
                        return { x, y };
                    }
                }
                return null;
            });
            if (!hill) throw new Error('não há nenhuma colina para aplanar no território');
            await page.click('#sheetBody [data-action="flatten"]');
            const flat = await page.evaluate(async ({ x, y }) => {
                const G = '/games/terras-do-reino/js/';
                const { game } = await import(G + 'state.js');
                const { isFreeLand } = await import(G + 'world.js');
                return isFreeLand(game.world, x, y);
            }, hill);
            if (!flat) throw new Error(`a colina em ${hill.x},${hill.y} não ficou aplanada`);
            await page.click('#sheetCloseBtn');

            // Sair grava o reino no aparelho — e cabe no teto do servidor.
            await page.click('#endBtn');
            await page.waitForSelector('#startScreen', { state: 'visible' });
            const save = await page.evaluate(() => localStorage.getItem('terrasDoReinoSave_v1'));
            if (!save) throw new Error('sair não gravou o reino');
            if (save.length > 8 * 1024) throw new Error(`a gravação tem ${save.length} bytes, acima dos 8 kB do servidor`);
            const data = JSON.parse(save);
            if (data.b.length !== built || data.cl !== 2) throw new Error('a gravação não tem o que se construiu');
            if (!(data.fl || []).includes(hill.y * 88 + hill.x)) throw new Error('a gravação não tem a colina aplanada');

            // Uma hora fora: ao voltar, o reino recupera esse tempo e diz o que se fez.
            await page.evaluate(() => {
                const d = JSON.parse(localStorage.getItem('terrasDoReinoSave_v1'));
                d.saved -= 3600 * 1000;
                localStorage.setItem('terrasDoReinoSave_v1', JSON.stringify(d));
            });
            await page.reload({ waitUntil: 'networkidle' });
            await waitForSplash(page);
            await enterKingdom(page);
            await page.waitForSelector('#welcomeScreen', { state: 'visible' });
            const back = await page.evaluate(async (h) => {
                const { game } = await import('/games/terras-do-reino/js/state.js');
                const { T_HILL, idx } = await import('/games/terras-do-reino/js/world.js');
                return {
                    n: game.buildings.length, level: game.castleLevel, day: game.day,
                    flat: game.world.terrain[idx(h.x, h.y)] !== T_HILL
                };
            }, hill);
            if (back.n !== built || back.level !== 2) throw new Error(`o reino voltou diferente (${back.n} edifícios, castelo ${back.level})`);
            if (!back.flat) throw new Error('a colina aplanada voltou a ser colina');
            if (back.day < 60) throw new Error(`a hora fora não foi recuperada (dia ${back.day})`);
            await page.click('#welcomeBtn');
            await sleep(600);
        }
    },
    {
        slug: 'pixel-racing',
        name: 'pixel-racing-resultados',
        viewport: { width: 800, height: 450 },
        canvas: true,
        menuSelector: '#startScreen',
        async play(page) {
            // Correr três voltas a sério levaria quase um minuto. Em vez disso,
            // arranca-se uma corrida e força-se a chegada à meta pelos próprios
            // módulos do jogo — o ecrã de resultados é montado pelo código real.
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('.modeBtn[data-mode="tournament"]');
            await page.click('#startBtn');
            await waitForRacing(page);

            const afterFirstRace = await page.evaluate(async () => {
                const { race } = await import('/games/pixel-racing/js/state.js');
                const { triggerFinish } = await import('/games/pixel-racing/js/race.js');
                race.player.lap = 3;
                triggerFinish();
                return race.phase;
            });
            if (afterFirstRace !== 'finishOverlay') throw new Error(`fase inesperada: ${afterFirstRace}`);

            await page.waitForSelector('#nextRaceBtn');
            await sleep(500);
            await page.click('#nextRaceBtn');
            await waitForRacing(page);

            // Segunda e terceira corridas, para chegar ao fim do torneio.
            for (let i = 0; i < 2; i++) {
                await page.evaluate(async () => {
                    const { race } = await import('/games/pixel-racing/js/state.js');
                    const { triggerFinish } = await import('/games/pixel-racing/js/race.js');
                    race.player.lap = 3;
                    triggerFinish();
                });
                await sleep(2000);
                const next = await page.$('#nextRaceBtn');
                if (next) {
                    await next.click();
                    await waitForRacing(page);
                }
            }

            await page.waitForSelector('#menuBtn');
            await sleep(600);
        }
    }
];

/**
 * Toca no ingrediente pedido, procurando-o nas duas bancadas (salgados/doces).
 * O rótulo mais longo que caiba no texto do pedido é o ingrediente certo
 * ("Ovo estrelado" e não "Ovo").
 */
async function tapIngredient(page, requirement) {
    for (const tab of ['#tabSavory', '#tabSweet']) {
        await page.click(tab);
        await sleep(160);
        const key = await page.evaluate((req) => {
            let best = null;
            for (const btn of document.querySelectorAll('.bench-category.active .ing-btn')) {
                const label = (btn.querySelector('.lbl')?.textContent || '').trim();
                if (label && req.includes(label) && (!best || label.length > best.label.length)) {
                    best = { label, key: btn.dataset.key };
                }
            }
            return best?.key ?? null;
        }, requirement);

        if (key) {
            await page.click(`.bench-category.active .ing-btn[data-key="${key}"]`);
            return true;
        }
    }
    return false;
}

/** Rejeita se a promessa não resolver dentro do prazo. */
function withTimeout(promise, ms, message) {
    let timer;
    const limit = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${message} (${ms}ms)`)), ms);
    });
    return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Espera que o Pixel Racing esteja mesmo a correr, em vez de dormir um tempo fixo.
 *
 * O delta-time do jogo está limitado a 50ms por frame; num runner lento, com menos
 * frames por segundo, o relógio do jogo anda mais devagar do que o relógio real e
 * a contagem decrescente demora mais do que os 4 segundos nominais.
 */
async function waitForRacing(page) {
    // Atenção: o predicado de waitForFunction TEM de ser síncrono. Se for `async`,
    // o Playwright vê a Promise devolvida, considera-a verdadeira e devolve o
    // controlo de imediato — a espera não esperava nada. Por isso o módulo é
    // carregado à parte com evaluate (esse, sim, aguarda a Promise) e deixa o
    // objeto de estado numa global para o predicado o ler sem ser assíncrono.
    await page.evaluate(async () => {
        const { race } = await import('/games/pixel-racing/js/state.js');
        window.__arcadeRace = race;
    });
    await page.waitForFunction(
        () => window.__arcadeRace && window.__arcadeRace.phase === 'racing',
        undefined,
        { timeout: 30000 }
    );
}

/**
 * O mesmo para o Maze Run: espera que o nível esteja mesmo a correr, em vez de
 * dormir o tempo nominal da contagem decrescente (ver a nota do `waitForRacing`
 * sobre o predicado ter de ser síncrono).
 */
async function waitForMazePlaying(page) {
    await page.evaluate(async () => {
        const { game } = await import('/games/maze-run/js/state.js');
        window.__arcadeMaze = game;
    });
    await page.waitForFunction(
        () => window.__arcadeMaze && window.__arcadeMaze.phase === 'playing',
        undefined,
        { timeout: 30000 }
    );
}

/**
 * Terras do Reino: carrega em "Fundar/Continuar" assim que o botão fica ativo
 * (espera pela resposta da conta, que aqui é um 503) e espera pelo jogo.
 */
async function enterKingdom(page) {
    await page.waitForSelector('#playBtn:not([disabled])');
    await page.click('#playBtn');
    await page.evaluate(async () => {
        const { game } = await import('/games/terras-do-reino/js/state.js');
        window.__arcadeKingdom = game;
    });
    await page.waitForFunction(() => window.__arcadeKingdom && window.__arcadeKingdom.phase === 'playing');
}

async function kingdomCount(page) {
    return page.evaluate(() => window.__arcadeKingdom.buildings.length);
}

/** Toca, no canvas, na casa válida mais perto do castelo para construir `kind`. */
async function tapPlaceable(page, kind) {
    const spot = await page.evaluate(async (kind) => {
        const G = '/games/terras-do-reino/js/';
        const { checkPlacement } = await import(G + 'buildings.js');
        const { gridToWorld, worldToScreen, camera } = await import(G + 'iso.js');
        const { castleDistance } = await import(G + 'world.js');
        let best = null;
        // Os edifícios são blocos de 2x2 e ficam centrados no canto de casa
        // mais perto do toque: tocar a 3/4 da casa de cima põe-nos lá.
        for (let y = 0; y < 88; y++) for (let x = 0; x < 88; x++) {
            if (!checkPlacement(kind, x, y).ok) continue;
            const w = gridToWorld(x + 0.75, y + 0.75);
            const s = worldToScreen(w.x, w.y);
            // Longe das bordas, da barra de ferramentas e do painel.
            if (s.x < 480 && camera.width > 700) continue;
            if (s.x < 30 || s.y < 150 || s.x > camera.width - 30 || s.y > camera.height - 110) continue;
            const d = castleDistance(x, y);
            if (!best || d < best.d) best = { x: s.x, y: s.y, d };
        }
        return best;
    }, kind);
    if (!spot) throw new Error(`não há onde construir ${kind} à vista`);
    await page.mouse.click(spot.x, spot.y);
}

/**
 * Espera que o ecrã de arranque da arcada saia da frente.
 *
 * Cada jogo abre com o logótipo da arcada (lib/arcade/splash.*) a tapar o ecrã
 * todo durante uns segundos. Sem esperar por ele, o primeiro clique do guião
 * caía em cima do splash e o screenshot do menu era o splash.
 *
 * Devolve false se o jogo nem sequer traz o ecrã de arranque no markup.
 */
async function waitForSplash(page) {
    if (!(await page.$('#arcadeSplash'))) return false;
    await page.waitForSelector('#arcadeSplash', { state: 'hidden', timeout: SPLASH_TIMEOUT_MS });
    return true;
}

/** True se o canvas tem mais do que uma cor — ou seja, o jogo desenhou alguma coisa. */
async function canvasHasContent(page) {
    return page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas || !canvas.width) return false;
        const ctx = canvas.getContext('2d');
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const first = [data[0], data[1], data[2]];
        for (let i = 4; i < data.length; i += 4 * 97) {
            if (data[i] !== first[0] || data[i + 1] !== first[1] || data[i + 2] !== first[2]) return true;
        }
        return false;
    });
}

async function runGame(browser, game, baseUrl) {
    const problems = [];
    const context = await browser.newContext({ viewport: game.viewport, deviceScaleFactor: 1 });
    await context.addInitScript(SEED_RANDOM);
    // Estado que o jogo já devia ter encontrado no aparelho — por exemplo o
    // progresso que abre os níveis de um jogo com níveis. Tem de ser escrito
    // antes de a página abrir, senão o jogo já leu o que lá estava.
    if (game.storage) {
        await context.addInitScript((entries) => {
            try {
                for (const [key, value] of entries) localStorage.setItem(key, value);
            } catch {
                // Armazenamento bloqueado: o cenário corre na mesma, com o que houver.
            }
        }, Object.entries(game.storage));
    }
    context.setDefaultTimeout(SELECTOR_TIMEOUT_MS);
    context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    const page = await context.newPage();

    // Ruído esperado, que não é uma regressão do jogo: o backend falso responde
    // 503 a /api/*, e o sandbox de CI não tem saída para as fontes do Google.
    const isExpectedFailure = (url) => !url.startsWith(baseUrl) || url.includes('/api/');

    page.on('pageerror', (err) => problems.push(`erro de JavaScript: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        // Um 404/503 já aparece no handler de 'response'; aqui só interessam os
        // console.error que o próprio jogo escreve.
        if (msg.text().startsWith('Failed to load resource')) return;
        problems.push(`console.error: ${msg.text()}`);
    });
    page.on('requestfailed', (req) => {
        if (!isExpectedFailure(req.url())) problems.push(`pedido falhado: ${req.url()}`);
    });
    page.on('response', (res) => {
        if (res.status() >= 400 && !isExpectedFailure(res.url())) {
            problems.push(`HTTP ${res.status()} em ${res.url().replace(baseUrl, '')}`);
        }
    });

    const shots = {};
    try {
        await page.goto(`${baseUrl}/games/${game.slug}/`, { waitUntil: 'networkidle' });
        // O ecrã de arranque tem de estar no markup e tem de se ir embora sozinho:
        // se ficasse preso, o jogo era injogável e mais nada aqui daria por isso.
        if (!(await waitForSplash(page))) problems.push('ecrã de arranque em falta');
        await sleep(500);

        const hasMenu = await page.evaluate(() => document.body.innerText.trim().length > 0);
        if (!hasMenu) problems.push('ecrã inicial sem texto visível');
        // Alguns jogos animam o canvas por trás do menu (o pulsar das almofadas de
        // boost, por exemplo). Como o ecrã do menu é translúcido, essa animação
        // atravessa-o e o screenshot nunca sairia igual duas vezes. Nesses jogos
        // esconde-se o canvas e fotografa-se só o elemento do menu — o canvas fica
        // coberto pelo screenshot de jogo e pela verificação de conteúdo.
        if (game.menuSelector) {
            await page.addStyleTag({ content: 'canvas { visibility: hidden !important; }' });
        }
        const menuTarget = game.menuSelector ? page.locator(game.menuSelector) : page;
        shots.menu = await menuTarget.screenshot({ animations: 'disabled' });
        if (game.menuSelector) {
            await page.evaluate(() => document.querySelectorAll('style').forEach((el) => {
                if (el.textContent.includes('visibility: hidden !important')) el.remove();
            }));
        }

        await withTimeout(game.play(page), SCENARIO_TIMEOUT_MS, 'o guião demorou demasiado');
        if (game.canvas && !(await canvasHasContent(page))) problems.push('o canvas não desenhou nada');
        shots.game = await page.screenshot({ animations: 'disabled' });
    } catch (err) {
        problems.push(`o guião de jogo falhou: ${err.message}`);
    } finally {
        await context.close();
    }

    return { problems, shots };
}

/**
 * Comparação de screenshots. É deliberadamente binária: dois PNG ou têm os
 * mesmos bytes ou não têm. Uma "percentagem de bytes iguais" não diria nada de
 * útil — a compressão do PNG faz com que um pixel diferente mude o ficheiro todo.
 */
function isIdentical(a, b) {
    if (!a || !b) return null;
    return a.equals(b);
}

async function main() {
    for (const g of GAMES) g.name ??= g.slug;
    const games = (ONLY ? GAMES.filter((g) => g.slug === ONLY || g.name === ONLY) : GAMES)
        .filter((g) => !SKIP.includes(g.name) && !SKIP.includes(g.slug));
    if (!games.length) {
        console.error(`Jogo desconhecido: ${ONLY}`);
        process.exit(2);
    }

    const { port, close } = await startStaticServer(WWWROOT);
    const baseUrl = `http://127.0.0.1:${port}`;
    const executablePath = findChromium();
    const browser = await chromium.launch(executablePath ? { executablePath } : {});

    if (OUT) await mkdir(OUT, { recursive: true });

    let failed = 0;
    for (const game of games) {
        process.stdout.write(`\n▶ ${game.name}\n`);
        const { problems, shots } = await runGame(browser, game, baseUrl);

        for (const [name, buffer] of Object.entries(shots)) {
            if (OUT) await writeFile(join(OUT, `${game.name}-${name}.png`), buffer);
            if (COMPARE) {
                const previous = await readFile(join(COMPARE, `${game.name}-${name}.png`)).catch(() => null);
                const identical = isIdentical(previous, buffer);
                if (identical === null) {
                    console.log(`  ~ ${name}: sem referência para comparar`);
                } else if (identical) {
                    console.log(`  = ${name}: igual à referência`);
                } else if (name === 'menu' && game.stableMenu !== false) {
                    problems.push('o ecrã de menu mudou em relação à referência');
                } else {
                    // Um fotograma de jogo depende do relógio real (delta-time do
                    // requestAnimationFrame), por isso nunca é igual ao anterior.
                    console.log(`  ~ ${name}: diferente da referência (esperado num fotograma de jogo)`);
                }
            }
        }

        if (problems.length) {
            failed++;
            for (const p of problems) console.log(`  ✗ ${p}`);
        } else {
            console.log('  ✓ sem erros');
        }
    }

    await browser.close();
    await close();

    console.log(failed ? `\n${failed} jogo(s) com problemas.` : '\nTodos os jogos passaram.');
    process.exit(failed ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
