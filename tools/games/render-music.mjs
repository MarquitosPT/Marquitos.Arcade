#!/usr/bin/env node
/**
 * Grava a música de fundo dos jogos em WAV, sem abrir o jogo.
 *
 * Cada jogo com música tem um `js/music.js` que exporta `music` (feito com o
 * `createMusic` de /lib/arcade/music.js); um que não exporte fica de fora,
 * com um aviso. Este script serve o wwwroot com o
 * servidor estático do smoke-test, abre uma página em branco num Chromium
 * headless, importa esse módulo e marca a partitura num OfflineAudioContext
 * (`music.schedule`) — o mesmo código que toca no jogo, mas mais depressa do que
 * em tempo real. Serve para ouvir uma mudança à partitura ou à mistura, e para a
 * mostrar a quem não vai abrir o jogo.
 *
 * Uso:
 *   node tools/games/render-music.mjs                      # todos os jogos com música
 *   node tools/games/render-music.mjs --only pixel-racing
 *   node tools/games/render-music.mjs --loops 2 --out /tmp/musica
 *   node tools/games/render-music.mjs --seed 1             # sempre o mesmo resultado
 *
 * Com --seed, o Math.random da página passa a ser determinístico: duas
 * gravações do mesmo código saem iguais (a menos de arredondamentos), o que
 * serve para confirmar que um refactor não mudou o som.
 *
 * Imprime, por jogo, a duração, o pico e o RMS (em dBFS) — para comparar o
 * volume das músicas entre si.
 */

import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const argValue = (name, fallback = null) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const WWWROOT = resolve(argValue('--root', resolve(HERE, '../../src/MarquitosArcade/wwwroot')));
const ONLY = argValue('--only');
const OUT = resolve(argValue('--out', resolve(HERE, 'music-out')));
const LOOPS = Number(argValue('--loops', '1'));
const SEED = argValue('--seed');
const SAMPLE_RATE = 44100;
/** Segundos a mais no fim, para o reverb se apagar. */
const TAIL = 2.5;

/** O mesmo que o smoke-test: o Chromium pré-instalado, se houver. */
function findChromium() {
    if (process.env.ARCADE_CHROMIUM) return process.env.ARCADE_CHROMIUM;
    const preinstalled = '/opt/pw-browsers/chromium';
    return existsSync(preinstalled) ? preinstalled : null;
}

/** mulberry32: pequeno, rápido e chega para tornar o ruído repetível. */
const seededRandom = (seed) => `(() => {
    let a = ${Number(seed) | 0};
    Math.random = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
})();`;

/** PCM de 16 bits, estéreo intercalado. */
function wav(left, right, sampleRate) {
    const n = left.length;
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + n * 4, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 4, 28);
    buf.writeUInt16LE(4, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(n * 4, 40);
    const pcm = (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
    for (let i = 0; i < n; i++) {
        buf.writeInt16LE(pcm(left[i]), 44 + i * 4);
        buf.writeInt16LE(pcm(right[i]), 46 + i * 4);
    }
    return buf;
}

const dbfs = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');

const games = readdirSync(join(WWWROOT, 'games'))
    .filter((id) => existsSync(join(WWWROOT, 'games', id, 'js', 'music.js')))
    .filter((id) => !ONLY || id === ONLY);

if (!games.length) {
    console.error(ONLY ? `O jogo "${ONLY}" não tem js/music.js.` : 'Nenhum jogo tem js/music.js.');
    process.exit(1);
}

await mkdir(OUT, { recursive: true });
const server = await startStaticServer(WWWROOT);
const base = `http://127.0.0.1:${server.port}`;
const executablePath = findChromium();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failed = false;

for (const id of games) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (SEED !== null) await page.addInitScript(seededRandom(SEED));
    // Uma página qualquer do mesmo site, só para o import ter a origem certa.
    await page.goto(`${base}/games/${id}/js/music.js`);

    try {
        const result = await page.evaluate(async ({ url, loops, sampleRate, tail }) => {
            const { music } = await import(url);
            // Uma música que não seja do motor comum não se sabe gravar: fica de fora.
            if (!music?.schedule) return null;
            const at = 0.1;
            const seconds = at + music.loopSeconds * loops + tail;
            const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
            music.schedule(ctx, { loops, at });
            const buffer = await ctx.startRendering();
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            let peak = 0;
            let sum = 0;
            for (let i = 0; i < left.length; i++) {
                peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
                sum += left[i] * left[i] + right[i] * right[i];
            }
            // Os dois canais seguidos, em base64: o evaluate só devolve JSON.
            const both = new Float32Array(left.length * 2);
            both.set(left);
            both.set(right, left.length);
            const bytes = new Uint8Array(both.buffer);
            let bin = '';
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return { seconds, loopSeconds: music.loopSeconds, peak, rms: Math.sqrt(sum / (left.length * 2)), data: btoa(bin) };
        }, { url: `/games/${id}/js/music.js`, loops: LOOPS, sampleRate: SAMPLE_RATE, tail: TAIL });

        if (!result) {
            console.log(`▶ ${id}\n  – não usa o createMusic de /lib/arcade/music.js; fica de fora`);
            await page.close();
            continue;
        }
        const raw = Buffer.from(result.data, 'base64');
        const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
        const half = samples.length / 2;
        const file = join(OUT, `${id}.wav`);
        await writeFile(file, wav(samples.subarray(0, half), samples.subarray(half), SAMPLE_RATE));

        console.log(`▶ ${id}`);
        console.log(`  volta de ${result.loopSeconds.toFixed(1)} s · pico ${dbfs(result.peak)} dBFS · RMS ${dbfs(result.rms)} dBFS`);
        console.log(`  ${file}`);
        if (result.peak >= 1) console.log('  ⚠ satura: o pico chega a 0 dBFS');
    } catch (e) {
        failed = true;
        console.log(`▶ ${id}\n  ✗ ${e.message}`);
    }
    for (const message of errors) {
        failed = true;
        console.log(`  ✗ erro na página: ${message}`);
    }
    await page.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
