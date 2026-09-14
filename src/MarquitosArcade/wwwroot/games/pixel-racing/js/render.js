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
        drawCar(car);
        drawNameTag(car);
    }
}

/**
 * Silhueta do carro vista de cima: bico afilado, ombros largos e traseira
 * quadrada. Tudo em frações de `CAR_LEN`/`CAR_W`, por isso mudar o tamanho do
 * carro no config não obriga a redesenhar nada aqui.
 */
function carBodyPath(L, W) {
    const hw = W / 2;
    ctx.beginPath();
    ctx.moveTo(L * 0.50, -hw * 0.3);
    ctx.quadraticCurveTo(L * 0.52, 0, L * 0.50, hw * 0.3);
    ctx.lineTo(L * 0.44, hw * 0.36);
    ctx.quadraticCurveTo(L * 0.30, hw * 0.5, L * 0.22, hw * 0.86);
    ctx.lineTo(L * 0.1, hw);
    ctx.lineTo(-L * 0.26, hw);
    ctx.quadraticCurveTo(-L * 0.45, hw * 0.94, -L * 0.47, hw * 0.72);
    ctx.lineTo(-L * 0.47, -hw * 0.72);
    ctx.quadraticCurveTo(-L * 0.45, -hw * 0.94, -L * 0.26, -hw);
    ctx.lineTo(L * 0.1, -hw);
    ctx.lineTo(L * 0.22, -hw * 0.86);
    ctx.quadraticCurveTo(L * 0.30, -hw * 0.5, L * 0.44, -hw * 0.36);
    ctx.closePath();
}

function drawWheel(x, y, L, W, steer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(steer);
    ctx.fillStyle = '#14161f';
    rrect(-L * 0.12, -W * 0.11, L * 0.24, W * 0.22, W * 0.07);
    ctx.fill();
    // Risco claro no topo do pneu: sem ele a roda desaparece contra o asfalto.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    rrect(-L * 0.09, -W * 0.09, L * 0.18, W * 0.06, W * 0.03);
    ctx.fill();
    ctx.restore();
}

function drawCar(car) {
    const L = CAR_LEN, W = CAR_W, hw = W / 2;
    const speedFrac = clamp(car.speed / MAX_SPEED, 0, 1.4);
    const lean = clamp(car.steerInput * Math.min(1, speedFrac) * 0.1, -0.12, 0.12);
    const steer = car.steerInput * 0.38;

    ctx.save();
    ctx.translate(car.x, car.y);

    // O carro aponta para onde está virado (`facing`), não para onde anda
    // (`velAngle`): é essa diferença que faz a derrapagem ver-se de fora.
    ctx.rotate(car.facing);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(-1, 4, L * 0.52, W * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    drawWheel(L * 0.28, -hw * 1.02, L, W, steer);
    drawWheel(L * 0.28, hw * 1.02, L, W, steer);
    drawWheel(-L * 0.28, -hw * 1.02, L, W, 0);
    drawWheel(-L * 0.28, hw * 1.02, L, W, 0);

    // Asa dianteira, por baixo do corpo para só assomarem as pontas.
    ctx.fillStyle = '#1b1f2b';
    rrect(L * 0.44, -hw * 0.86, L * 0.07, W * 0.86, 2);
    ctx.fill();

    ctx.transform(1, 0, lean, 1, 0, 0);

    carBodyPath(L, W);
    ctx.fillStyle = car.color;
    ctx.fill();

    // Volume: luz vinda de cima-esquerda do ecrã, sombra do lado oposto. Feito
    // com branco e preto por cima da cor, em vez de aclarar/escurecer o hex —
    // assim funciona com qualquer cor que o jogador escolha.
    ctx.save();
    ctx.clip();
    const shade = ctx.createLinearGradient(0, -hw, 0, hw);
    shade.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    shade.addColorStop(0.42, 'rgba(255, 255, 255, 0.04)');
    shade.addColorStop(0.62, 'rgba(0, 0, 0, 0.08)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = shade;
    ctx.fillRect(-L, -hw, L * 2, W);

    // Riscas do capô, do bico até à traseira.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(-L * 0.2, -W * 0.09, L * 0.62, W * 0.05);
    ctx.fillRect(-L * 0.2, W * 0.04, L * 0.62, W * 0.05);
    ctx.restore();

    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.55)';
    carBodyPath(L, W);
    ctx.stroke();

    // Habitáculo e capacete do piloto.
    ctx.fillStyle = 'rgba(10, 13, 24, 0.92)';
    rrect(-L * 0.16, -W * 0.26, L * 0.34, W * 0.52, W * 0.16);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    rrect(-L * 0.13, -W * 0.21, L * 0.12, W * 0.42, W * 0.12);
    ctx.fill();
    ctx.fillStyle = 'rgba(236, 242, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(L * 0.01, 0, W * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(12, 16, 28, 0.75)';
    ctx.beginPath();
    ctx.arc(L * 0.04, 0, W * 0.13, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.fill();

    // Espelhos.
    ctx.fillStyle = '#1b1f2b';
    ctx.fillRect(L * 0.16, -hw * 0.92, L * 0.06, W * 0.1);
    ctx.fillRect(L * 0.16, hw * 0.82, L * 0.06, W * 0.1);

    // Faróis à frente; farolins atrás, vermelhos e acesos a travar.
    ctx.fillStyle = 'rgba(255, 249, 224, 0.9)';
    rrect(L * 0.38, -W * 0.26, L * 0.07, W * 0.16, 1.5);
    ctx.fill();
    rrect(L * 0.38, W * 0.1, L * 0.07, W * 0.16, 1.5);
    ctx.fill();

    const braking = car.brakeHeld && car.speed > 0;
    ctx.fillStyle = braking ? '#ff4438' : 'rgba(190, 46, 40, 0.8)';
    if (braking) { ctx.shadowColor = '#ff4438'; ctx.shadowBlur = 10; }
    // À frente do aileron, senão ficavam tapados por ele.
    rrect(-L * 0.38, -W * 0.3, L * 0.05, W * 0.18, 1.5);
    ctx.fill();
    rrect(-L * 0.38, W * 0.12, L * 0.05, W * 0.18, 1.5);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawRearWing(L, W, car.color);

    ctx.restore();

    if (car.boostHold && car.boost > 0) drawBoostFlame(car, L, W);
}

/**
 * Aileron traseiro: dois suportes laterais, um flap e o plano principal, mais
 * largo do que o carro. Vai por cima do corpo (um aileron está acima da
 * carroçaria, e visto de cima tapa a traseira) e leva a mesma sombra e o mesmo
 * gradiente de volume do resto do carro, senão ler-se-ia como um autocolante.
 */
function drawRearWing(L, W, color) {
    const hw = W / 2;
    const span = hw * 1.2;

    ctx.fillStyle = 'rgba(6, 9, 20, 0.35)';
    rrect(-L * 0.58, -span + 3, L * 0.16, span * 2, 2);
    ctx.fill();

    ctx.fillStyle = '#1b1f2b';
    rrect(-L * 0.60, -span, L * 0.24, W * 0.1, 2);
    ctx.fill();
    rrect(-L * 0.60, span - W * 0.1, L * 0.24, W * 0.1, 2);
    ctx.fill();
    rrect(-L * 0.43, -span * 0.84, L * 0.055, span * 1.68, 1.5);
    ctx.fill();

    rrect(-L * 0.58, -span, L * 0.13, span * 2, 2);
    ctx.fillStyle = color;
    ctx.fill();
    const shade = ctx.createLinearGradient(0, -span, 0, span);
    shade.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    shade.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.6)';
    ctx.stroke();
}

/** Chama do boost: sai pelo escape, na direção contrária ao andamento. */
function drawBoostFlame(car, L, W) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.velAngle);
    const len = L * 0.5 + Math.random() * L * 0.3;
    const flame = ctx.createLinearGradient(-L * 0.45, 0, -L * 0.45 - len, 0);
    flame.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
    flame.addColorStop(0.4, 'rgba(255, 140, 40, 0.75)');
    flame.addColorStop(1, 'rgba(255, 60, 30, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, -W * 0.28);
    ctx.quadraticCurveTo(-L * 0.45 - len * 0.6, -W * 0.16, -L * 0.45 - len, 0);
    ctx.quadraticCurveTo(-L * 0.45 - len * 0.6, W * 0.16, -L * 0.45, W * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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
