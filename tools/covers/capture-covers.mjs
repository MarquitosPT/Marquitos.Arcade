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
    }
];

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

const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
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
