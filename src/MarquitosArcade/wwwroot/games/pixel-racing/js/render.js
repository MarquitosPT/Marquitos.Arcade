// Desenho da corrida: mundo, pista, carros, HUD, minimapa e overlays.
//
// O mundo é desenhado em coordenadas de pista e a câmara é uma transformação do
// contexto (centrar, escalar, trasladar) — assim nenhuma função de desenho
// precisa de saber onde está a câmara. O HUD vem depois, já fora dessa
// transformação, por isso fica em coordenadas de ecrã.

import { clamp } from '/lib/arcade/math.js';
import { CAR_LEN, CAR_W, FONT_DISPLAY, LAPS_REQUIRED, MAX_SPEED } from './config.js';
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

/**
 * Painel de vidro do HUD.
 *
 * O canvas não tem `backdrop-filter`: não há como desfocar a pista por trás de um
 * retângulo desenhado. O vidro é imitado à mão com o que se vê nos painéis de
 * HTML — fundo translúcido escuro, contorno claro de 1px e um risco de luz no
 * topo. Fica parecido o suficiente para o HUD e o menu serem o mesmo material.
 */
function glassPanel(x, y, w, h, r, { alpha = 0.44 } = {}) {
    ctx.save();
    rrect(x, y, w, h, r);
    ctx.fillStyle = `rgba(10, 14, 28, ${alpha})`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r, y + 0.5);
    ctx.lineTo(x + w - r, y + 0.5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.stroke();
    ctx.restore();
}

/** Etiqueta pequena e espaçada, como as `.fieldLabel` do menu. */
function smallLabel(text, x, y, color = 'rgba(238, 242, 255, 0.55)') {
    ctx.save();
    ctx.font = `600 9px ${FONT_DISPLAY}`;
    ctx.letterSpacing = '1.4px'; // ignorado onde não houver suporte, sem estragar nada
    ctx.fillStyle = color;
    ctx.fillText(text.toUpperCase(), x, y);
    ctx.restore();
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
    drawVignette();
}

/**
 * Escurecimento suave nos cantos do ecrã. É pintado em coordenadas de ecrã (já
 * fora da câmara) e dá profundidade ao mundo, que de outra forma é uma mancha
 * plana de cor; ao mesmo tempo assenta o HUD e o vidro dos menus por cima dele.
 */
function drawVignette() {
    const { width, height } = race.view;
    const grad = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.32,
        width / 2, height / 2, Math.max(width, height) * 0.75
    );
    grad.addColorStop(0, 'rgba(4, 6, 14, 0)');
    grad.addColorStop(1, 'rgba(4, 6, 14, 0.55)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
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
    ctx.save();
    // A pista fica assente no terreno em vez de pintada por cima dele.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = colors.asphalt;
    ctx.fill();
    ctx.restore();
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
    ctx.translate(car.x, car.y - CAR_W - 8);
    ctx.font = `600 11px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    // Contorno escuro por baixo: o nome tem de se ler tanto no asfalto como na relva.
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.65)';
    ctx.strokeText(car.name, 0, 0);
    ctx.fillStyle = car.color;
    ctx.fillText(car.name, 0, 0);
    ctx.restore();
}

export function drawTouchControls() {
    const rects = buttonRects();
    const draw = (r, active, label, scale) => {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
        ctx.fillStyle = active ? 'rgba(53, 224, 255, 0.32)' : 'rgba(10, 14, 28, 0.42)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = active ? 'rgba(53, 224, 255, 0.9)' : 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();
        if (active) {
            ctx.shadowColor = 'rgba(53, 224, 255, 0.6)';
            ctx.shadowBlur = 18;
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = active ? '#fff' : 'rgba(238, 242, 255, 0.8)';
        ctx.font = `700 ${Math.floor(r.w * scale)}px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy + 1);
        ctx.restore();
    };
    draw(rects.left, keys.left || touchState.left, '◀', 0.3);
    draw(rects.right, keys.right || touchState.right, '▶', 0.3);
    draw(rects.drift, keys.drift || touchState.drift, 'DRIFT', 0.19);
    draw(rects.boost, keys.boost || touchState.boost, 'BOOST', 0.19);
}

/** Telemóvel ao alto: o painel do centro e o minimapa não cabem no tamanho normal. */
const isCompact = () => race.view.width < 520;

export function drawHUD() {
    const ranks = [...race.cars].sort((a, b) => b.totalDistance - a.totalDistance);
    const playerRank = ranks.indexOf(race.player) + 1;
    const top = race.view.topInset;

    drawPositionPanel(playerRank, top);
    drawTimePanel(top);
    drawBoostBar();
    drawMinimap(top);
}

/** Posição e volta, ao centro em cima — o que se lê de relance a conduzir. */
function drawPositionPanel(playerRank, top) {
    const w = isCompact() ? 120 : 140, h = 52, r = 18;
    const x = race.view.width / 2 - w / 2, y = top;
    glassPanel(x, y, w, h, r);

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `800 25px ${FONT_DISPLAY}`;
    ctx.fillText(ordinal(playerRank), x + w * 0.28, y + h / 2 + 1);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.54, y + 12);
    ctx.lineTo(x + w * 0.54, y + h - 12);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    smallLabel('Volta', x + w * 0.64, y + 22);
    ctx.fillStyle = '#35e0ff';
    ctx.font = `700 16px ${FONT_DISPLAY}`;
    ctx.fillText(`${Math.min(race.player.lap + 1, LAPS_REQUIRED)}/${LAPS_REQUIRED}`, x + w * 0.64, y + 40);
    ctx.restore();
}

function drawTimePanel(top) {
    const w = 92, h = 34;
    const x = 16, y = top;
    glassPanel(x, y, w, h, 12);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.92)';
    ctx.font = `600 15px ${FONT_DISPLAY}`;
    ctx.fillText(fmtTime(race.clock * 1000), x + w / 2, y + h / 2 + 1);
    ctx.restore();
}

/** Barra do boost, logo acima dos botões táteis. */
function drawBoostBar() {
    const w = Math.min(240, race.view.width * 0.55), h = 16;
    const x = race.view.width / 2 - w / 2;
    const y = race.view.height - Math.max(18, race.view.height * 0.03) - Math.min(84, race.view.width * 0.16) - 30;

    glassPanel(x, y, w, h, h / 2, { alpha: 0.5 });

    const full = race.player.boost >= 99.5;
    const fill = Math.max(0, (w - 6) * (race.player.boost / 100));
    if (fill > 2) {
        ctx.save();
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, '#35e0ff');
        grad.addColorStop(1, '#8b7cff');
        ctx.fillStyle = grad;
        if (full) {
            // Cheio: pulsa, para se notar que há boost para gastar sem se olhar para a barra.
            ctx.globalAlpha = 0.75 + 0.25 * Math.sin(race.globalClock * 8);
            ctx.shadowColor = 'rgba(53, 224, 255, 0.8)';
            ctx.shadowBlur = 16;
        }
        rrect(x + 3, y + 3, fill, h - 6, (h - 6) / 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawMinimap(top) {
    const mw = isCompact() ? 92 : 116, mh = isCompact() ? 66 : 82;
    const mx = race.view.width - mw - 14, my = top;
    const s = Math.min((mw - 18) / race.track.bbox.w, (mh - 18) / race.track.bbox.h);
    const ox = mx + (mw - race.track.bbox.w * s) / 2 - race.track.bbox.minX * s;
    const oy = my + (mh - race.track.bbox.h * s) / 2 - race.track.bbox.minY * s;

    glassPanel(mx, my, mw, mh, 16);

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= race.track.N; i += 4) {
        const p = race.track.pts[i % race.track.N];
        const px = ox + p.x * s, py = oy + p.y * s;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = race.track.halfWidth * 2 * s;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(53, 224, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (const car of race.cars) {
        const px = ox + car.x * s, py = oy + car.y * s;
        const isPlayer = car === race.player;
        ctx.fillStyle = car.color;
        if (isPlayer) {
            ctx.shadowColor = car.color;
            ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(px, py, isPlayer ? 3.6 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

export function drawCountdown() {
    drawBackground();
    drawWorldWithCamera();

    // Acima do centro: no centro fica o carro do jogador, e a grelha de partida
    // é a única coisa que há para ver enquanto a contagem corre.
    const cx = race.view.width / 2, cy = race.view.height * 0.42;
    const go = race.countdownValue === 0;
    const color = go ? '#35e0ff' : '#ffffff';
    // O anel fecha-se ao longo do segundo: a contagem vê-se sem se ler o número.
    const sweep = Math.PI * 2 * (1 - (race.countdownTimer % 1));
    const radius = Math.min(race.view.width, race.view.height) * 0.15;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 14, 28, 0.3)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + sweep);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.stroke();

    const pop = 1 + 0.22 * Math.max(0, 1 - (race.countdownTimer % 1) * 3);
    ctx.font = `800 ${Math.floor(radius * (go ? 0.62 : 0.95) * pop)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = color;
    ctx.fillText(go ? 'GO!' : String(race.countdownValue), cx, cy + 2);
    ctx.restore();

    drawHUD();
}

export function drawFinishOverlay() {
    drawBackground();
    drawWorldWithCamera();
    drawHUD();

    const text = 'Chegaste!';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.floor(Math.min(race.view.width, race.view.height) * 0.075)}px ${FONT_DISPLAY}`;
    const w = ctx.measureText(text).width + 90;
    const h = Math.min(race.view.width, race.view.height) * 0.14;
    const x = race.view.width / 2 - w / 2, y = race.view.height * 0.4 - h / 2;
    glassPanel(x, y, w, h, h / 2, { alpha: 0.55 });
    ctx.fillStyle = '#fff';
    ctx.fillText(`🏁 ${text}`, race.view.width / 2, race.view.height * 0.4 + 1);
    ctx.restore();
}

export function render() {
    drawBackground();
    drawWorldWithCamera();

    if (race.phase === 'racing') { drawHUD(); drawTouchControls(); }
    if (hasConfetti()) drawConfetti();
}
