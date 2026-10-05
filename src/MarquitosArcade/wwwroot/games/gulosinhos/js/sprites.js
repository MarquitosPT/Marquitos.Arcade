// Os desenhos do percurso: guloseimas, guardiões, plantas, bombas, molas,
// plataformas, bandeiras, o frasco da meta e os enfeites dos cenários.
//
// Tudo vetorial, desenhado no canvas a cada fotograma — sem imagens para
// carregar, e nítido em qualquer tamanho de tile. Cada função recebe o ponto
// de apoio em píxeis (o centro, ou os pés, conforme o que se desenha) e `T`,
// os píxeis de um tile.

const TAU = Math.PI * 2;
const OUTLINE = 'rgba(59, 36, 51, 0.85)';

export function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
}

// ---------- Guloseimas ----------

const CANDY_COLORS = ['#ff5d8f', '#4fc3f7', '#ffd23f', '#8ee05a', '#b18cff', '#ff9a3d'];

/** Uma guloseima com o centro em (x, y). `kind` 0 a 3; a grande é um queque. */
export function drawCandy(ctx, candy, x, y, T, clock) {
    const bob = Math.sin(clock * 3 + candy.x * 0.9) * T * 0.06;
    y += bob;
    if (candy.big) {
        drawCupcake(ctx, x, y, T, clock);
        return;
    }
    const color = CANDY_COLORS[(Math.floor(candy.x * 7) + candy.kind) % CANDY_COLORS.length];
    const s = T * 0.3;
    ctx.lineWidth = Math.max(1, T * 0.04);
    ctx.strokeStyle = OUTLINE;

    switch (candy.kind) {
        case 0: {
            // Rebuçado embrulhado: o meio redondo e as duas pontas do papel torcidas.
            ctx.fillStyle = color;
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(x + side * s * 0.7, y);
                ctx.lineTo(x + side * s * 1.45, y - s * 0.55);
                ctx.lineTo(x + side * s * 1.45, y + s * 0.55);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.ellipse(x, y, s * 0.85, s * 0.7, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.moveTo(x - s * 0.35, y - s * 0.5);
            ctx.lineTo(x + s * 0.05, y + s * 0.55);
            ctx.stroke();
            break;
        }
        case 1: {
            // Chupa-chupa: pau branco e o disco em espiral.
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.5, T * 0.07);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + s * 1.6);
            ctx.stroke();
            ctx.lineWidth = Math.max(1, T * 0.04);
            ctx.strokeStyle = OUTLINE;
            ctx.fillStyle = '#ffffff';
            circle(ctx, x, y - s * 0.1, s * 0.95);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, T * 0.075);
            ctx.beginPath();
            for (let a = 0; a < TAU * 2.2; a += 0.3) {
                const r = (a / (TAU * 2.2)) * s * 0.8;
                const px = x + Math.cos(a + clock * 2) * r;
                const py = y - s * 0.1 + Math.sin(a + clock * 2) * r;
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            break;
        }
        case 2: {
            // Goma: um ursinho de gelatina, translúcido.
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.9;
            circle(ctx, x - s * 0.45, y - s * 0.75, s * 0.3);
            ctx.fill();
            circle(ctx, x + s * 0.45, y - s * 0.75, s * 0.3);
            ctx.fill();
            circle(ctx, x, y - s * 0.35, s * 0.6);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x, y + s * 0.45, s * 0.65, s * 0.7, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            circle(ctx, x - s * 0.25, y - s * 0.5, s * 0.15);
            ctx.fill();
            ctx.fillStyle = OUTLINE;
            circle(ctx, x - s * 0.2, y - s * 0.35, s * 0.07);
            ctx.fill();
            circle(ctx, x + s * 0.2, y - s * 0.35, s * 0.07);
            ctx.fill();
            break;
        }
        default: {
            // Donut com cobertura e granulado.
            ctx.fillStyle = '#d9975a';
            circle(ctx, x, y, s * 1.05);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let a = 0; a <= TAU + 0.01; a += TAU / 10) {
                const r = s * (0.86 + (Math.round(a * 10 / TAU) % 2) * 0.08);
                ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            }
            ctx.fill();
            ctx.fillStyle = '#fff4e0';
            circle(ctx, x, y, s * 0.36);
            ctx.fill();
            ctx.stroke();
            const dots = ['#ffffff', '#ffe066', '#7ad7ff', '#8ee05a'];
            for (let i = 0; i < 7; i++) {
                const a = (i / 7) * TAU + 0.3;
                ctx.fillStyle = dots[i % dots.length];
                ctx.fillRect(x + Math.cos(a) * s * 0.65 - s * 0.07, y + Math.sin(a) * s * 0.65 - s * 0.03, s * 0.14, s * 0.06);
            }
        }
    }
}

/** A guloseima grande: um queque com cereja, a brilhar. */
export function drawCupcake(ctx, x, y, T, clock) {
    const s = T * 0.42;
    const glow = ctx.createRadialGradient(x, y, s * 0.2, x, y, s * 2.1);
    glow.addColorStop(0, 'rgba(255, 236, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 236, 140, 0)');
    ctx.fillStyle = glow;
    circle(ctx, x, y, s * 2.1);
    ctx.fill();

    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    // Forma de papel às riscas.
    ctx.fillStyle = '#5ec8f2';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.95, y);
    ctx.lineTo(x + s * 0.95, y);
    ctx.lineTo(x + s * 0.7, y + s * 1.05);
    ctx.lineTo(x - s * 0.7, y + s * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * s * 0.35, y + s * 0.08);
        ctx.lineTo(x + i * s * 0.27, y + s * 0.98);
        ctx.stroke();
    }
    ctx.strokeStyle = OUTLINE;
    // Cobertura cor-de-rosa aos caracóis.
    ctx.fillStyle = '#ff8fc5';
    for (const [dx, dy, r] of [[-0.55, -0.1, 0.5], [0.55, -0.1, 0.5], [0, -0.35, 0.62], [0, -0.85, 0.42]]) {
        circle(ctx, x + dx * s, y + dy * s, r * s);
        ctx.fill();
        ctx.stroke();
    }
    ctx.fillStyle = '#ffd1e8';
    circle(ctx, x - s * 0.2, y - s * 0.5, s * 0.16);
    ctx.fill();
    // A cereja.
    ctx.fillStyle = '#e8304f';
    circle(ctx, x + s * 0.1, y - s * 1.3, s * 0.27);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#3f8f2e';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y - s * 1.5);
    ctx.quadraticCurveTo(x + s * 0.3, y - s * 1.85, x + s * 0.55, y - s * 1.8);
    ctx.stroke();
    // Brilhos a rodar.
    ctx.fillStyle = '#fff6b0';
    for (let i = 0; i < 3; i++) {
        const a = clock * 1.5 + (i * TAU) / 3;
        drawSparkle(ctx, x + Math.cos(a) * s * 1.6, y - s * 0.4 + Math.sin(a) * s * 1.2, s * 0.22);
    }
}

export function drawSparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
}

// ---------- Guardiões ----------

/** Um guardião com os pés em (x, y) — a abelha, com o centro em (x, y). */
export function drawGuard(ctx, g, x, y, T, clock, facing) {
    if (!g.alive) {
        if (g.dead > 0.5) return;
        ctx.globalAlpha = 1 - g.dead / 0.5;
        ctx.fillStyle = g.type === 'bee' ? '#ffd23f' : g.type === 'jelly' ? '#ff6f91' : '#9a6a44';
        ctx.beginPath();
        ctx.ellipse(x, y - T * 0.08, T * 0.5 * (1 + g.dead), T * 0.12, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
    }
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    if (g.type === 'jelly') drawJelly(ctx, x, y, T, clock, facing);
    else if (g.type === 'hedgehog') drawHedgehog(ctx, x, y, T, clock, facing);
    else drawBee(ctx, x, y, T, clock, facing);
}

function angryEyes(ctx, x, y, s, facing) {
    for (const side of [-1, 1]) {
        const ex = x + side * s * 0.3 + facing * s * 0.12;
        ctx.fillStyle = '#ffffff';
        circle(ctx, ex, y, s * 0.17);
        ctx.fill();
        ctx.fillStyle = '#2a1b2a';
        circle(ctx, ex + facing * s * 0.05, y + s * 0.03, s * 0.09);
        ctx.fill();
        ctx.strokeStyle = '#2a1b2a';
        ctx.lineWidth = s * 0.08;
        ctx.beginPath();
        ctx.moveTo(ex - s * 0.18, y - s * (side === facing ? 0.3 : 0.2));
        ctx.lineTo(ex + s * 0.18, y - s * (side === facing ? 0.2 : 0.3));
        ctx.stroke();
    }
}

function drawJelly(ctx, x, y, T, clock, facing) {
    const s = T;
    const wob = Math.sin(clock * 9 + x) * 0.05;
    const w = s * 0.46 * (1 + wob);
    const h = s * 0.76 * (1 - wob);
    ctx.fillStyle = '#ff6f91';
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w, y - h * 1.15, x + w, y - h * 1.15, x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.45, y - h * 0.62, w * 0.18, h * 0.16, -0.5, 0, TAU);
    ctx.fill();
    angryEyes(ctx, x, y - h * 0.45, s * 0.7, facing);
    // Um chapéu de guarda, pequenino.
    ctx.fillStyle = '#3c4a8f';
    roundRect(ctx, x - w * 0.42, y - h * 0.98, w * 0.84, h * 0.2, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    circle(ctx, x, y - h * 0.88, s * 0.05);
    ctx.fill();
}

function drawHedgehog(ctx, x, y, T, clock, facing) {
    const s = T;
    const step = Math.sin(clock * 12) * s * 0.04;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    // Picos.
    ctx.fillStyle = '#6e4528';
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI * 0.95;
        const r = i % 2 ? s * 0.42 : s * 0.62;
        ctx.lineTo(Math.cos(a) * r - s * 0.08, Math.sin(a) * r * 1.05 - s * 0.05);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // Corpo e cara.
    ctx.fillStyle = '#e8c39b';
    ctx.beginPath();
    ctx.ellipse(s * 0.15, -s * 0.24, s * 0.32, s * 0.24, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a1b2a';
    circle(ctx, s * 0.47, -s * 0.24, s * 0.06);
    ctx.fill();
    circle(ctx, s * 0.24, -s * 0.33, s * 0.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 120, 150, 0.5)';
    circle(ctx, s * 0.2, -s * 0.18, s * 0.06);
    ctx.fill();
    // Patas.
    ctx.fillStyle = '#6e4528';
    circle(ctx, -s * 0.15 + step, -s * 0.03, s * 0.08);
    ctx.fill();
    circle(ctx, s * 0.2 - step, -s * 0.03, s * 0.08);
    ctx.fill();
    ctx.restore();
}

function drawBee(ctx, x, y, T, clock, facing) {
    const s = T;
    // Asas a bater.
    const flap = Math.abs(Math.sin(clock * 30)) * 0.6 + 0.4;
    ctx.fillStyle = 'rgba(230, 248, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.1, y - s * 0.32, s * 0.16, s * 0.26 * flap, -0.4, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1, T * 0.035);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.12, y - s * 0.32, s * 0.14, s * 0.22 * flap, 0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Corpo às riscas.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.38, s * 0.3, 0, 0, TAU);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#2a1b2a';
    for (const dx of [-0.2, 0.02]) ctx.fillRect(x + dx * s * facing - s * 0.05, y - s * 0.35, s * 0.1, s * 0.7);
    ctx.restore();
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.38, s * 0.3, 0, 0, TAU);
    ctx.stroke();
    // Ferrão e olho.
    ctx.fillStyle = '#2a1b2a';
    ctx.beginPath();
    ctx.moveTo(x - facing * s * 0.36, y - s * 0.06);
    ctx.lineTo(x - facing * s * 0.52, y);
    ctx.lineTo(x - facing * s * 0.36, y + s * 0.06);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    circle(ctx, x + facing * s * 0.2, y - s * 0.06, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#2a1b2a';
    circle(ctx, x + facing * s * 0.23, y - s * 0.05, s * 0.055);
    ctx.fill();
}

// ---------- Plantas carnívoras ----------

/** A planta com o vaso enterrado em (x, y), de fora `ext` (0 a 1) com o pescoço de `height` tiles. */
export function drawPlant(ctx, x, y, T, ext, height, clock) {
    const s = T;
    if (ext > 0.02) {
        const headY = y - ext * height * s + s * 0.38;
        // O caule a dar ao dente.
        ctx.strokeStyle = '#3f9a3a';
        ctx.lineWidth = s * 0.14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.sin(clock * 4) * s * 0.18, (y + headY) / 2, x, headY);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = '#5cc94f';
        ctx.beginPath();
        ctx.ellipse(x - s * 0.22, (y + headY) / 2 + s * 0.15, s * 0.2, s * 0.08, 0.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + s * 0.22, (y + headY) / 2 + s * 0.35, s * 0.2, s * 0.08, -0.5, 0, TAU);
        ctx.fill();

        // A cabeça: duas metades vermelhas com pintas e dentes.
        const open = ext >= 1 ? 0.25 + Math.abs(Math.sin(clock * 6)) * 0.45 : 0.15;
        ctx.lineWidth = Math.max(1, T * 0.045);
        ctx.strokeStyle = OUTLINE;
        for (const half of [-1, 1]) {
            ctx.save();
            ctx.translate(x, headY);
            ctx.rotate(half * open);
            ctx.fillStyle = '#ff4d6d';
            ctx.beginPath();
            ctx.ellipse(0, half * -s * 0.02, s * 0.4, s * 0.24, 0, half < 0 ? Math.PI : 0, half < 0 ? TAU : Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * s * 0.13 - s * 0.05, 0);
                ctx.lineTo(i * s * 0.13, half * s * 0.1);
                ctx.lineTo(i * s * 0.13 + s * 0.05, 0);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            circle(ctx, -s * 0.15, -half * s * 0.12, s * 0.04);
            ctx.fill();
            circle(ctx, s * 0.12, -half * s * 0.15, s * 0.035);
            ctx.fill();
            ctx.restore();
        }
    }
    // O vaso, enterrado no chão até à borda.
    ctx.fillStyle = '#d9714a';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, T * 0.045);
    roundRect(ctx, x - s * 0.45, y - s * 0.16, s * 0.9, s * 0.28, s * 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x - s * 0.38, y - s * 0.12, s * 0.5, s * 0.06);
}

// ---------- Bombas ----------

export function drawBomb(ctx, bomb, x, y, T, clock) {
    const s = T;
    if (bomb.state === 'gone') {
        ctx.fillStyle = 'rgba(40, 30, 30, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.02, s * 0.6, s * 0.1, 0, 0, TAU);
        ctx.fill();
        return;
    }
    if (bomb.state === 'boom') {
        const k = bomb.boomT / 0.6;
        for (const [r, color] of [[1.9, '#ff8a3d'], [1.4, '#ffb347'], [0.9, '#fff1a8']]) {
            ctx.globalAlpha = Math.max(0, 1 - k) * 0.85;
            ctx.fillStyle = color;
            circle(ctx, x, y - s * 0.4, s * r * (0.6 + k * 0.6));
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
    }
    const cx = x;
    const cy = y - s * 0.38;
    const armed = bomb.state === 'armed';
    const blink = armed && (bomb.timer % 1) < 0.35;
    const pulse = armed ? 1 + Math.sin(clock * 20) * 0.03 : 1;
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    // O rastilho.
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.18, cy - s * 0.28);
    ctx.quadraticCurveTo(cx + s * 0.35, cy - s * 0.55, cx + s * 0.22, cy - s * 0.62);
    ctx.stroke();
    if (armed) {
        ctx.fillStyle = Math.sin(clock * 40) > 0 ? '#ffe066' : '#ff8a3d';
        drawSparkle(ctx, cx + s * 0.22, cy - s * 0.64, s * 0.14);
    }
    // O corpo redondo.
    ctx.fillStyle = blink ? '#c4344f' : '#2f2b3a';
    circle(ctx, cx, cy, s * 0.36 * pulse);
    ctx.fill();
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    circle(ctx, cx - s * 0.13, cy - s * 0.14, s * 0.08);
    ctx.fill();
    // O mostrador do relógio.
    ctx.fillStyle = '#fffaf0';
    circle(ctx, cx, cy + s * 0.03, s * 0.2);
    ctx.fill();
    ctx.stroke();
    if (armed) {
        ctx.fillStyle = '#c4344f';
        ctx.font = `800 ${Math.round(s * 0.3)}px 'Fredoka', 'Outfit', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.max(1, Math.ceil(bomb.timer))), cx, cy + s * 0.05);
    } else {
        ctx.strokeStyle = '#2f2b3a';
        ctx.lineWidth = s * 0.035;
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.03);
        ctx.lineTo(cx, cy - s * 0.1);
        ctx.moveTo(cx, cy + s * 0.03);
        ctx.lineTo(cx + Math.cos(clock) * s * 0.12, cy + s * 0.03 + Math.sin(clock) * s * 0.12);
        ctx.stroke();
    }
    // Os pezinhos.
    ctx.fillStyle = '#2f2b3a';
    ctx.fillRect(cx - s * 0.22, y - s * 0.06, s * 0.12, s * 0.06);
    ctx.fillRect(cx + s * 0.1, y - s * 0.06, s * 0.12, s * 0.06);
}

// ---------- Molas e plataformas ----------

export function drawSpring(ctx, spring, x, y, T) {
    const s = T;
    const height = s * (0.42 - spring.squash * 0.22);
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = '#8c95a8';
    roundRect(ctx, x - s * 0.4, y - s * 0.08, s * 0.8, s * 0.08, 2);
    ctx.fill();
    ctx.strokeStyle = '#c0c8d8';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
        const px = x + (i % 2 ? s * 0.25 : -s * 0.25);
        const py = y - s * 0.08 - (i / 6) * (height - s * 0.08);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = '#ff4d6d';
    roundRect(ctx, x - s * 0.45, y - height - s * 0.12, s * 0.9, s * 0.14, s * 0.06);
    ctx.fill();
    ctx.stroke();
}

export function drawMover(ctx, m, x, y, w, T, theme) {
    const h = T * 0.42;
    ctx.lineWidth = Math.max(1, T * 0.045);
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = theme.platform;
    roundRect(ctx, x, y, w, h, h * 0.4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.platformDark;
    roundRect(ctx, x + 2, y + h * 0.55, w - 4, h * 0.35, h * 0.2);
    ctx.fill();
    // Setinhas a dizer para onde anda.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const mid = x + w / 2;
    const cy = y + h * 0.32;
    const a = T * 0.1;
    ctx.beginPath();
    if (m.axis === 'x') {
        ctx.moveTo(mid - a * 3, cy);
        ctx.lineTo(mid - a * 2, cy - a);
        ctx.lineTo(mid - a * 2, cy + a);
        ctx.moveTo(mid + a * 3, cy);
        ctx.lineTo(mid + a * 2, cy - a);
        ctx.lineTo(mid + a * 2, cy + a);
    } else {
        ctx.moveTo(mid, cy - a * 1.2);
        ctx.lineTo(mid - a, cy + a * 0.6);
        ctx.lineTo(mid + a, cy + a * 0.6);
    }
    ctx.fill();
}

// ---------- Bandeiras e meta ----------

export function drawCheckpoint(ctx, cp, x, y, T, clock, accent) {
    const s = T;
    ctx.fillStyle = '#e9e4f2';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, T * 0.04);
    roundRect(ctx, x - s * 0.05, y - s * 2.2, s * 0.1, s * 2.2, s * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    circle(ctx, x, y - s * 2.22, s * 0.1);
    ctx.fill();
    ctx.stroke();
    const wave = cp.reached ? Math.sin(clock * 6) * s * 0.08 : 0;
    ctx.fillStyle = cp.reached ? accent : '#b9b4c6';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.05, y - s * 2.1);
    ctx.quadraticCurveTo(x + s * 0.45, y - s * 2.1 + wave, x + s * 0.85, y - s * 1.85 + wave);
    ctx.quadraticCurveTo(x + s * 0.45, y - s * 1.6 - wave, x + s * 0.05, y - s * 1.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/** O frasco das guloseimas, com a meta à frente. */
export function drawGoal(ctx, x, y, T, clock) {
    const s = T;
    const w = s * 1.9;
    const h = s * 2.3;
    const left = x - w / 2 + s * 0.6;
    ctx.lineWidth = Math.max(1.5, T * 0.05);
    ctx.strokeStyle = OUTLINE;
    // O vidro.
    ctx.fillStyle = 'rgba(220, 245, 255, 0.55)';
    roundRect(ctx, left, y - h, w, h, s * 0.4);
    ctx.fill();
    ctx.stroke();
    // As guloseimas lá dentro.
    const colors = ['#ff5d8f', '#4fc3f7', '#ffd23f', '#8ee05a', '#b18cff', '#ff9a3d'];
    for (let i = 0; i < 18; i++) {
        const cx = left + s * 0.3 + ((i * 37) % 13) / 13 * (w - s * 0.6);
        const cy = y - s * 0.3 - Math.floor(i / 5) * s * 0.33 - ((i * 17) % 5) * s * 0.03;
        ctx.fillStyle = colors[i % colors.length];
        circle(ctx, cx, cy, s * 0.17);
        ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    roundRect(ctx, left + s * 0.15, y - h + s * 0.3, s * 0.15, h * 0.6, s * 0.08);
    ctx.fill();
    // A tampa.
    ctx.fillStyle = '#ff6fb1';
    roundRect(ctx, left - s * 0.12, y - h - s * 0.3, w + s * 0.24, s * 0.38, s * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
        circle(ctx, left + s * 0.15 + i * (w - s * 0.3) / 4, y - h - s * 0.11, s * 0.06);
        ctx.fill();
    }
    // A fita da meta, a esvoaçar.
    const bx = x - s * 0.6;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, bx - s * 0.06, y - s * 3.2, s * 0.12, s * 3.2, s * 0.05);
    ctx.fill();
    ctx.stroke();
    const wave = Math.sin(clock * 5) * s * 0.1;
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
            ctx.fillStyle = (row + col) % 2 ? '#2f2b3a' : '#ffffff';
            ctx.fillRect(bx + s * 0.06 + col * s * 0.22, y - s * 3.15 + row * s * 0.22 + wave * (col / 4), s * 0.22, s * 0.22);
        }
    }
    ctx.fillStyle = '#fff6b0';
    for (let i = 0; i < 3; i++) {
        const a = clock * 1.3 + (i * TAU) / 3;
        drawSparkle(ctx, x + s * 0.6 + Math.cos(a) * w * 0.7, y - h * 0.6 + Math.sin(a) * h * 0.55, s * 0.16);
    }
}

// ---------- Enfeites ----------

export function drawDecor(ctx, kind, x, y, T, size, theme, clock) {
    const s = T * size;
    ctx.lineWidth = Math.max(1, T * 0.035);
    ctx.strokeStyle = 'rgba(59, 36, 51, 0.5)';
    switch (kind) {
        case 'flower':
        case 'flower2': {
            ctx.strokeStyle = '#3f9a3a';
            ctx.lineWidth = s * 0.06;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - s * 0.45);
            ctx.stroke();
            const petal = kind === 'flower' ? '#ff8fc5' : '#ffffff';
            ctx.fillStyle = petal;
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * TAU + clock * 0.3;
                circle(ctx, x + Math.cos(a) * s * 0.11, y - s * 0.5 + Math.sin(a) * s * 0.11, s * 0.08);
                ctx.fill();
            }
            ctx.fillStyle = '#ffd23f';
            circle(ctx, x, y - s * 0.5, s * 0.07);
            ctx.fill();
            break;
        }
        case 'bush': {
            ctx.fillStyle = theme.near;
            for (const [dx, dy, r] of [[-0.25, -0.2, 0.25], [0.2, -0.22, 0.27], [0, -0.38, 0.28]]) {
                circle(ctx, x + dx * s, y + dy * s, r * s);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            circle(ctx, x - s * 0.08, y - s * 0.48, s * 0.08);
            ctx.fill();
            break;
        }
        case 'mushroom':
        case 'mushroomGlow': {
            const glow = kind === 'mushroomGlow';
            ctx.fillStyle = '#fff4e0';
            ctx.fillRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.3);
            ctx.fillStyle = glow ? '#7af0ff' : '#ff5d5d';
            if (glow) {
                ctx.shadowColor = '#7af0ff';
                ctx.shadowBlur = s * 0.5;
            }
            ctx.beginPath();
            ctx.ellipse(x, y - s * 0.3, s * 0.26, s * 0.18, 0, Math.PI, TAU);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            circle(ctx, x - s * 0.1, y - s * 0.38, s * 0.04);
            ctx.fill();
            circle(ctx, x + s * 0.08, y - s * 0.42, s * 0.05);
            ctx.fill();
            break;
        }
        case 'appleTree':
        case 'pine':
        case 'pineSnow':
        case 'palm':
        case 'cupcakeTree':
            drawTree(ctx, kind, x, y, s, theme, clock);
            break;
        case 'reeds': {
            ctx.strokeStyle = '#4f8f3a';
            ctx.lineWidth = s * 0.05;
            for (const dx of [-0.12, 0, 0.12]) {
                ctx.beginPath();
                ctx.moveTo(x + dx * s, y);
                ctx.quadraticCurveTo(x + dx * s * 1.5, y - s * 0.4, x + dx * s * 2 + Math.sin(clock + dx) * s * 0.05, y - s * 0.75);
                ctx.stroke();
            }
            ctx.fillStyle = '#8a5a3b';
            ctx.beginPath();
            ctx.ellipse(x, y - s * 0.7, s * 0.04, s * 0.12, 0, 0, TAU);
            ctx.fill();
            break;
        }
        case 'rock': {
            ctx.fillStyle = theme.night ? '#5a4c78' : '#a7a2b4';
            ctx.beginPath();
            ctx.ellipse(x, y - s * 0.12, s * 0.3, s * 0.18, 0, Math.PI, TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            circle(ctx, x - s * 0.1, y - s * 0.2, s * 0.05);
            ctx.fill();
            break;
        }
        case 'shell': {
            ctx.fillStyle = '#ffc2b0';
            ctx.beginPath();
            ctx.moveTo(x, y - s * 0.02);
            ctx.arc(x, y - s * 0.02, s * 0.2, Math.PI, TAU);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#e88f7a';
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(x, y - s * 0.02);
                ctx.lineTo(x + Math.cos(Math.PI + (i * Math.PI) / 4) * s * 0.2, y - s * 0.02 + Math.sin(Math.PI + (i * Math.PI) / 4) * s * 0.2);
                ctx.stroke();
            }
            break;
        }
        case 'starfish':
        case 'star': {
            ctx.fillStyle = kind === 'star' ? '#ffe066' : '#ff8a5c';
            const r = s * 0.22;
            const cy = kind === 'star' ? y - s * 0.6 - Math.sin(clock * 2 + x) * s * 0.08 : y - r * 0.5;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                const rr = i % 2 ? r * 0.45 : r;
                ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'cactus': {
            ctx.fillStyle = '#5aa64a';
            roundRect(ctx, x - s * 0.1, y - s * 0.8, s * 0.2, s * 0.8, s * 0.1);
            ctx.fill();
            roundRect(ctx, x - s * 0.32, y - s * 0.55, s * 0.16, s * 0.3, s * 0.08);
            ctx.fill();
            roundRect(ctx, x + s * 0.16, y - s * 0.65, s * 0.16, s * 0.28, s * 0.08);
            ctx.fill();
            ctx.fillStyle = '#ff8fc5';
            circle(ctx, x, y - s * 0.82, s * 0.07);
            ctx.fill();
            break;
        }
        case 'crystal': {
            ctx.fillStyle = 'rgba(190, 150, 255, 0.85)';
            ctx.shadowColor = '#c9a6ff';
            ctx.shadowBlur = s * 0.4;
            for (const [dx, hgt, w] of [[-0.12, 0.5, 0.12], [0.05, 0.7, 0.14], [0.2, 0.4, 0.1]]) {
                ctx.beginPath();
                ctx.moveTo(x + dx * s - w * s, y);
                ctx.lineTo(x + dx * s, y - hgt * s);
                ctx.lineTo(x + dx * s + w * s, y);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            break;
        }
        case 'lantern': {
            ctx.strokeStyle = '#3b2a1b';
            ctx.lineWidth = s * 0.05;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - s * 0.9);
            ctx.lineTo(x + s * 0.25, y - s * 0.9);
            ctx.stroke();
            ctx.fillStyle = '#ffd36b';
            ctx.shadowColor = '#ffb347';
            ctx.shadowBlur = s * 0.8;
            roundRect(ctx, x + s * 0.15, y - s * 0.85, s * 0.2, s * 0.26, s * 0.05);
            ctx.fill();
            ctx.shadowBlur = 0;
            break;
        }
        case 'gold': {
            ctx.fillStyle = '#ffcf4d';
            for (const [dx, dy] of [[-0.12, -0.08], [0.1, -0.08], [0, -0.2]]) {
                ctx.beginPath();
                ctx.ellipse(x + dx * s, y + dy * s, s * 0.12, s * 0.08, 0, 0, TAU);
                ctx.fill();
            }
            break;
        }
        case 'snowman': {
            ctx.fillStyle = '#ffffff';
            circle(ctx, x, y - s * 0.22, s * 0.22);
            ctx.fill();
            ctx.stroke();
            circle(ctx, x, y - s * 0.56, s * 0.16);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ff8a3d';
            ctx.beginPath();
            ctx.moveTo(x + s * 0.04, y - s * 0.56);
            ctx.lineTo(x + s * 0.2, y - s * 0.53);
            ctx.lineTo(x + s * 0.04, y - s * 0.5);
            ctx.fill();
            ctx.fillStyle = '#2a1b2a';
            circle(ctx, x - s * 0.05, y - s * 0.6, s * 0.025);
            ctx.fill();
            circle(ctx, x + s * 0.05, y - s * 0.6, s * 0.025);
            ctx.fill();
            break;
        }
        case 'iceSpike': {
            ctx.fillStyle = 'rgba(200, 236, 255, 0.9)';
            ctx.beginPath();
            ctx.moveTo(x - s * 0.18, y);
            ctx.lineTo(x - s * 0.04, y - s * 0.75);
            ctx.lineTo(x + s * 0.06, y - s * 0.3);
            ctx.lineTo(x + s * 0.14, y - s * 0.5);
            ctx.lineTo(x + s * 0.22, y);
            ctx.fill();
            break;
        }
        case 'rainbow': {
            const colors = ['#ff6f91', '#ffb347', '#ffe066', '#8ee05a', '#4fc3f7', '#b18cff'];
            ctx.lineWidth = s * 0.06;
            colors.forEach((color, i) => {
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, s * (0.55 - i * 0.06), Math.PI, TAU);
                ctx.stroke();
            });
            break;
        }
        case 'lollipop': {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = s * 0.08;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - s * 0.75);
            ctx.stroke();
            ctx.fillStyle = '#ff6fb1';
            circle(ctx, x, y - s * 0.9, s * 0.28);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = s * 0.06;
            ctx.beginPath();
            ctx.arc(x, y - s * 0.9, s * 0.15, clock, clock + Math.PI * 1.4);
            ctx.stroke();
            break;
        }
        case 'candyCane': {
            ctx.lineWidth = s * 0.12;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - s * 0.7);
            ctx.arc(x + s * 0.15, y - s * 0.7, s * 0.15, Math.PI, TAU);
            ctx.stroke();
            ctx.strokeStyle = '#ff4d6d';
            ctx.setLineDash([s * 0.08, s * 0.1]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineCap = 'butt';
            break;
        }
        default:
            break;
    }
}

function drawTree(ctx, kind, x, y, s, theme, clock) {
    const sway = Math.sin(clock * 0.8 + x * 0.01) * s * 0.03;
    if (kind === 'palm') {
        ctx.strokeStyle = '#a8743f';
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + s * 0.25, y - s * 0.8, x + s * 0.15 + sway, y - s * 1.5);
        ctx.stroke();
        ctx.fillStyle = '#3fae5a';
        for (let i = 0; i < 5; i++) {
            const a = Math.PI + (i / 4) * Math.PI;
            ctx.beginPath();
            ctx.ellipse(x + s * 0.15 + sway + Math.cos(a) * s * 0.35, y - s * 1.5 + Math.sin(a) * s * 0.12, s * 0.38, s * 0.1, a, 0, TAU);
            ctx.fill();
        }
        return;
    }
    if (kind === 'cupcakeTree') {
        ctx.fillStyle = '#f5d3a8';
        ctx.fillRect(x - s * 0.08, y - s * 0.9, s * 0.16, s * 0.9);
        ctx.fillStyle = '#ffb3d9';
        for (const [dx, dy, r] of [[-0.25, -1.0, 0.3], [0.25, -1.0, 0.3], [0, -1.25, 0.34]]) {
            circle(ctx, x + dx * s + sway, y + dy * s, r * s);
            ctx.fill();
        }
        ctx.fillStyle = '#e8304f';
        circle(ctx, x + sway, y - s * 1.6, s * 0.09);
        ctx.fill();
        return;
    }
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(x - s * 0.08, y - s * 0.6, s * 0.16, s * 0.6);
    if (kind === 'appleTree') {
        ctx.fillStyle = theme.near;
        for (const [dx, dy, r] of [[-0.3, -0.9, 0.32], [0.3, -0.9, 0.32], [0, -1.2, 0.38]]) {
            circle(ctx, x + dx * s + sway, y + dy * s, r * s);
            ctx.fill();
        }
        ctx.fillStyle = '#ff4d4d';
        for (const [dx, dy] of [[-0.3, -0.85], [0.25, -1.0], [0.05, -1.35]]) {
            circle(ctx, x + dx * s + sway, y + dy * s, s * 0.07);
            ctx.fill();
        }
        return;
    }
    // Pinheiro, com ou sem neve.
    const snow = kind === 'pineSnow';
    for (let i = 0; i < 3; i++) {
        const w = s * (0.5 - i * 0.12);
        const top = y - s * (0.55 + i * 0.35) - s * 0.35;
        ctx.fillStyle = '#2f8f55';
        ctx.beginPath();
        ctx.moveTo(x - w + sway, top + s * 0.45);
        ctx.lineTo(x + sway, top);
        ctx.lineTo(x + w + sway, top + s * 0.45);
        ctx.fill();
        if (snow) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(x - w * 0.5 + sway, top + s * 0.22);
            ctx.lineTo(x + sway, top);
            ctx.lineTo(x + w * 0.5 + sway, top + s * 0.22);
            ctx.fill();
        }
    }
}
