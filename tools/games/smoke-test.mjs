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
        name: 'pong-1jogador',
        viewport: { width: 800, height: 450 },
        canvas: true,
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('#startBtn');
            // Arrasta a raquete de baixo para devolver a bola à IA.
            await page.mouse.move(400, 420);
            await page.mouse.down();
            for (let i = 0; i < 40; i++) {
                await page.mouse.move(400 + Math.sin(i / 4) * 250, 420);
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
            await page.click('#startBtn');
            await waitForRacing(page);
            await page.keyboard.down('ArrowUp');
            await sleep(1200);
            await page.keyboard.up('ArrowUp');
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
            await page.click('.modeBtn[data-mode="tournament"]');
            await page.fill('#playerNameInput', 'MARQUITOS');
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
