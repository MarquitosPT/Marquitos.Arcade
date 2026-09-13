// Desenho da corrida: mundo, pista, carros, HUD, minimapa e overlays.
//
// O mundo é desenhado em coordenadas de pista e a câmara é uma transformação do
// contexto (centrar, escalar, trasladar) — assim nenhuma função de desenho
// precisa de saber onde está a câmara. O HUD vem depois, já fora dessa
// transformação, por isso fica em coordenadas de ecrã.

import { clamp } from '/lib/arcade/math.js';
import { CAR_LEN, CAR_W, LAPS_REQUIRED, MAX_SPEED } from './config.js';
import { THEME_COLORS } from './tracks.js';
import { drawConfetti, drawParticles, hasConfetti } from './particles.js';
import { buttonRects, keys, touchState } from './input.js';
import { fmtTime, ordinal } from './format.js';
import { race } from './state.js';

/**
 * O contexto 2D do canvas. É o mesmo objeto durante toda a vida da página (um
 * redimensionamento muda o tamanho do buffer, não o contexto), por isso guarda-se
 * uma vez em vez de o reler a cada chamada de desenho.
 */
let ctx = null;

export function initRenderer(viewport) {
    ctx = viewport.ctx;
}

function rrect(x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    else { ctx.beginPath(); ctx.rect(x, y, w, h); }
}

function drawDecorShape(theme, x, y, size, variant) {
    ctx.save();
    ctx.translate(x, y);
    if (theme === 'grass') {
        ctx.fillStyle = variant > 0.5 ? '#1c5a26' : '#123a1c';
        ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    } else {
        if (variant > 0.6) {
            ctx.fillStyle = '#3a7d3f';
            ctx.fillRect(-2, -size, 4, size);
            ctx.fillRect(-size * 0.4, -size * 0.6, size * 0.4, 4);
            ctx.fillRect(0, -size * 0.4, size * 0.4, 4);
        } else {
            ctx.fillStyle = '#6b5333';
            ctx.beginPath(); ctx.ellipse(0, 0, size * 0.7, size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
}

export function drawBackground() {
    const colors = THEME_COLORS[race.track.theme];
    if (race.track.theme === 'night') {
        const grad = ctx.createLinearGradient(0, 0, 0, race.view.height);
        grad.addColorStop(0, '#1a0b2e');
        grad.addColorStop(0.55, '#3a123f');
        grad.addColorStop(1, '#0a0820');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, race.view.width, race.view.height);
    } else {
        ctx.fillStyle = colors.terrain;
        ctx.fillRect(0, 0, race.view.width, race.view.height);
    }
}

function drawWorld() {
    const colors = THEME_COLORS[race.track.theme];
    ctx.save();
    ctx.fillStyle = colors.terrain;
    ctx.fillRect(race.track.bbox.minX - 500, race.track.bbox.minY - 500, race.track.bbox.w + 1000, race.track.bbox.h + 1000);

    if (race.track.theme === 'night') {
        const pulse = 0.5 + 0.5 * Math.sin(race.globalClock * 1.4);
        ctx.save();
        const sunX = race.track.cx, sunY = race.track.bbox.minY - 260;
        const g = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 220 + pulse * 20);
        g.addColorStop(0, 'rgba(255,150,90,0.9)');
        g.addColorStop(1, 'rgba(255,60,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sunX, sunY, 220 + pulse * 20, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255,45,170,0.18)';
        ctx.lineWidth = 2;
        const spacing = 90;
        for (let x = race.track.bbox.minX - 700; x < race.track.bbox.maxX + 700; x += spacing) {
            ctx.beginPath(); ctx.moveTo(x, race.track.bbox.minY - 700); ctx.lineTo(x, race.track.bbox.maxY + 700); ctx.stroke();
        }
        for (let y = race.track.bbox.minY - 700; y < race.track.bbox.maxY + 700; y += spacing) {
            ctx.beginPath(); ctx.moveTo(race.track.bbox.minX - 700, y); ctx.lineTo(race.track.bbox.maxX + 700, y); ctx.stroke();
        }
    } else {
        for (const d of race.track.decor) drawDecorShape(race.track.theme, d.x, d.y, d.size, d.variant);
    }

    drawTrack();
    drawParticles();
    drawCars();
    ctx.restore();
}

export function drawWorldWithCamera() {
    ctx.save();
    ctx.translate(race.view.width / 2 + race.shake.x, race.view.height / 2 + race.shake.y);
    ctx.scale(race.zoom, race.zoom);
    ctx.translate(-race.camera.x, -race.camera.y);
    drawWorld();
    ctx.restore();
}

function drawTrack() {
    const colors = THEME_COLORS[race.track.theme];
    ctx.beginPath();
    for (let i = 0; i <= race.track.N; i++) {
        const idx = i % race.track.N; const p = race.track.pts[idx], n = race.track.norm[idx];
        const ox = p.x + n.x * race.track.halfWidth, oy = p.y + n.y * race.track.halfWidth;
        if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    }
    for (let i = race.track.N; i >= 0; i--) {
        const idx = i % race.track.N; const p = race.track.pts[idx], n = race.track.norm[idx];
        ctx.lineTo(p.x - n.x * race.track.halfWidth, p.y - n.y * race.track.halfWidth);
    }
    ctx.closePath();
    ctx.fillStyle = colors.asphalt;
    ctx.fill();
    if (race.track.theme === 'night') {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,229,255,0.5)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i <= race.track.N; i++) { const idx = i % race.track.N; const p = race.track.pts[idx], n = race.track.norm[idx]; const x = p.x + n.x * race.track.halfWidth, y = p.y + n.y * race.track.halfWidth; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,47,160,0.5)';
        ctx.beginPath();
        for (let i = 0; i <= race.track.N; i++) { const idx = i % race.track.N; const p = race.track.pts[idx], n = race.track.norm[idx]; const x = p.x - n.x * race.track.halfWidth, y = p.y - n.y * race.track.halfWidth; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.restore();
    } else {
        for (let i = 0; i < race.track.N; i += 6) {
            const color = (Math.floor(i / 6) % 2 === 0) ? '#e6e6e6' : '#d81e1e';
            const p = race.track.pts[i], n = race.track.norm[i], tg = race.track.tang[i];
            const ang = Math.atan2(tg.y, tg.x);
            for (const side of [1, -1]) {
                ctx.save();
                ctx.translate(p.x + n.x * race.track.halfWidth * side, p.y + n.y * race.track.halfWidth * side);
                ctx.rotate(ang);
                ctx.fillStyle = color;
                ctx.fillRect(-5, -6, 10, 12);
                ctx.restore();
            }
        }
    }

    ctx.setLineDash([14, 14]);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= race.track.N; i++) { const idx = i % race.track.N; const p = race.track.pts[idx]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    ctx.setLineDash([]);

    const p0 = race.track.pts[0], n0 = race.track.norm[0], tg0 = race.track.tang[0];
    const ang0 = Math.atan2(tg0.y, tg0.x);
    const steps = 10;
    for (let s = 0; s < steps; s++) {
        const t = (s / steps - 0.5) * 2 * race.track.halfWidth;
        ctx.save();
        ctx.translate(p0.x + n0.x * t, p0.y + n0.y * t);
        ctx.rotate(ang0);
        ctx.fillStyle = s % 2 === 0 ? '#111' : '#eee';
        ctx.fillRect(-6, -((race.track.halfWidth * 2) / steps) / 2, 12, (race.track.halfWidth * 2) / steps);
        ctx.restore();
    }

    for (const padIdx of race.track.pads) {
        const p = race.track.pts[padIdx];
        const pulse = 1 + 0.15 * Math.sin(race.globalClock * 5 + padIdx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,230,80,0.85)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffe650'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffe650';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 1);
        ctx.restore();
    }
}

function drawCars() {
    const sorted = [...race.cars].sort((a, b) => a.y - b.y);
    for (const car of sorted) {
        ctx.save();
        ctx.translate(car.x, car.y);
        const speedFrac = clamp(car.speed / MAX_SPEED, 0, 1.4);
        const lean = clamp(car.steerInput * Math.min(1, speedFrac) * 0.12, -0.14, 0.14);
        ctx.rotate(car.velAngle);

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(3, 5, CAR_LEN * 0.55, CAR_W * 0.55, 0, 0, Math.PI * 2); ctx.fill();

        ctx.transform(1, 0, lean, 1, 0, 0);
        ctx.fillStyle = car.color;
        rrect(-CAR_LEN / 2, -CAR_W / 2, CAR_LEN, CAR_W, 6);
        ctx.fill();

        ctx.fillStyle = 'rgba(8,8,16,0.85)';
        rrect(-CAR_LEN * 0.06, -CAR_W * 0.32, CAR_LEN * 0.4, CAR_W * 0.64, 4);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(CAR_LEN * 0.38, -CAR_W * 0.28, 3, CAR_W * 0.2);
        ctx.fillRect(CAR_LEN * 0.38, CAR_W * 0.08, 3, CAR_W * 0.2);

        if (car.boostHold && car.boost > 0) {
            ctx.fillStyle = 'rgba(255,120,20,0.9)';
            ctx.beginPath();
            ctx.moveTo(-CAR_LEN / 2, -4); ctx.lineTo(-CAR_LEN / 2 - 14 - Math.random() * 6, 0); ctx.lineTo(-CAR_LEN / 2, 4);
            ctx.fill();
        }
        ctx.restore();

        drawNameTag(car);
    }
}

function drawNameTag(car) {
    ctx.save();
    ctx.translate(car.x, car.y - CAR_W - 6);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = car.color;
    ctx.globalAlpha = 0.85;
    ctx.fillText(car.name, 0, 0);
    ctx.restore();
}

export function drawTouchControls() {
    const rects = buttonRects();
    const draw = (r, active, label) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
        ctx.fillStyle = active ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.floor(r.w * 0.32)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
        ctx.restore();
    };
    draw(rects.left, keys.left || touchState.left, '◀');
    draw(rects.right, keys.right || touchState.right, '▶');
    draw(rects.drift, keys.drift || touchState.drift, 'DR');
    draw(rects.boost, keys.boost || touchState.boost, '🔥');
}

export function drawHUD() {
    const ranks = [...race.cars].sort((a, b) => b.totalDistance - a.totalDistance);
    const playerRank = ranks.indexOf(race.player) + 1;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(Math.min(race.view.width, race.view.height) * 0.07)}px monospace`;
    ctx.fillText(ordinal(playerRank), race.view.width / 2, race.view.height * 0.10);
    ctx.font = `bold ${Math.floor(Math.min(race.view.width, race.view.height) * 0.03)}px monospace`;
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`VOLTA ${Math.min(race.player.lap + 1, LAPS_REQUIRED)}/${LAPS_REQUIRED}`, race.view.width / 2, race.view.height * 0.145);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    ctx.fillText(fmtTime(race.clock * 1000), 16, race.view.topInset + 20);
    ctx.restore();

    const bw = Math.min(220, race.view.width * 0.5), bh = 14;
    const bx = race.view.width / 2 - bw / 2, by = race.view.height - Math.max(18, race.view.height * 0.03) - Math.min(84, race.view.width * 0.16) - 26;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    rrect(bx, by, bw, bh, 6); ctx.stroke();
    const full = race.player.boost >= 99.5;
    const pulse = full ? 0.75 + 0.25 * Math.sin(race.globalClock * 10) : 1;
    ctx.fillStyle = full ? `rgba(0,229,255,${pulse})` : race.player.boost > 55 ? '#ffcf3f' : '#7cff2f';
    rrect(bx + 2, by + 2, Math.max(0, (bw - 4) * (race.player.boost / 100)), bh - 4, 4); ctx.fill();
    ctx.restore();

    drawMinimap();
}

function drawMinimap() {
    const mw = 108, mh = 78;
    const mx = race.view.width - mw - 14, my = race.view.topInset + 10;
    const sx = (mw - 10) / race.track.bbox.w, sy = (mh - 10) / race.track.bbox.h;
    const s = Math.min(sx, sy);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rrect(mx, my, mw, mh, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= race.track.N; i += 4) {
        const idx = i % race.track.N; const p = race.track.pts[idx];
        const px = mx + 5 + (p.x - race.track.bbox.minX) * s, py = my + 5 + (p.y - race.track.bbox.minY) * s;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (const car of race.cars) {
        const px = mx + 5 + (car.x - race.track.bbox.minX) * s, py = my + 5 + (car.y - race.track.bbox.minY) * s;
        const r = car === race.player ? 3.5 + Math.sin(race.globalClock * 6) * 0.8 : 2.6;
        ctx.fillStyle = car.color;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

export function drawCountdown() {
    drawBackground();
    drawWorldWithCamera();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = race.countdownValue > 0 ? String(race.countdownValue) : 'GO!';
    const pop = 1 + 0.35 * Math.max(0, 1 - race.countdownTimer % 1);
    ctx.font = `bold ${Math.floor(Math.min(race.view.width, race.view.height) * 0.22 * pop)}px monospace`;
    ctx.fillStyle = race.countdownValue > 0 ? '#ffcf3f' : '#00e5ff';
    ctx.shadowColor = race.countdownValue > 0 ? '#ff2fa0' : '#00e5ff';
    ctx.shadowBlur = 30;
    ctx.fillText(label, race.view.width / 2, race.view.height / 2);
    ctx.restore();
    drawHUD();
}

export function drawFinishOverlay() {
    drawBackground();
    drawWorldWithCamera();
    drawHUD();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pulse = 1 + 0.08 * Math.sin(race.globalClock * 10);
    ctx.font = `bold ${Math.floor(Math.min(race.view.width, race.view.height) * 0.1 * pulse)}px monospace`;
    ctx.fillStyle = '#ffcf3f';
    ctx.shadowColor = '#ff2fa0'; ctx.shadowBlur = 24;
    ctx.fillText('🏁 CHEGASTE!', race.view.width / 2, race.view.height * 0.4);
    ctx.restore();
}

export function render() {
    drawBackground();
    drawWorldWithCamera();

    if (race.phase === 'racing') { drawHUD(); drawTouchControls(); }
    if (hasConfetti()) drawConfetti();
}
