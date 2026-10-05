#!/usr/bin/env node
/**
 * Gera as capas do catálogo de jogos (wwwroot/covers/<slug>.webp).
 *
 * Cada capa é um screenshot real do jogo a ser jogado: o script abre o jogo num
 * Chromium headless, joga-o durante alguns segundos com o guião definido em
 * GAMES, recorta a zona interessante em 16:9 e exporta um WebP de 960x540.
 * O título aparece por cima, em HTML/CSS, na página do catálogo (Home.razor).
 *
 * Pré-requisitos:
 *   npm install -D playwright   (ou  npx playwright install chromium)
 *   e o site a correr:  cd src/MarquitosArcade && dotnet run
 *
 * Uso:
 *   node tools/covers/capture-covers.mjs
 *   node tools/covers/capture-covers.mjs --base http://localhost:5000 --only pong
 *
 * Nota: os jogos têm elementos aleatórios (pedidos, ângulo da bola, posição dos
 * carros), por isso cada execução produz um fotograma diferente do mesmo jogo.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../../src/MarquitosArcade/wwwroot/covers');

const COVER_W = 960;
const COVER_H = 540; // 16:9
const WEBP_QUALITY = 0.82;

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = argValue('--base', 'http://localhost:5000').replace(/\/$/, '');
const ONLY = argValue('--only', null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Esconde a barra da arcada (← ARCADE / 🏆) — não faz parte do jogo em si. */
const HIDE_ARCADE_CHROME = '.topBar { display: none !important; }';
/** O ecrã de arranque está no ar 2s de propósito; isto é só a rede de segurança. */
const SPLASH_TIMEOUT_MS = 20000;

const GAMES = [
    {
        slug: 'tasca-do-ze',
        // O jogo é um layout de telemóvel (max-width 480px), por isso capturamos
        // em retrato e recortamos a faixa da fila de pedidos + pedido ativo.
        viewport: { width: 480, height: 880 },
        scale: 2,
        async play(page) {
            await page.click('#playBtn');
            await sleep(400);
            await page.fill('#nameInput', 'Chef Marquitos');
            await page.click('#startBtn');
            await sleep(2200);
            // Serve pedidos certos para a capa mostrar pontos verdadeiros e a
            // fila já com clientes à espera.
            let score = '0';
            for (let i = 0; i < 4; i++) score = await serveCurrentOrder(page);
            console.log(`  (tasca-do-ze: ${score} pontos no ecrã)`);
            await sleep(8000); // deixa a fila voltar a encher antes da foto
        },
        // Faixa dos corações/pontos até ao pedido ativo — deixa de fora o
        // cabeçalho com o nome do jogo, que no cartão vem no banner da capa.
        async clip(page) {
            const hearts = await page.locator('.hearts').boundingBox();
            return { x: 0, y: Math.max(0, hearts.y - 5), width: 480, height: 270 };
        }
    },
    {
        slug: 'pong',
        // Modo 2 jogadores: raquetes à esquerda/direita, o enquadramento clássico.
        viewport: { width: 800, height: 450 },
        scale: 2,
        async play(page) {
            await page.click('.modeBtn[data-mode="two"]');
            await page.click('#startBtn');
            await page.addStyleTag({ content: HIDE_ARCADE_CHROME });
            // Arrasta a raquete da esquerda para manter a bola em jogo.
            await page.mouse.move(120, 225);
            await page.mouse.down();
            for (let i = 0; i < 150; i++) {
                await page.mouse.move(120, 225 + Math.sin(i / 3.5) * 150);
                await sleep(55);
            }
            await page.mouse.up();
        },
        clip: () => ({ x: 6, y: 5, width: 788, height: 443 })
    },
    {
        slug: 'pixel-racing',
        viewport: { width: 800, height: 450 },
        scale: 2,
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('.modeBtn[data-mode="quick"]');
            await page.click('#startBtn');
            await page.addStyleTag({ content: HIDE_ARCADE_CHROME });
            await sleep(3600); // contagem decrescente
            await page.keyboard.down('ArrowUp');
            await sleep(800); // pelotão ainda junto, logo a seguir à partida
            await page.keyboard.up('ArrowUp');
        },
        // Enquadramento completo: HUD em cima, pelotão ao centro. Os botões
        // táteis do fundo ficam escondidos pelo banner do título.
        clip: () => ({ x: 0, y: 0, width: 800, height: 450 })
    },
    {
        slug: 'maze-run',
        viewport: { width: 800, height: 450 },
        scale: 2,
        async play(page) {
            await page.fill('#playerNameInput', 'MARQUITOS');
            await page.click('#playBtn');
            await page.addStyleTag({ content: HIDE_ARCADE_CHROME });
            await sleep(5200); // contagem decrescente
            // Uns passos para os guardas saírem do sítio e a foto não sair com
            // toda a gente parada no arranque. Curto de propósito: um percurso
            // mais longo cruzava-se com o guarda laranja e a capa saía com o
            // "APANHADO!" por cima do labirinto.
            for (const key of ['ArrowRight', 'ArrowDown']) {
                await page.keyboard.press(key);
                await sleep(700);
            }
        },
        // O labirinto é quadrado e a capa é 16:9, por isso sobra fundo dos dois
        // lados — é o mesmo fundo de auroras do jogo, e o banner do título
        // assenta por cima dele.
        clip: () => ({ x: 0, y: 0, width: 800, height: 450 })
    },
    {
        slug: 'gulosinhos',
        viewport: { width: 800, height: 450 },
        scale: 2,
        async play(page) {
            // A Doçaria (o último nível, o mais cor-de-rosa), com a raposa a meio
            // de um salto por cima de umas guloseimas e de um guardião. O nível
            // abre-se pelo progresso guardado, como faria quem lá chegou.
            await page.evaluate(() => {
                localStorage.setItem('gulosinhosProgress_v1', JSON.stringify({ v: 1, unlocked: 12, levels: {} }));
                localStorage.setItem('gulosinhosAnimal_v1', 'raposa');
            });
            await page.reload({ waitUntil: 'load' });
            await waitForSplash(page);
            await page.click('#playBtn');
            await page.addStyleTag({ content: HIDE_ARCADE_CHROME });
            await page.evaluate(async () => {
                const { game } = await import('/games/gulosinhos/js/state.js');
                window.__arcadeGulosinhos = game;
            });
            await page.waitForFunction(() => window.__arcadeGulosinhos.phase === 'playing', undefined, { timeout: 20000 });
            // Salta para o primeiro guardião de geleia do percurso.
            await page.evaluate(() => {
                const game = window.__arcadeGulosinhos;
                const seg = game.world.segments.find((s) => s.name === 'jelly' || s.name === 'ledge');
                game.player.x = seg.x - 1;
                game.player.y = 2;
            });
            await sleep(900);
            await page.keyboard.down('ArrowRight');
            await sleep(250);
            await page.keyboard.down('Space');
            await sleep(330);
            await page.keyboard.up('ArrowRight');
        },
        clip: () => ({ x: 0, y: 0, width: 800, height: 450 })
    },
    {
        slug: 'memoria-animal',
        viewport: { width: 800, height: 450 },
        scale: 2,
        async play(page) {
            // Um tabuleiro a meio: o nível 7 (16 cartas, cor de maçã), com uns pares já
            // encontrados (moldura dourada) e duas cartas acabadas de virar.
            // O nível abre-se pelo progresso guardado, como faria quem lá chegou.
            await page.evaluate(() => localStorage.setItem('memoriaAnimalProgress_v1',
                JSON.stringify({ v: 1, unlocked: 7, levels: {} })));
            await page.reload({ waitUntil: 'load' });
            await waitForSplash(page);
            await page.click('#chooseBtn');
            await sleep(500);
            await page.click('.levelCard[data-value="7"]');
            await page.addStyleTag({ content: HIDE_ARCADE_CHROME });
            await page.evaluate(async () => {
                const { game } = await import('/games/memoria-animal/js/state.js');
                window.__arcadeMemo = game;
            });
            await page.waitForFunction(() => window.__arcadeMemo.phase === 'playing', undefined, { timeout: 20000 });

            const cards = await page.$$('.card');
            const order = await page.evaluate(() => window.__arcadeMemo.cards.map((card) => card.animal));
            const spots = {};
            order.forEach((animal, i) => (spots[animal] ||= []).push(i));
            const pairs = Object.values(spots);
            // Três pares feitos e, no fim, uma carta de um par por fazer e a
            // primeira do seguinte — à vista, como a meio de uma jogada.
            for (const [a, b] of pairs.slice(0, 3)) {
                await cards[a].click();
                await cards[b].click();
                await sleep(250);
            }
            await sleep(1200); // o nome do último par sai do ecrã
            await cards[pairs[3][0]].click();
            await sleep(700);
        },
        clip: () => ({ x: 0, y: 0, width: 800, height: 450 })
    },
    {
        slug: 'terras-do-reino',
        viewport: { width: 800, height: 450 },
        scale: 2,
        async play(page) {
            await page.waitForSelector('#playBtn:not([disabled])');
            await page.click('#playBtn');
            await page.addStyleTag({ content: `${HIDE_ARCADE_CHROME} .hud, .toolbar, .toasts { display: none !important; }` });
            // Um reino a meio do caminho: o castelo no nível 3 e os edifícios à
            // volta dele, construídos pelas regras do próprio jogo (cada um no
            // sítio válido mais perto do castelo) e com uns segundos em cima,
            // para os campos estarem em fases diferentes.
            await page.evaluate(async () => {
                const G = '/games/terras-do-reino/js/';
                const { game } = await import(G + 'state.js');
                const { checkPlacement, place } = await import(G + 'buildings.js');
                const { plantField, stepEconomy } = await import(G + 'economy.js');
                const { castleDistance, CASTLE_CENTER } = await import(G + 'world.js');
                const { MAP_SIZE } = await import(G + 'config.js');
                const { camera, lookAt } = await import(G + 'iso.js');
                Object.assign(game.res, { coins: 9000, wood: 900, stone: 900, planks: 300 });
                // O nível 3 pede um reino grande (moradores, contentamento): na capa salta-se direto para ele.
                game.castleLevel = 3;
                const plan = ['market', 'mill', 'bakery', 'house', 'field', 'field', 'house', 'pasture', 'field',
                    'woodcutter', 'quarry', 'field', 'house', 'carpentry', 'field', 'barn', 'field', 'house', 'dairy', 'field'];
                for (const [n, kind] of plan.entries()) {
                    let best = null;
                    // O mapa cresceu (MAP_SIZE) e o castelo está sempre ao centro: nada
                    // de tamanhos fixos aqui, ou a capa enquadrava um canto vazio.
                    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
                        if (!checkPlacement(kind, x, y).ok) continue;
                        const d = castleDistance(x, y);
                        if (!best || d < best.d) best = { x, y, d };
                    }
                    const b = best && place(kind, best.x, best.y);
                    if (b?.kind === 'field') {
                        plantField(b);
                        b.growth = (n % 4) / 4;
                    }
                }
                for (let i = 0; i < 12; i++) stepEconomy(1);
                camera.zoom = 1.15;
                lookAt(CASTLE_CENTER.x + 0.6, CASTLE_CENTER.y + 0.6);
            });
            await sleep(2500);
        },
        clip: () => ({ x: 0, y: 0, width: 800, height: 450 })
    }
];

/**
 * Espera que o ecrã de arranque da arcada (lib/arcade/splash.*) saia da frente.
 * Cada jogo abre com o logótipo a tapar o ecrã todo durante uns segundos.
 */
async function waitForSplash(page) {
    if (!(await page.$('#arcadeSplash'))) return;
    await page.waitForSelector('#arcadeSplash', { state: 'hidden', timeout: SPLASH_TIMEOUT_MS });
}

/** Completa o pedido ativo da Tasca do Zé e toca a campainha. */
async function serveCurrentOrder(page) {
    const wanted = await page.$$eval('#reqList .req-chip', (els) => els.map((e) => e.textContent.trim()));
    for (const req of wanted) {
        await tapIngredient(page, req);
        await sleep(240);
    }
    await sleep(300);
    await page.click('#bellBtn');
    await sleep(1400);
    return page.textContent('#score');
}

/** Toca no ingrediente pedido, procurando-o nas duas bancadas (salgados/doces). */
async function tapIngredient(page, requirement) {
    for (const tab of ['#tabSavory', '#tabSweet']) {
        await page.click(tab);
        await sleep(160);
        // O rótulo mais longo que caiba no texto do pedido é o ingrediente certo
        // ("Ovo estrelado" e não "Ovo").
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

/** Converte o PNG do screenshot num WebP de 960x540, usando o próprio Chromium. */
async function toWebp(page, pngBuffer) {
    const base64 = await page.evaluate(
        async ({ png, w, h, q }) => {
            const img = new Image();
            img.src = 'data:image/png;base64,' + png;
            await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            return canvas.toDataURL('image/webp', q).split(',')[1];
        },
        { png: pngBuffer.toString('base64'), w: COVER_W, h: COVER_H, q: WEBP_QUALITY }
    );
    return Buffer.from(base64, 'base64');
}

/**
 * Onde está o Chromium — o mesmo critério do smoke-test dos jogos: alguns
 * ambientes trazem-no pré-instalado e desligam o download do Playwright.
 * Devolve null para o Playwright resolver sozinho.
 */
function findChromium() {
    if (process.env.ARCADE_CHROMIUM) return process.env.ARCADE_CHROMIUM;
    const preinstalled = '/opt/pw-browsers/chromium';
    return existsSync(preinstalled) ? preinstalled : null;
}

const executablePath = findChromium();
const browser = await chromium.launch({
    args: ['--hide-scrollbars'],
    ...(executablePath ? { executablePath } : {})
});
await mkdir(OUT_DIR, { recursive: true });

for (const game of GAMES) {
    if (ONLY && ONLY !== game.slug) continue;
    const context = await browser.newContext({
        viewport: game.viewport,
        deviceScaleFactor: game.scale,
        ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/games/${game.slug}/`, { waitUntil: 'load' });
    // Sem esperar por ele, a capa saía com o logótipo da arcada em vez do jogo
    // e o primeiro clique do guião caía em cima do splash.
    await waitForSplash(page);
    await sleep(900);
    await game.play(page);

    const clip = await game.clip(page);
    const png = await page.screenshot({ clip });
    const webp = await toWebp(page, png);
    const file = resolve(OUT_DIR, `${game.slug}.webp`);
    await writeFile(file, webp);
    console.log(`${game.slug}: ${(webp.length / 1024).toFixed(0)} kB → ${file}`);

    await context.close();
}

await browser.close();
