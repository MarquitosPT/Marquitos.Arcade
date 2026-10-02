// Desenho dos carros vistos de cima: Fórmula 1, 911 GT, kart e jeep.
//
// Vive à parte do resto do render porque não é só a corrida que o usa: os
// cartões da garagem, no menu, desenham os mesmos carros nas suas miniaturas.
// Por isso desenha em qualquer contexto 2D, sempre na origem e virado para +x —
// quem chama é que põe o carro no sítio e o roda.
//
// Os quatro cabem no mesmo retângulo de `CAR_LEN` × `CAR_W` (o das colisões):
// o que muda entre eles é a silhueta, não o espaço que ocupam na pista. Tudo é
// medido em frações desse retângulo, por isso mudar o tamanho do carro no
// config não obriga a redesenhar nada aqui.
//
// A cor do jogador vai sempre na carroçaria; o volume é posto por cima com
// branco e preto translúcidos, em vez de aclarar/escurecer o hex, para
// funcionar com qualquer cor da paleta.

import { clamp } from '/lib/arcade/math.js';
import { CAR_LEN, CAR_W, MAX_SPEED } from './config.js';

/** O contexto da chamada em curso; muda a cada `drawCarSprite`. */
let ctx = null;

/** Cor do carbono: fundos planos, suspensão, halo, endplates, para-choques. */
const CARBON = '#1b1f2b';
const L = CAR_LEN, W = CAR_W, hw = CAR_W / 2;

function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
}

/**
 * Contorno simétrico a partir dos pontos do lado direito, do nariz para trás; o
 * lado esquerdo é o espelho. Os pontos são de controlo e a curva passa pelos
 * pontos médios entre eles, por isso sai sempre suave sem ter de afinar curvas
 * à mão. Os pontos vêm em frações de `L` (x) e de meia-largura `hw` (y).
 */
function symPath(pts) {
    const right = pts.map(([x, y]) => [x * L, y * hw]);
    const all = [...right, ...right.slice().reverse().map(([x, y]) => [x, -y])];
    const n = all.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.beginPath();
    let m = mid(all[n - 1], all[0]);
    ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
        m = mid(all[i], all[(i + 1) % n]);
        ctx.quadraticCurveTo(all[i][0], all[i][1], m[0], m[1]);
    }
    ctx.closePath();
}

/** O mesmo que `symPath`, mas em linhas retas: para o jeep, que é todo esquinas. */
function symPoly(pts) {
    const right = pts.map(([x, y]) => [x * L, y * hw]);
    const all = [...right, ...right.slice().reverse().map(([x, y]) => [x, -y])];
    ctx.beginPath();
    ctx.moveTo(all[0][0], all[0][1]);
    for (const [x, y] of all.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
}

/**
 * Pinta a peça que estiver no caminho atual na cor da carroçaria, com o mesmo
 * gradiente de volume e o mesmo contorno do corpo — é o que faz uma asa ou um
 * guarda-lamas parecer parte do carro e não uma peça solta.
 * @param {number} span Meia-altura da peça, para o gradiente bater certo com o do corpo.
 */
function paintBodyPart(color, span) {
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

/**
 * Carroçaria principal: cor, volume e, dentro do recorte, a pintura de cada
 * carro (`livery`), que assim nunca sai fora do corpo. O contorno vem no fim,
 * por cima da pintura.
 */
function shadedBody(path, color, span, livery) {
    path();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const shade = ctx.createLinearGradient(0, -span, 0, span);
    shade.addColorStop(0, 'rgba(255, 255, 255, 0.36)');
    shade.addColorStop(0.42, 'rgba(255, 255, 255, 0.05)');
    shade.addColorStop(0.62, 'rgba(0, 0, 0, 0.08)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
    ctx.fillStyle = shade;
    ctx.fillRect(-L, -hw, L * 2, W);
    if (livery) livery();
    ctx.restore();
    path();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.6)';
    ctx.stroke();
}

function shadow(front, back, half, r) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    rrect(-L * back, -half + 4, L * (front + back), half * 2, r);
    ctx.fill();
}

/**
 * Pneu visto de cima. `knobby` dá-lhe os tacos de um pneu todo-o-terreno, que
 * é o que faz o jeep parecer jeep mesmo pequenino no ecrã.
 */
function drawWheel(x, y, len, wid, steer, knobby = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(steer);
    ctx.fillStyle = '#12141c';
    rrect(-len / 2, -wid / 2, len, wid, wid * 0.32);
    ctx.fill();
    if (knobby) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        const n = 5;
        for (let i = 0; i < n; i++) {
            const tx = -len * 0.4 + (i * len * 0.8) / (n - 1);
            ctx.fillRect(tx - 0.6, -wid * 0.42, 1.2, wid * 0.84);
        }
    } else {
        // Risco claro no topo do pneu: sem ele a roda desaparece contra o asfalto.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        rrect(-len * 0.38, -wid * 0.36, len * 0.76, wid * 0.24, wid * 0.12);
        ctx.fill();
    }
    // Ombro do pneu, mais escuro, para a roda ter volume e não ser um bloco.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    rrect(-len / 2, wid * 0.22, len, wid * 0.28, wid * 0.14);
    ctx.fill();
    ctx.restore();
}

/** Capacete visto de cima: branco, com uma risca na cor do carro e a viseira à frente. */
function drawHelmet(x, y, r, color) {
    ctx.fillStyle = 'rgba(240, 244, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(x - r * 0.26, y - r * 0.96, r * 0.52, r * 1.92);
    ctx.fillStyle = 'rgba(12, 16, 28, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.fill();
}

/** Luz traseira: acesa e a brilhar a travar, meio apagada no resto do tempo. */
function brakeLight(braking, draw) {
    ctx.fillStyle = braking ? '#ff4438' : 'rgba(190, 46, 40, 0.85)';
    if (braking) { ctx.shadowColor = '#ff4438'; ctx.shadowBlur = 10; }
    draw();
    ctx.shadowBlur = 0;
}

// ---------- Fórmula 1 ----------

/**
 * Carroçaria de um monolugar: nariz comprido e fino, habitáculo estreito,
 * sidepods largos logo atrás das rodas da frente e a traseira a fechar em
 * "garrafa de Coca-Cola" até à estrutura de impacto. É a cintura estreita
 * entre as rodas que separa um fórmula de um kart.
 */
const F1_BODY = [
    [0.52, 0], [0.51, 0.07], [0.42, 0.11], [0.28, 0.17], [0.17, 0.24],
    [0.13, 0.30], [0.11, 0.62], [0.05, 0.72], [-0.07, 0.70], [-0.15, 0.56],
    [-0.21, 0.32], [-0.30, 0.22], [-0.40, 0.17], [-0.45, 0.10], [-0.46, 0]
];

/** Fundo plano, em carbono: espreita à volta dos sidepods, como o de um F1. */
const F1_FLOOR = [
    [0.18, 0], [0.17, 0.32], [0.13, 0.74], [0.02, 0.82], [-0.14, 0.78],
    [-0.22, 0.52], [-0.34, 0.40], [-0.41, 0.30], [-0.42, 0]
];

/** Asa dianteira: a toda a largura do carro e ligeiramente em flecha. */
const F1_FRONT_WING = [
    [0.49, 0], [0.50, 0.40], [0.49, 0.96], [0.43, 0.97], [0.41, 0.60], [0.43, 0.18], [0.43, 0]
];

/**
 * Braços de suspensão em V, do cubo da roda ao chassis. Finos como num F1 a
 * sério — mas com espessura suficiente para não desaparecerem ao tamanho a que
 * o carro anda no ecrã.
 */
function drawSuspension(axle, wheelY, front, rear) {
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(front[0] * L, s * front[1] * hw);
        ctx.lineTo(axle * L, s * wheelY * hw);
        ctx.lineTo(rear[0] * L, s * rear[1] * hw);
        ctx.stroke();
    }
}

function drawF1({ color, steer, lean, braking }) {
    shadow(0.5, 0.5, hw * 0.9, hw * 0.6);

    symPath(F1_FLOOR);
    ctx.fillStyle = CARBON;
    ctx.fill();

    const frontY = 0.79, rearY = 0.75;
    drawSuspension(0.29, frontY, [0.36, 0.13], [0.21, 0.20]);
    drawSuspension(-0.29, rearY, [-0.22, 0.30], [-0.37, 0.18]);
    for (const s of [1, -1]) {
        drawWheel(L * 0.29, s * hw * frontY, L * 0.17, W * 0.21, steer);
        drawWheel(-L * 0.29, s * hw * rearY, L * 0.20, W * 0.27, 0);
    }

    // Asa dianteira, na cor da carroçaria e não em preto: preta desaparecia
    // contra o asfalto, e o carro ficava sem frente. Os endplates e o risco do
    // flap é que são em carbono.
    symPath(F1_FRONT_WING);
    paintBodyPart(color, hw);
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(L * 0.455, -hw * 0.9);
    ctx.quadraticCurveTo(L * 0.44, 0, L * 0.455, hw * 0.9);
    ctx.stroke();
    ctx.fillStyle = CARBON;
    for (const s of [1, -1]) {
        rrect(L * 0.40, s > 0 ? hw * 0.88 : -hw * 1.0, L * 0.11, hw * 0.12, 1);
        ctx.fill();
    }

    ctx.transform(1, 0, lean, 1, 0, 0);

    // Pintura: risca clara ao longo do nariz e da tampa do motor, e a traseira
    // dos sidepods mais escura, para a "cintura" do carro se ler de longe.
    shadedBody(() => symPath(F1_BODY), color, hw * 0.66, () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(L * 0.16, -hw * 0.06, L * 0.34, hw * 0.12);
        ctx.fillRect(-L * 0.44, -hw * 0.06, L * 0.30, hw * 0.12);
        ctx.fillStyle = 'rgba(6, 9, 20, 0.28)';
        ctx.beginPath();
        ctx.moveTo(-L * 0.04, -hw);
        ctx.lineTo(-L * 0.12, -hw);
        ctx.lineTo(-L * 0.22, 0);
        ctx.lineTo(-L * 0.12, hw);
        ctx.lineTo(-L * 0.04, hw);
        ctx.lineTo(-L * 0.14, 0);
        ctx.closePath();
        ctx.fill();
    });

    // Entradas de ar dos sidepods e espelhos à frente delas.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.9)';
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.ellipse(L * 0.095, s * hw * 0.5, L * 0.018, hw * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = CARBON;
    for (const s of [1, -1]) {
        rrect(L * 0.12, s > 0 ? hw * 0.36 : -hw * 0.5, L * 0.045, hw * 0.14, 1);
        ctx.fill();
    }

    // Habitáculo, capacete e halo por cima — o halo é a peça que hoje mais
    // identifica um fórmula visto de cima.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.95)';
    rrect(-L * 0.06, -hw * 0.25, L * 0.19, hw * 0.5, hw * 0.22);
    ctx.fill();
    drawHelmet(L * 0.02, 0, hw * 0.19, color);

    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(L * 0.03, 0, L * 0.085, hw * 0.29, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L * 0.115, 0);
    ctx.lineTo(L * 0.17, 0);
    ctx.stroke();

    // Airbox por cima da cabeça do piloto e a barbatana ao longo da tampa do motor.
    ctx.fillStyle = CARBON;
    symPath([[-0.07, 0], [-0.07, 0.14], [-0.13, 0.16], [-0.16, 0.06], [-0.16, 0]]);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-L * 0.16, 0);
    ctx.lineTo(-L * 0.40, 0);
    ctx.stroke();

    drawF1RearWing(color, braking);
}

/**
 * Aileron traseiro: plano principal e flap na cor do carro, entre dois
 * endplates de carbono. Mais estreito do que as rodas, como num F1, e por cima
 * do corpo (visto de cima tapa a traseira). As luzes — a de chuva, ao centro,
 * e as dos endplates — acendem a travar.
 */
function drawF1RearWing(color, braking) {
    const span = hw * 0.62;

    ctx.fillStyle = 'rgba(6, 9, 20, 0.35)';
    rrect(-L * 0.50, -span + 3, L * 0.10, span * 2, 2);
    ctx.fill();

    rrect(-L * 0.51, -span, L * 0.10, span * 2, 1.5);
    paintBodyPart(color, span);
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-L * 0.465, -span);
    ctx.lineTo(-L * 0.465, span);
    ctx.stroke();

    ctx.fillStyle = CARBON;
    for (const s of [1, -1]) {
        rrect(-L * 0.53, s > 0 ? span - 1 : -span - 1.6, L * 0.14, 2.6, 1);
        ctx.fill();
    }

    brakeLight(braking, () => {
        rrect(-L * 0.55, -hw * 0.12, L * 0.035, hw * 0.24, 1);
        ctx.fill();
        if (!braking) return;
        for (const s of [1, -1]) {
            rrect(-L * 0.545, s > 0 ? span - 0.8 : -span - 1.2, L * 0.03, 2, 0.8);
            ctx.fill();
        }
    });
}

// ---------- 911 GT ----------

/**
 * A planta de um 911 GT3: nariz estreito e arredondado com os faróis ovais
 * nos cantos, guarda-lamas da frente a abrir sobre as rodas, cintura nas
 * portas e as ancas traseiras — a parte mais larga do carro — por cima do
 * motor. São as ancas a alargar para trás, de cada lado de um habitáculo
 * estreito, que fazem um 911 parecer um 911 visto de cima.
 */
const GT_BODY = [
    [0.49, 0], [0.5, 0.24], [0.48, 0.5], [0.43, 0.66], [0.34, 0.74],
    [0.22, 0.74], [0.12, 0.69], [-0.02, 0.71], [-0.14, 0.86], [-0.26, 0.98],
    [-0.36, 0.98], [-0.44, 0.9], [-0.49, 0.74], [-0.5, 0.45], [-0.5, 0]
];

function drawGT({ color, steer, lean, braking }) {
    shadow(0.5, 0.5, hw * 0.92, hw * 0.7);

    for (const s of [1, -1]) {
        drawWheel(L * 0.29, s * hw * 0.68, L * 0.17, W * 0.15, steer);
        drawWheel(-L * 0.3, s * hw * 0.84, L * 0.19, W * 0.2, 0);
    }

    ctx.transform(1, 0, lean, 1, 0, 0);

    // Duas riscas de corrida do nariz à traseira, e as ancas com mais luz do
    // que o resto, para se lerem como a parte que sobressai.
    shadedBody(() => symPath(GT_BODY), color, hw * 0.93, () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(-L * 0.5, -hw * 0.17, L, hw * 0.1);
        ctx.fillRect(-L * 0.5, hw * 0.07, L, hw * 0.1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        for (const s of [1, -1]) {
            ctx.beginPath();
            ctx.ellipse(-L * 0.3, s * hw * 0.76, L * 0.13, hw * 0.14, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // O habitáculo é mais estreito do que a carroçaria: um contorno ténue do
    // para-brisas ao vidro de trás separa-o das ancas.
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.35)';
    ctx.lineWidth = 0.8;
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(L * 0.17, s * hw * 0.6);
        ctx.quadraticCurveTo(-L * 0.02, s * hw * 0.62, -L * 0.28, s * hw * 0.4);
        ctx.stroke();
    }

    // Capô: o vinco ao meio e as duas entradas de ar do GT3 RS.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.8)';
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(L * 0.34, s * hw * 0.16);
        ctx.lineTo(L * 0.34, s * hw * 0.26);
        ctx.lineTo(L * 0.25, s * hw * 0.32);
        ctx.lineTo(L * 0.25, s * hw * 0.2);
        ctx.closePath();
        ctx.fill();
    }
    // Guelras em cima dos guarda-lamas da frente.
    ctx.strokeStyle = 'rgba(8, 10, 18, 0.7)';
    ctx.lineWidth = 0.9;
    for (const s of [1, -1]) {
        for (let i = 0; i < 3; i++) {
            const x = L * (0.25 + i * 0.03);
            ctx.beginPath();
            ctx.moveTo(x, s * hw * 0.5);
            ctx.lineTo(x, s * hw * 0.64);
            ctx.stroke();
        }
    }

    // Os faróis ovais nos cantos da frente, ligeiramente virados para fora.
    for (const s of [1, -1]) {
        ctx.save();
        ctx.translate(L * 0.415, s * hw * 0.52);
        ctx.rotate(s * 0.55);
        ctx.fillStyle = 'rgba(8, 10, 18, 0.75)';
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.05, hw * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 249, 224, 0.95)';
        ctx.beginPath();
        ctx.ellipse(L * 0.006, 0, L * 0.036, hw * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Espelhos, à frente das portas.
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.ellipse(L * 0.09, s * hw * 0.78, L * 0.022, hw * 0.1, s * 0.3, 0, Math.PI * 2);
        paintBodyPart(color, hw * 0.1);
    }

    // Para-brisas grande, tejadilho e o vidro de trás a descer para o motor.
    const glass = ctx.createLinearGradient(0, -hw * 0.6, 0, hw * 0.6);
    glass.addColorStop(0, '#3a4d72');
    glass.addColorStop(0.5, '#16213a');
    glass.addColorStop(1, '#0c1222');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(L * 0.05, -hw * 0.52);
    ctx.lineTo(L * 0.16, -hw * 0.6);
    ctx.quadraticCurveTo(L * 0.2, 0, L * 0.16, hw * 0.6);
    ctx.lineTo(L * 0.05, hw * 0.52);
    ctx.quadraticCurveTo(L * 0.065, 0, L * 0.05, -hw * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-L * 0.15, -hw * 0.5);
    ctx.quadraticCurveTo(-L * 0.165, 0, -L * 0.15, hw * 0.5);
    ctx.lineTo(-L * 0.27, hw * 0.34);
    ctx.quadraticCurveTo(-L * 0.285, 0, -L * 0.27, -hw * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(L * 0.11, -hw * 0.5, L * 0.02, hw * 0.34);

    // Grelha da tampa do motor, entre o vidro de trás e a asa.
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.65)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
        const x = -L * (0.3 + i * 0.022);
        ctx.beginPath();
        ctx.moveTo(x, -hw * 0.3);
        ctx.lineTo(x, hw * 0.3);
        ctx.stroke();
    }

    // Faixa de luz a toda a largura da traseira, como nos 911 de agora.
    brakeLight(braking, () => {
        rrect(-L * 0.5, -hw * 0.64, L * 0.022, hw * 1.28, 1);
        ctx.fill();
    });

    // A asa "pescoço de cisne", quase da largura do carro, com endplates.
    ctx.fillStyle = 'rgba(6, 9, 20, 0.35)';
    rrect(-L * 0.46, -hw * 0.86 + 3, L * 0.085, hw * 1.72, 2);
    ctx.fill();
    rrect(-L * 0.465, -hw * 0.86, L * 0.085, hw * 1.72, 1.5);
    paintBodyPart(color, hw * 0.86);
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-L * 0.425, -hw * 0.84);
    ctx.lineTo(-L * 0.425, hw * 0.84);
    ctx.stroke();
    ctx.fillStyle = CARBON;
    for (const s of [1, -1]) {
        rrect(-L * 0.48, s > 0 ? hw * 0.82 : -hw * 0.96, L * 0.115, hw * 0.14, 1);
        ctx.fill();
    }
}

// ---------- Kart ----------

/** Carenagem dianteira do kart, larga e baixa, com o porta-números ao centro. */
const KART_NOSE = [[0.45, 0], [0.45, 0.34], [0.42, 0.60], [0.35, 0.66], [0.31, 0.34], [0.30, 0]];

function drawKart({ color, steer }) {
    shadow(0.46, 0.44, hw * 0.92, hw * 0.4);

    // Chassis tubular: é o que se vê de um kart entre as rodas.
    ctx.strokeStyle = '#8f98ab';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(L * 0.32, -hw * 0.30);
    ctx.lineTo(L * 0.14, -hw * 0.44);
    ctx.lineTo(-L * 0.32, -hw * 0.44);
    ctx.lineTo(-L * 0.32, hw * 0.44);
    ctx.lineTo(L * 0.14, hw * 0.44);
    ctx.lineTo(L * 0.32, hw * 0.30);
    ctx.closePath();
    ctx.stroke();

    // Eixo traseiro inteiro, de roda a roda; à frente, as mangas de cada lado.
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-L * 0.27, -hw * 0.8);
    ctx.lineTo(-L * 0.27, hw * 0.8);
    for (const s of [1, -1]) {
        ctx.moveTo(L * 0.25, s * hw * 0.34);
        ctx.lineTo(L * 0.25, s * hw * 0.7);
    }
    ctx.stroke();

    for (const s of [1, -1]) {
        drawWheel(L * 0.25, s * hw * 0.72, L * 0.14, W * 0.2, steer);
        drawWheel(-L * 0.27, s * hw * 0.72, L * 0.16, W * 0.28, 0);
    }

    // Para-choques traseiro, a proteger as rodas de trás.
    ctx.fillStyle = CARBON;
    rrect(-L * 0.44, -hw * 0.8, L * 0.045, hw * 1.6, 1.5);
    ctx.fill();

    // Pontões laterais e carenagem da frente, na cor do carro.
    for (const s of [1, -1]) {
        rrect(-L * 0.15, s > 0 ? hw * 0.48 : -hw * 0.92, L * 0.28, hw * 0.44, hw * 0.18);
        paintBodyPart(color, hw * 0.92);
    }
    symPath(KART_NOSE);
    paintBodyPart(color, hw * 0.66);
    ctx.fillStyle = 'rgba(245, 247, 255, 0.92)';
    rrect(L * 0.34, -hw * 0.22, L * 0.07, hw * 0.44, 2);
    ctx.fill();

    // Motor ao lado do banco, com o escape a fugir para trás.
    ctx.fillStyle = '#4a5162';
    rrect(-L * 0.25, hw * 0.12, L * 0.12, hw * 0.28, 2);
    ctx.fill();
    ctx.strokeStyle = '#c9ced8';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-L * 0.25, hw * 0.3);
    ctx.quadraticCurveTo(-L * 0.36, hw * 0.34, -L * 0.38, hw * 0.08);
    ctx.stroke();

    // Banco, piloto (ombros, braços ao volante) e capacete.
    ctx.fillStyle = '#0d1018';
    rrect(-L * 0.22, -hw * 0.3, L * 0.22, hw * 0.6, 3);
    ctx.fill();
    ctx.fillStyle = '#2a3042';
    ctx.beginPath();
    ctx.ellipse(-L * 0.08, 0, L * 0.06, hw * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a3042';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-L * 0.06, -hw * 0.34);
    ctx.lineTo(L * 0.1, -hw * 0.2);
    ctx.moveTo(-L * 0.06, hw * 0.34);
    ctx.lineTo(L * 0.1, hw * 0.2);
    ctx.stroke();
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(L * 0.11, 0, L * 0.015, hw * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawHelmet(-L * 0.05, 0, hw * 0.25, color);
}

// ---------- Jeep ----------

/** Capô estreito à frente, banheira mais larga atrás: o desenho de um Willys. */
const JEEP_BODY = [
    [0.43, 0], [0.43, 0.48], [0.40, 0.52], [0.13, 0.54], [0.11, 0.64],
    [-0.42, 0.64], [-0.44, 0.60], [-0.44, 0]
];

/** Estrela branca de cinco pontas, como a do capô dos jeeps antigos. */
function star(x, y, r) {
    ctx.beginPath();
    // Começa no ângulo 0 para a ponta ficar virada para a frente do carro (+x).
    for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.42 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
}

function drawJeep({ color, steer, lean, braking }) {
    shadow(0.46, 0.5, hw * 0.92, hw * 0.3);

    for (const s of [1, -1]) {
        drawWheel(L * 0.27, s * hw * 0.76, L * 0.21, W * 0.25, steer, true);
        drawWheel(-L * 0.27, s * hw * 0.76, L * 0.21, W * 0.25, 0, true);
    }

    // Pneu sobresselente pendurado na traseira.
    ctx.fillStyle = '#12141c';
    rrect(-L * 0.51, -hw * 0.36, L * 0.07, hw * 0.72, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-L * 0.505, -hw * 0.3 + i * hw * 0.19, L * 0.06, 1.1);

    ctx.transform(1, 0, lean, 1, 0, 0);

    shadedBody(() => symPoly(JEEP_BODY), color, hw * 0.64, () => {
        // Vinco ao meio do capô.
        ctx.fillStyle = 'rgba(6, 9, 20, 0.22)';
        ctx.fillRect(L * 0.14, -0.5, L * 0.3, 1);
    });

    // Guarda-lamas da frente, planos e por cima das rodas.
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(L * 0.42, s * hw * 0.5);
        ctx.lineTo(L * 0.38, s * hw * 0.92);
        ctx.lineTo(L * 0.15, s * hw * 0.92);
        ctx.lineTo(L * 0.13, s * hw * 0.52);
        ctx.closePath();
        paintBodyPart(color, hw * 0.92);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fill();
    }

    // Grelha e faróis redondos à frente.
    ctx.fillStyle = CARBON;
    rrect(L * 0.415, -hw * 0.44, L * 0.03, hw * 0.88, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 249, 224, 0.95)';
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.arc(L * 0.425, s * hw * 0.3, hw * 0.11, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    star(L * 0.28, 0, hw * 0.22);
    ctx.fill();

    // Para-brisas rebatível: moldura e vidro.
    ctx.fillStyle = CARBON;
    rrect(L * 0.09, -hw * 0.64, L * 0.045, hw * 1.28, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(170, 215, 255, 0.55)';
    ctx.fillRect(L * 0.1, -hw * 0.56, L * 0.025, hw * 1.12);

    // Banheira aberta: bancos da frente, banco de trás e o arco de proteção.
    ctx.fillStyle = '#151923';
    rrect(-L * 0.40, -hw * 0.54, L * 0.48, hw * 1.08, 2);
    ctx.fill();
    ctx.fillStyle = '#5a4630';
    for (const s of [1, -1]) {
        rrect(-L * 0.12, s > 0 ? hw * 0.08 : -hw * 0.46, L * 0.14, hw * 0.38, 2);
        ctx.fill();
    }
    rrect(-L * 0.37, -hw * 0.44, L * 0.1, hw * 0.88, 2);
    ctx.fill();
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-L * 0.2, -hw * 0.62);
    ctx.lineTo(-L * 0.2, hw * 0.62);
    ctx.stroke();

    // Condutor do lado esquerdo, com o volante à frente.
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(L * 0.06, -hw * 0.27, L * 0.015, hw * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawHelmet(-L * 0.04, -hw * 0.27, hw * 0.22, color);

    brakeLight(braking, () => {
        for (const s of [1, -1]) {
            rrect(-L * 0.45, s > 0 ? hw * 0.42 : -hw * 0.58, L * 0.025, hw * 0.16, 1);
            ctx.fill();
        }
    });
}

const DRAWERS = { f1: drawF1, gt: drawGT, kart: drawKart, jeep: drawJeep };

/**
 * Desenha o carro na origem do contexto, virado para +x.
 *
 * O inclinar da carroçaria nas curvas (`lean`) e a direção das rodas da frente
 * saem do volante e da velocidade do próprio carro; numa miniatura parada não
 * há nem uma coisa nem outra.
 */
export function drawCarSprite(target, car) {
    ctx = target;
    const speedFrac = clamp(car.speed / MAX_SPEED, 0, 1.4);
    const pose = {
        color: car.color,
        steer: car.steerInput * 0.38,
        lean: clamp(car.steerInput * Math.min(1, speedFrac) * 0.1, -0.12, 0.12),
        braking: car.brakeHeld && car.speed > 0
    };
    ctx.save();
    (DRAWERS[car.type] || drawF1)(pose);
    ctx.restore();
}

// ---------- Vistas de lado (garagem) ----------
//
// Na garagem os carros mostram-se de perfil, que é como se reconhece um carro
// à primeira: a vista de cima é a da corrida, mas um 911 só é um 911 com o
// tejadilho a descer em fastback, e um jeep só é um jeep com o para-brisas
// direito e os guarda-lamas planos.
//
// Cada perfil desenha-se em unidades próprias: o carro tem 100 de comprido,
// de x = -50 (traseira) a x = 50 (frente, virada para a direita), e o chão
// está em y = 0, com a altura para cima (y negativo). `SIDE_BOX` diz quanto
// cada um ocupa, para a miniatura o encaixar no cartão.

const SIDE_BOX = {
    f1: { minX: -52, maxX: 52, top: -21 },
    gt: { minX: -52, maxX: 51, top: -34 },
    kart: { minX: -51, maxX: 52, top: -40 },
    jeep: { minX: -53, maxX: 51, top: -51 }
};

/** Curva suave pelos pontos dados (os do meio são de controlo), a continuar o caminho atual. */
function curveThrough(pts) {
    for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        const [nx, ny] = pts[i + 1];
        const last = i === pts.length - 2;
        ctx.quadraticCurveTo(x, y, last ? nx : (x + nx) / 2, last ? ny : (y + ny) / 2);
    }
}

/**
 * Cava da roda na linha de baixo da carroçaria: um arco por cima da roda,
 * da esquerda para a direita, entre os dois pontos onde corta a altura `y`.
 */
function wheelArch(cx, cy, r, y) {
    const a = Math.asin(clamp((y - cy) / r, -1, 1));
    ctx.arc(cx, cy, r, Math.PI - a, a, false);
}

/** Pintura de volume dos perfis: luz de cima, sombra junto ao chão. */
function sideShade(top, bottom) {
    const shade = ctx.createLinearGradient(0, top, 0, bottom);
    shade.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    shade.addColorStop(0.35, 'rgba(255, 255, 255, 0.06)');
    shade.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
    return shade;
}

/** Pinta o caminho atual com a cor do carro, o volume dos perfis e o contorno. */
function paintSide(color, top, bottom) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = sideShade(top, bottom);
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.7)';
    ctx.stroke();
}

/**
 * Roda de perfil: pneu, jante com raios, porca central e, se houver, a pinça
 * do travão a espreitar por entre os raios.
 */
function sideWheel(cx, r, { rim = '#c5ccd8', rimR = 0.66, spokes = 10, caliper = null, knobby = false } = {}) {
    const cy = -r;
    ctx.fillStyle = '#12141c';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (knobby) {
        ctx.fillStyle = '#12141c';
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.rotate(a);
            ctx.fillRect(-0.6, -1.4, 1.4, 2.8);
            ctx.restore();
        }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();

    const rr = r * rimR;
    ctx.fillStyle = '#2b303c';
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
    if (caliper) {
        ctx.strokeStyle = caliper;
        ctx.lineWidth = rr * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, rr * 0.62, -Math.PI * 0.95, -Math.PI * 0.6);
        ctx.stroke();
    }
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(0.6, rr * 0.16);
    ctx.lineCap = 'round';
    for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rr * 0.25, cy + Math.sin(a) * rr * 0.25);
        ctx.lineTo(cx + Math.cos(a) * rr * 0.95, cy + Math.sin(a) * rr * 0.95);
        ctx.stroke();
    }
    ctx.lineWidth = rr * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.94, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.24, 0, Math.PI * 2);
    ctx.fill();
}

/** Capacete de perfil, a olhar para a frente (+x). */
function sideHelmet(x, y, r, color) {
    ctx.fillStyle = 'rgba(240, 244, 255, 0.97)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x - r, y - r * 0.15, r * 2, r * 0.32);
    ctx.fillStyle = 'rgba(12, 16, 28, 0.85)';
    ctx.fillRect(x + r * 0.15, y - r * 0.55, r, r * 0.42);
    ctx.restore();
}

function groundShadow(minX, maxX) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse((minX + maxX) / 2, 0, (maxX - minX) / 2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
}

// ---------- 911 GT de perfil ----------

function sideGT(color) {
    const fw = 31, rw = -24, r = 7.6, R = 9.3, sill = -3.6;
    groundShadow(-50, 50);

    // Asa: os dois pescoços de cisne saem de cima da tampa do motor e
    // seguram o plano por cima, em gancho.
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (const x of [-38, -43]) {
        ctx.beginPath();
        ctx.moveTo(x, -17.4);
        ctx.quadraticCurveTo(x + 1.6, -25, x - 1.6, -29.6);
        ctx.stroke();
    }

    // Carroçaria: frente baixa, guarda-lamas alto com o farol, tejadilho a
    // descer em fastback contínuo até à traseira em bico de pato.
    ctx.beginPath();
    ctx.moveTo(48.5, sill);
    curveThrough([
        [48.5, sill], [50.2, -5], [50.2, -8.6], [48, -11.6], [44, -13.6], [38, -15.8],
        [31, -16.5], [24, -16.8], [15, -17.6], [9, -21.6], [3, -25.6], [-6, -27.2],
        [-14, -26.6], [-22, -23.8], [-31, -20], [-39, -17.6], [-45, -16.9], [-49.2, -15.6],
        [-50.4, -12], [-50.2, -6], [-48.5, sill]
    ]);
    wheelArch(rw, -r, R, sill);
    wheelArch(fw, -r, R, sill);
    ctx.closePath();
    paintSide(color, -27, sill);

    // Linha de cintura, mais clara: dá o vinco da carroçaria.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(44, -12.6);
    ctx.quadraticCurveTo(10, -15.6, -44, -14.6);
    ctx.stroke();

    // Janelas laterais em "D" e o pilar do meio na cor do carro.
    const glass = ctx.createLinearGradient(0, -26, 0, -18);
    glass.addColorStop(0, '#3a4d72');
    glass.addColorStop(1, '#0e1526');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(13.5, -18.4);
    curveThrough([[13.5, -18.4], [4.5, -24.7], [-6, -26], [-13.5, -25.3], [-21, -21.6], [-23, -19.6]]);
    ctx.lineTo(-10, -18.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9.5, -18.6);
    ctx.lineTo(-9.5, -25.8);
    ctx.stroke();

    // Porta, puxador, espelho.
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.45)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(15, -17.4);
    ctx.quadraticCurveTo(13.4, -10, 14, -4.6);
    ctx.lineTo(-10, -4.6);
    ctx.lineTo(-10.4, -18.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(6, 9, 20, 0.55)';
    rrect(-7, -15.4, 3.2, 0.9, 0.45);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14.5, -18.6);
    ctx.quadraticCurveTo(12, -21.4, 9.6, -20.2);
    ctx.lineTo(10.6, -18.4);
    ctx.closePath();
    paintSide(color, -21.4, -18.4);

    // Entrada de ar atrás da porta e farol em cima do guarda-lamas.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-12.6, -17.2);
    ctx.lineTo(-18.6, -17.6);
    ctx.quadraticCurveTo(-20.4, -15, -19.6, -12.4);
    ctx.lineTo(-13.6, -13);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(42, -14.2);
    ctx.rotate(-0.28);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.7)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 249, 224, 0.95)';
    ctx.beginPath();
    ctx.ellipse(0.5, 0, 2.5, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Entrada de ar do para-choques, splitter, embaladeira e difusor em carbono.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.85)';
    rrect(43, -8.4, 6.4, 2.4, 1);
    ctx.fill();
    ctx.fillStyle = CARBON;
    ctx.fillRect(36, -3.4, 15, 1.1);
    ctx.fillRect(rw + R, -5, fw - R - (rw + R), 1.6);
    ctx.fillRect(-50.5, -5.2, 10, 1.8);

    // Farolim e o plano da asa, com o endplate.
    ctx.fillStyle = '#d23a32';
    rrect(-50.6, -14.2, 3.4, 1.2, 0.5);
    ctx.fill();
    ctx.save();
    ctx.translate(-44, -30.6);
    ctx.rotate(0.06);
    rrect(-7, -1.2, 14.4, 2.4, 1);
    paintSide(color, -1.2, 1.2);
    ctx.fillStyle = CARBON;
    rrect(-7.6, -2.6, 3, 5, 0.8);
    ctx.fill();
    ctx.restore();

    sideWheel(fw, r, { caliper: '#f4b400' });
    sideWheel(rw, r, { caliper: '#f4b400' });
}

// ---------- Fórmula 1 de perfil ----------

function sideF1(color) {
    const fw = 32, rw = -28;
    groundShadow(-50, 51);

    // Fundo plano e asa traseira (por trás das rodas).
    ctx.fillStyle = CARBON;
    ctx.fillRect(-42, -3.6, 68, 1.4);
    rrect(-51.5, -19.5, 9, 3.2, 0.8);
    ctx.fill();
    rrect(-50, -10.5, 7, 1.6, 0.6);
    ctx.fill();

    // Braços de suspensão, das rodas ao chassis.
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(fw, -6.6); ctx.lineTo(18, -8.6);
    ctx.moveTo(fw, -6.6); ctx.lineTo(20, -5);
    ctx.moveTo(rw, -7); ctx.lineTo(-16, -8);
    ctx.moveTo(rw, -7); ctx.lineTo(-18, -4.6);
    ctx.stroke();

    // Chassis: nariz fino e comprido, habitáculo, airbox por cima do piloto e
    // a tampa do motor a descer até à asa.
    ctx.beginPath();
    ctx.moveTo(47, -4.4);
    curveThrough([
        [47, -4.4], [46, -5.8], [38, -7.4], [26, -9.4], [15, -11.6], [9, -11.4],
        [2, -11.8], [-1.5, -13], [-3, -19.6], [-8, -19.6], [-13, -15], [-24, -11.6],
        [-34, -8.8], [-42, -7.4], [-44.6, -6], [-44.6, -3.6]
    ]);
    ctx.lineTo(20, -3.6);
    ctx.quadraticCurveTo(38, -3.6, 47, -4.4);
    ctx.closePath();
    paintSide(color, -19.6, -3.6);

    // Sidepod com a entrada de ar à frente.
    ctx.beginPath();
    ctx.moveTo(13, -9.6);
    ctx.quadraticCurveTo(-4, -10.6, -20, -6.4);
    ctx.lineTo(-20, -3.8);
    ctx.lineTo(13, -3.8);
    ctx.closePath();
    paintSide(color, -10.6, -3.8);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.9)';
    rrect(11.4, -9.4, 1.8, 5, 0.8);
    ctx.fill();

    // Entrada do airbox, número e risca branca no nariz.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.9)';
    rrect(-3.4, -19, 1.6, 3.4, 0.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(44, -5.6);
    ctx.lineTo(22, -9.2);
    ctx.lineTo(22, -8.2);
    ctx.lineTo(44, -5);
    ctx.closePath();
    ctx.fill();

    // Piloto e halo.
    sideHelmet(3.4, -13.8, 2.8, color);
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(12, -11.8);
    ctx.quadraticCurveTo(9, -16, 3, -16.2);
    ctx.lineTo(-2, -15.4);
    ctx.stroke();

    // Asa dianteira, endplates e luz de chuva.
    ctx.fillStyle = CARBON;
    ctx.fillRect(39, -2.4, 13, 1.2);
    rrect(45.5, -5.4, 6.4, 4.2, 0.8);
    paintSide(color, -5.4, -1.2);
    rrect(-51.5, -20.5, 8.4, 15, 1);
    paintSide(color, -20.5, -5.5);
    ctx.fillStyle = '#d23a32';
    rrect(-47, -8.6, 2, 1.4, 0.4);
    ctx.fill();

    sideWheel(fw, 6.6, { rim: color, rimR: 0.6, spokes: 0 });
    sideWheel(rw, 7, { rim: color, rimR: 0.6, spokes: 0 });
}

// ---------- Kart de perfil ----------

function sideKart(color) {
    const fw = 31, rw = -31;
    groundShadow(-48, 50);

    sideWheel(rw, 7.8, { rimR: 0.55, spokes: 6 });

    // Chassis tubular e para-choques de trás.
    ctx.strokeStyle = '#9aa3b5';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, -3.6);
    ctx.lineTo(-38, -3.6);
    ctx.quadraticCurveTo(-50, -4, -48, -10);
    ctx.stroke();

    // Motor, ao lado do banco, com o escape a fugir para trás.
    ctx.fillStyle = '#4a5162';
    rrect(-25, -16, 11, 11, 1.5);
    ctx.fill();
    ctx.fillStyle = '#6b7385';
    for (let i = 0; i < 3; i++) ctx.fillRect(-24, -15 + i * 2.2, 9, 1);
    ctx.strokeStyle = '#c9ced8';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-21, -15.5);
    ctx.quadraticCurveTo(-30, -20, -38, -13);
    ctx.stroke();

    // Banco e o piloto sentado, de pernas esticadas até aos pedais.
    ctx.fillStyle = '#0d1018';
    ctx.beginPath();
    ctx.moveTo(-2, -4.6);
    ctx.quadraticCurveTo(-12, -4.6, -14, -22);
    ctx.lineTo(-10, -22.6);
    ctx.quadraticCurveTo(-8, -8, 2, -7.6);
    ctx.closePath();
    ctx.fill();

    const suit = (part) => { part(); ctx.fillStyle = color; ctx.fill(); ctx.fillStyle = 'rgba(6, 9, 20, 0.22)'; ctx.fill(); };
    suit(() => {
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(16, -14);
        ctx.lineTo(30, -9.6);
        ctx.lineTo(29.4, -7);
        ctx.lineTo(15, -10.4);
        ctx.lineTo(-4, -5);
        ctx.closePath();
    });
    suit(() => {
        rrect(-11.4, -29, 7.2, 22, 3.4);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-6, -25);
    ctx.lineTo(4, -19);
    ctx.lineTo(13.6, -20.4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(6, 9, 20, 0.3)';
    ctx.stroke();

    // Coluna e volante.
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(15, -20);
    ctx.lineTo(30, -6);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(14.6, -20.6, 1.2, 4.6, -0.5, 0, Math.PI * 2);
    ctx.stroke();

    sideHelmet(-6.4, -33.4, 5.6, color);

    // Pontão lateral e carenagem da frente, com o porta-números.
    rrect(-19, -9.4, 36, 5.6, 2.6);
    paintSide(color, -9.4, -3.8);
    ctx.beginPath();
    ctx.moveTo(51.5, -4.2);
    curveThrough([[51.5, -4.2], [50.5, -10], [42, -14.2], [33, -13.4], [33.6, -4.2]]);
    ctx.closePath();
    paintSide(color, -14.2, -4.2);
    ctx.fillStyle = 'rgba(245, 247, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(42.6, -9.4, 3.8, 2.8, -0.35, 0, Math.PI * 2);
    ctx.fill();

    sideWheel(fw, 7, { rimR: 0.55, spokes: 6 });
}

// ---------- Jeep de perfil ----------

function sideJeep(color) {
    const fw = 30, rw = -30, r = 10.4, base = -13;
    groundShadow(-50, 50);

    // Roda sobresselente, de lado, pendurada na traseira.
    ctx.fillStyle = '#12141c';
    rrect(-53, -34, 5, 21, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let i = 0; i < 6; i++) ctx.fillRect(-52.6, -32 + i * 3.4, 4.2, 0.8);

    // Longarina do chassis por baixo da carroçaria.
    ctx.fillStyle = CARBON;
    ctx.fillRect(-47, -15.4, 94, 3.2);

    // Arco de proteção, por trás do condutor.
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -30.5);
    ctx.lineTo(-21, -44);
    ctx.lineTo(-31, -44);
    ctx.lineTo(-32, -30.5);
    ctx.stroke();

    // Condutor: tronco e capacete por cima da banheira, volante à frente.
    ctx.fillStyle = '#2a3042';
    rrect(-9, -37, 8, 8, 2.4);
    ctx.fill();
    sideHelmet(-4.6, -40.4, 4.4, color);
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(4.6, -34, 1, 3.6, -0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Capô, banheira com o recorte da porta e a cava da roda de trás.
    ctx.beginPath();
    ctx.moveTo(46.4, -21);
    ctx.lineTo(46.4, -29.4);
    ctx.lineTo(10, -30.6);
    ctx.lineTo(7.4, -30.6);
    ctx.quadraticCurveTo(5, -23, 1, -22.6);
    ctx.lineTo(-11, -22.6);
    ctx.quadraticCurveTo(-15, -23, -16.6, -30.6);
    ctx.lineTo(-48.4, -30.6);
    ctx.lineTo(-48.4, base);
    wheelArch(rw, -r, r + 1.6, base);
    ctx.lineTo(10, base);
    ctx.lineTo(10, -21);
    ctx.closePath();
    paintSide(color, -30.6, base);

    // Guarda-lamas plano da frente, a descer para o estribo.
    ctx.beginPath();
    ctx.moveTo(48.4, -19.4);
    ctx.lineTo(47, -22.2);
    ctx.lineTo(15.6, -22.2);
    ctx.lineTo(8.4, -13.2);
    ctx.lineTo(12.4, -13.2);
    ctx.lineTo(18.6, -19.4);
    ctx.closePath();
    paintSide(color, -22.2, -13.2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fill();

    // Para-brisas direito, grelha, farol, estrela e farolim.
    ctx.fillStyle = CARBON;
    ctx.beginPath();
    ctx.moveTo(10.2, -30.6);
    ctx.lineTo(12.4, -30.6);
    ctx.lineTo(9.4, -50);
    ctx.lineTo(7.2, -50);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(46.2, -29.4, 1.6, 8.4);
    ctx.fillStyle = 'rgba(255, 249, 224, 0.95)';
    ctx.beginPath();
    ctx.arc(47, -25.2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    star(28, -26, 3);
    ctx.fill();
    ctx.fillStyle = '#d23a32';
    rrect(-49.2, -27.6, 1.4, 2.6, 0.4);
    ctx.fill();

    // Para-choques.
    ctx.fillStyle = CARBON;
    ctx.fillRect(44, -17.4, 6, 2.4);
    ctx.fillRect(-50.4, -15.4, 4, 2.2);

    sideWheel(fw, r, { rim: color, rimR: 0.52, spokes: 5, knobby: true });
    sideWheel(rw, r, { rim: color, rimR: 0.52, spokes: 5, knobby: true });
}

const SIDE_DRAWERS = { f1: sideF1, gt: sideGT, kart: sideKart, jeep: sideJeep };

/**
 * Desenha o carro de perfil, virado para a direita, a ocupar a caixa
 * `w` × `h` do contexto com o chão um pouco acima do fundo.
 */
export function drawCarSide(target, typeId, color, w, h) {
    ctx = target;
    const box = SIDE_BOX[typeId] || SIDE_BOX.f1;
    const scale = Math.min((w * 0.88) / (box.maxX - box.minX), (h * 0.8) / -box.top);
    ctx.save();
    ctx.translate(w / 2 - ((box.minX + box.maxX) / 2) * scale, h * 0.88);
    ctx.scale(scale, scale);
    (SIDE_DRAWERS[typeId] || sideF1)(color);
    ctx.restore();
}
