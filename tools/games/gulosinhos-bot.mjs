#!/usr/bin/env node
/**
 * Piloto automático dos Gulosinhos: joga cada nível do princípio ao fim com a
 * física do próprio jogo e diz quanto tempo levou, quantas guloseimas apanhou
 * pelo caminho e onde levou pancada ou caiu.
 *
 * Serve para afinar níveis. O piloto é simples de propósito — corre sempre
 * para a direita, salta buracos, paredes, guardiões e picos, espera pelas
 * plantas, pelas abelhas e pelas plataformas, e foge das bombas — e não se
 * desvia para ir buscar guloseimas. O tempo dele é o de quem só corre: quem
 * joga com calma e vai às guloseimas leva uns 30 a 60 segundos mais. Um nível
 * em que ele cai sempre no mesmo sítio vale uma espreitadela; às vezes é ele
 * que é desajeitado (pilares, sobretudo), às vezes é o percurso.
 *
 * Não é um teste: os cenários `gulosinhos-*` do smoke-test é que verificam as
 * regras. Isto corre à mão.
 *
 * Uso:
 *   node tools/games/gulosinhos-bot.mjs           # os doze níveis
 *   node tools/games/gulosinhos-bot.mjs 3,7       # só alguns
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WWWROOT = resolve(HERE, '../../src/MarquitosArcade/wwwroot');
const preinstalled = process.env.ARCADE_CHROMIUM || '/opt/pw-browsers/chromium';

const server = await startStaticServer(WWWROOT);
const base = server.url || `http://127.0.0.1:${server.port}`;
const browser = await chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
const page = await (await browser.newContext({ viewport: { width: 900, height: 450 } })).newPage();
page.on('pageerror', (err) => console.log(`erro de JavaScript: ${err.message}`));
await page.goto(`${base}/games/gulosinhos/`, { waitUntil: 'load' });
await page.waitForSelector('#arcadeSplash', { state: 'hidden', timeout: 20000 });

const ids = (process.argv[2] || '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number);
for (const id of ids) {
  const r = await page.evaluate(async (id) => {
    const G = '/games/gulosinhos/js/';
    const L = await import(G + 'level.js'); const S = await import(G + 'state.js'); const W = await import(G + 'world.js');
    const { input, releaseAll } = await import(G + 'input.js'); const C = await import(G + 'config.js');
    L.startLevel(id); S.game.phase = 'playing';
    const game = S.game, w = game.world;
    const surf = (c, fromY) => { for (let r = Math.max(0, Math.floor(fromY - 0.05)); r < w.rows; r++) { const t = W.tileAt(w, c, r); if (t === W.T.SPIKES) return Infinity; if (W.isSolidTile(t) || W.isOneWayTile(t)) return r; } return Infinity; };
    let jumpHold = 0, mode = null, log = [], stuck = 0, lastX = 0, lastCheck = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 400; t += dt) {
      const p = game.player; const cx = p.x + p.w / 2, feet = p.y + p.h;
      let right = true, left = false, jump = false;
      if (p.onGround) {
        const aheadC = Math.floor(p.x + p.w + 0.35);
        // wall
        let wall = false; for (let r = Math.floor(p.y); r <= Math.floor(feet - 0.01); r++) if (W.isSolidTile(W.tileAt(w, aheadC, r))) wall = true;
        const crateWall = wall && W.tileAt(w, aheadC, Math.floor(feet - 0.5)) === W.T.CRATE;
        const nextC = Math.floor(cx + 0.9);
        const pit = surf(nextC, feet) > feet + 3;
        // mover in pit ahead?
        const mv = w.movers.find((m) => (m.axis === 'x' ? (m.from <= nextC + 1 && m.to + m.w >= nextC) : (m.x <= nextC + 0.5 && m.x + m.w >= nextC)) && Math.abs((m.axis === 'x' ? m.from : m.x) - cx) < 3.5);
        if (p.ride) {
          const m = p.ride;
          const atEnd = m.axis === 'x' ? Math.abs(m.x - m.to) < 0.02 : Math.abs(m.y - m.to) < 0.02;
          right = atEnd; jump = atEnd && m.axis === 'x';
          if (!atEnd && m.axis === 'x' && cx > m.x + m.w - 0.6) { right = false; left = true; }
          if (!atEnd && cx < m.x + 0.6) { right = true; }
          else if (!atEnd) right = false;
        } else if (pit && mv) {
          const ready = mv.axis === 'x' ? Math.abs(mv.x - mv.from) < 0.02 && L.moverProgress(mv, mv.phase + 0.5) < 0.01 : Math.abs(mv.y - mv.from) < 0.05 && L.moverProgress(mv, mv.phase + 0.4) < 0.01;
          right = ready;
        } else if (pit || (wall && !crateWall)) jump = true;
        for (const g of w.guards) {
          if (!g.alive) continue; const d = g.x - cx;
          if (g.type !== 'bee' && d > 0 && d < 2.0 && Math.abs(g.y - feet) < 0.6) jump = true;
          if (g.type === 'bee' && d > -0.6 && d < 2.6) { if (g.y + 0.35 > feet - 1.5) { right = false; if (d < 1.0) left = true; } }
        }
        for (const s of w.springs) {}
        if (W.tileAt(w, Math.floor(cx + 1.0), Math.floor(feet - 0.5)) === W.T.SPIKES || W.tileAt(w, Math.floor(cx + 0.6), Math.floor(feet - 0.5)) === W.T.SPIKES) jump = true;
        for (const pl of w.plants) {
          const d = pl.x - cx;
          if (d > 0.2 && d < 1.7) {
            const soon = [0, 0.15, 0.3, 0.45].some((k) => L.plantExtension(pl, game.levelClock + k) > 0.05);
            if (soon) { right = false; jump = false; if (d < 1.0) left = true; }
          }
        }
        if (crateWall) right = true;
      } else if (p.vy > 0) {
        // No ar, a descer: por cima de chão com buraco à frente, trava.
        const below = surf(Math.floor(cx), feet);
        const ahead = surf(Math.floor(cx + 0.8), feet);
        if (below < feet + 2 && ahead > feet + 3) { right = false; left = cx - Math.floor(cx) > 0.6; }
      }
      for (const b of w.bombs) {
        if (b.state !== 'armed') continue; const d = Math.hypot(b.x - cx, b.y - 0.4 - (p.y + p.h / 2));
        if (d < C.BOMB_RADIUS + 0.5 && b.timer < 1.2) { right = false; left = true; jump = false; }
        else if (d < C.BOMB_RADIUS + 0.6 && b.x > cx && W.tileAt(w, Math.floor(b.x) + 1, Math.floor(b.y - 0.5)) === W.T.CRATE) { right = false; }
      }
      if (jump && p.onGround) { input.jumpPressed = true; jumpHold = 0.3; }
      input.jump = jumpHold > 0; jumpHold -= dt;
      input.right = right; input.left = left;
      if (game.phase === 'falling') { game.elapsed += dt; game.holdTimer -= dt; if (game.holdTimer <= 0) { log.push('fell@' + Math.round(cx)); L.respawn(); } continue; }
      const h0 = game.hearts;
      L.updateLevel(dt);
      if (game.hearts < h0) { const seg = [...w.segments].reverse().find((sg) => sg.x <= cx); log.push(`hit@${Math.round(cx)}:${seg?.name}`); }
      if (game.phase !== 'playing' && game.phase !== 'falling') break;
      if (t - lastCheck > 6) { if (p.x - lastX < 1) { log.push('stuck@' + Math.round(p.x)); break; } lastX = p.x; lastCheck = t; }
    }
    releaseAll();
    const res = { phase: game.phase, cleared: game.result?.cleared, t: game.elapsed.toFixed(1), par: w.par, est: w.estimate.toFixed(0), cand: `${game.candies}/${w.candies.length}`, hearts: game.hearts, x: game.player.x.toFixed(0), log: log.slice(0, 10).join(' ') };
    L.abortLevel();
    return res;
  }, id);
  const head = r.cleared ? `chegou ao fim em ${r.t} s` : r.phase === 'playing' ? `encravou na coluna ${r.x}` : `ficou sem corações na coluna ${r.x}`;
  console.log(`nível ${id}: ${head} · tempo-alvo ${r.par} s · conta do gerador ${r.est} s · guloseimas ${r.cand} · corações ${r.hearts}${r.log ? `\n  ${r.log}` : ''}`);
}

await browser.close();
server.close?.();
process.exit(0);
