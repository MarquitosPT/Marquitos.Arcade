// Colisões de uma caixa com os tiles do mundo e com as plataformas que andam.
//
// Um eixo de cada vez, primeiro o horizontal e depois o vertical: é a forma
// mais simples de um corpo deslizar ao longo de uma parede em vez de ficar
// preso nela. A caixa tem o canto de cima à esquerda em (x, y) e mede w × h,
// tudo em tiles.
//
// As plataformas de passar por baixo (e as bolachas) só seguram quem lhes cai
// em cima vindo de cima — o que conta é onde estavam os pés antes do passo.
// Quem chama tem de dar passos pequenos (ver `SUBSTEP` em level.js): a mola
// atira a 26 tiles por segundo, e um passo grande atravessava um tile inteiro.

import { T, isOneWayTile, isSolidTile, tileAt } from './world.js';

const EPS = 1e-4;
/** Quanto se sobe sem saltar para cima de uma plataforma que anda. */
const STEP_ONTO = 0.3;

/**
 * Move a caixa um passo e resolve as colisões.
 *
 * Escreve no corpo: `x`, `y`, `vx`, `vy`, `onGround`, `ride` (a plataforma
 * onde está em pé, ou null), `groundTile` ({ c, r, t } do tile onde assentou)
 * e `hitWall` (-1, 0 ou 1).
 */
export function moveBody(body, world, dt, movers = []) {
    body.hitWall = 0;

    // ---------- Horizontal ----------
    body.x += body.vx * dt;
    const top = Math.floor(body.y + EPS);
    const bottom = Math.floor(body.y + body.h - EPS);
    if (body.vx > 0) {
        const c = Math.floor(body.x + body.w - EPS);
        for (let r = top; r <= bottom; r++) {
            if (isSolidTile(tileAt(world, c, r))) {
                body.x = c - body.w;
                body.vx = 0;
                body.hitWall = 1;
                break;
            }
        }
    } else if (body.vx < 0) {
        const c = Math.floor(body.x + EPS);
        for (let r = top; r <= bottom; r++) {
            if (isSolidTile(tileAt(world, c, r))) {
                body.x = c + 1;
                body.vx = 0;
                body.hitWall = -1;
                break;
            }
        }
    }

    // ---------- Vertical ----------
    const prevBottom = body.y + body.h;
    body.y += body.vy * dt;
    body.onGround = false;
    body.groundTile = null;
    const left = Math.floor(body.x + EPS);
    const right = Math.floor(body.x + body.w - EPS);

    if (body.vy >= 0) {
        const r = Math.floor(body.y + body.h);
        for (let c = left; c <= right; c++) {
            const t = tileAt(world, c, r);
            const lands = isSolidTile(t) || (isOneWayTile(t) && prevBottom <= r + 0.02);
            if (lands) {
                body.y = r - body.h;
                body.vy = 0;
                body.onGround = true;
                // Em cima de duas coisas ao mesmo tempo, conta a bolacha: é ela
                // que tem de saber que alguém lhe pôs o pé em cima.
                if (!body.groundTile || t === T.CRUMBLE) body.groundTile = { c, r, t };
            }
        }
    } else {
        const r = Math.floor(body.y + EPS);
        for (let c = left; c <= right; c++) {
            if (isSolidTile(tileAt(world, c, r))) {
                body.y = r + 1;
                body.vy = 0;
                break;
            }
        }
    }

    // ---------- Plataformas que andam ----------
    body.ride = null;
    if (body.vy >= 0 && !body.onGround) {
        const bottomNow = body.y + body.h;
        for (const m of movers) {
            if (body.x + body.w <= m.x + 0.05 || body.x >= m.x + m.w - 0.05) continue;
            // `m.dy` conta: uma plataforma a subir vem ao encontro dos pés. E um
            // degrauzinho (`STEP_ONTO`) sobe-se sem saltar: quem entra num
            // elevador que já arrancou não cai pelo buraco ao lado.
            if (prevBottom <= m.y - Math.min(0, m.dy) + STEP_ONTO && bottomNow >= m.y - 0.001) {
                body.y = m.y - body.h;
                body.vy = 0;
                body.onGround = true;
                body.ride = m;
                break;
            }
        }
    }
}

/** True se as duas caixas se sobrepõem. */
export const overlaps = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** True se a caixa toca num tile de picos (só a metade de baixo do tile pica). */
export function touchesSpikes(body, world) {
    const left = Math.floor(body.x + 0.1);
    const right = Math.floor(body.x + body.w - 0.1);
    const top = Math.floor(body.y);
    const bottom = Math.floor(body.y + body.h - EPS);
    for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
            if (tileAt(world, c, r) === T.SPIKES && body.y + body.h > r + 0.45) return true;
        }
    }
    return false;
}
