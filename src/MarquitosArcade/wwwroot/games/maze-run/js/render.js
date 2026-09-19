// Desenho do labirinto, de quem lá anda e do HUD.
//
// O labirinto não se redesenha a cada frame: as paredes e o chão vão uma vez
// para um canvas à parte e dali são copiadas inteiras (ver `paintMaze`). Só se
// refaz quando muda o nível ou o tamanho de uma célula — e assim um labirinto
// grande custa o mesmo que um pequeno, que é o que mantém o jogo fluido num
// telemóvel.
//
// As paredes desenham-se pelas arestas e não pelos blocos: para cada célula de
// chão, os lados que dão para parede levam um risco de néon. Um corredor fica
// contornado a luz, como nos labirintos de sala de jogos, em vez de um tabuleiro
// de quadrados encostados.

import { clamp } from '/lib/arcade/index.js';

import { FONT_BODY, FONT_DISPLAY, MAX_STARS } from './config.js';
import { fmtClock } from './format.js';
import { game } from './state.js';
import { walkerPos } from './walker.js';

/** Limites do lado de uma célula, em píxeis lógicos. */
const MIN_CELL = 17;
const MAX_CELL = 44;

/** Altura do painel de vidro do HUD. */
const HUD_HEIGHT = 56;
const HUD_MAX_WIDTH = 460;
const EDGE_PAD = 12;

let ctx = null;
let view = null;

/** Canvas onde o labirinto fica pintado, e a chave do que lá está. */
let mazeCanvas = null;
let mazeKey = '';

export function initRenderer(viewport) {
    view = viewport;
    ctx = viewport.ctx;
}

/** O labirinto que está à vista: o do nível a jogar, ou o que o menu mostra por trás do vidro. */
const activeLayout = () => game.layout || game.menuLayout;

/** A cor do nível à vista. */
const accent = () => (activeLayout()?.level?.accent) || '#35e0ff';

// ---------- Enquadramento ----------

/**
 * Decide o tamanho de uma célula e onde fica o canto do labirinto. Chamado ao
 * montar um nível e a cada remedição do viewport.
 *
 * Primeiro tenta-se que o labirinto inteiro caiba no ecrã — é sempre melhor ver
 * o mapa todo do que andar com a câmara atrás do jogador. Só quando isso
 * obrigaria a células pequenas de mais (labirintos grandes em ecrãs pequenos) é
 * que a câmara passa a seguir quem joga.
 */
export function layoutMaze() {
    const layout = activeLayout();
    if (!layout || !view) return;

    const { cols, rows } = layout.maze;
    const top = mazeTop();
    const availableWidth = view.width - EDGE_PAD * 2 - view.safeArea.left - view.safeArea.right;
    const availableHeight = view.height - top - Math.max(view.safeArea.bottom, EDGE_PAD);

    const fit = Math.min(availableWidth / cols, availableHeight / rows);
    game.cell = clamp(Math.floor(fit), MIN_CELL, MAX_CELL);
    game.follow = fit < MIN_CELL;

    game.origin.x = view.safeArea.left + EDGE_PAD + (availableWidth - cols * game.cell) / 2;
    game.origin.y = top + (availableHeight - rows * game.cell) / 2;

    paintMaze();
}

/** Onde acaba o HUD e pode começar o labirinto. */
const mazeTop = () => (view ? view.topInset + HUD_HEIGHT + 10 : 0);

/**
 * Com a câmara a seguir, o canto do labirinto anda com o jogador — travado nos
 * bordos, para nunca se ver o vazio para lá da moldura.
 */
function cameraOrigin() {
    const layout = activeLayout();
    if (!game.follow || !layout || !game.player) return game.origin;

    const { cols, rows } = layout.maze;
    const cell = game.cell;
    const pos = walkerPos(game.player);
    const top = mazeTop();
    const viewWidth = view.width - view.safeArea.left - view.safeArea.right - EDGE_PAD * 2;
    const viewHeight = view.height - top - Math.max(view.safeArea.bottom, EDGE_PAD);

    const x = clamp(
        view.safeArea.left + EDGE_PAD + viewWidth / 2 - (pos.x + 0.5) * cell,
        view.safeArea.left + EDGE_PAD + Math.min(0, viewWidth - cols * cell),
        view.safeArea.left + EDGE_PAD
    );
    const y = clamp(
        top + viewHeight / 2 - (pos.y + 0.5) * cell,
        top + Math.min(0, viewHeight - rows * cell),
        top
    );

    return { x, y };
}

// ---------- O labirinto, pintado uma vez ----------

function paintMaze() {
    const layout = activeLayout();
    if (!layout) return;

    const { maze } = layout;
    const cell = game.cell;
    const dpr = view.dpr;
    const key = `${layout.level.id}:${maze.cols}x${maze.rows}:${cell}:${dpr}:${accent()}`;
    if (key === mazeKey && mazeCanvas) return;

    mazeCanvas = mazeCanvas || document.createElement('canvas');
    mazeCanvas.width = Math.ceil(maze.cols * cell * dpr);
    mazeCanvas.height = Math.ceil(maze.rows * cell * dpr);

    const mc = mazeCanvas.getContext('2d');
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.clearRect(0, 0, maze.cols * cell, maze.rows * cell);

    paintFloor(mc, maze, cell);
    paintEdges(mc, maze, cell);

    mazeKey = key;
}

function paintFloor(mc, maze, cell) {
    mc.fillStyle = 'rgba(12, 18, 38, 0.82)';
    for (const { x, y } of maze.floors) {
        mc.fillRect(x * cell, y * cell, cell, cell);
    }
}

/** Os lados de cada célula de chão que dão para parede, riscados a néon. */
function paintEdges(mc, maze, cell) {
    const path = new Path2D();

    for (const { x, y } of maze.floors) {
        const left = x * cell;
        const top = y * cell;
        if (maze.isWall(x, y - 1)) { path.moveTo(left, top); path.lineTo(left + cell, top); }
        if (maze.isWall(x, y + 1)) { path.moveTo(left, top + cell); path.lineTo(left + cell, top + cell); }
        if (maze.isWall(x - 1, y)) { path.moveTo(left, top); path.lineTo(left, top + cell); }
        if (maze.isWall(x + 1, y)) { path.moveTo(left + cell, top); path.lineTo(left + cell, top + cell); }
    }

    const color = accent();
    mc.lineCap = 'round';
    mc.lineJoin = 'round';

    // Duas passagens: uma larga e esbatida para o halo, outra fina e viva por cima.
    mc.strokeStyle = hexToRgba(color, 0.22);
    mc.lineWidth = Math.max(4, cell * 0.28);
    mc.stroke(path);

    mc.strokeStyle = color;
    mc.lineWidth = Math.max(1.5, cell * 0.08);
    mc.stroke(path);
}

// ---------- O frame ----------

export function render() {
    if (!ctx || !view) return;

    ctx.clearRect(0, 0, view.width, view.height);

    const layout = activeLayout();
    if (!layout) return;

    const origin = cameraOrigin();
    const menuOnly = game.phase === 'menu';

    ctx.save();
    ctx.translate(origin.x, origin.y);
    if (menuOnly) ctx.globalAlpha = 0.85;

    if (mazeCanvas) {
        ctx.drawImage(mazeCanvas, 0, 0, layout.maze.cols * game.cell, layout.maze.rows * game.cell);
    }

    drawExit(layout);
    drawCrystals(layout, menuOnly);
    drawGuards(menuOnly);
    if (!menuOnly && game.player) drawPlayer();

    ctx.restore();

    if (!menuOnly) {
        drawHud();
        drawPhaseOverlay();
    }
}

const cellCenter = (x, y) => ({ px: (x + 0.5) * game.cell, py: (y + 0.5) * game.cell });

function drawExit(layout) {
    const { px, py } = cellCenter(layout.exit.x, layout.exit.y);
    const radius = game.cell * 0.34;
    const open = game.exitOpen || game.phase === 'menu';
    const pulse = 0.6 + Math.sin(game.globalClock * 3) * 0.2;

    ctx.save();
    ctx.translate(px, py);

    if (open) {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.2);
        glow.addColorStop(0, hexToRgba('#7cff2f', 0.55 * pulse));
        glow.addColorStop(1, 'rgba(124, 255, 47, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-radius * 2.2, -radius * 2.2, radius * 4.4, radius * 4.4);
    }

    // Fechada, a saída continua bem à vista: saber para onde se vai antes de
    // ter os cristais todos é metade do planeamento do nível.
    ctx.lineWidth = Math.max(2, game.cell * 0.09);
    ctx.strokeStyle = open ? '#9dff6a' : 'rgba(157, 255, 106, 0.5)';
    if (!open) ctx.setLineDash([game.cell * 0.2, game.cell * 0.12]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!open) {
        // Os cristais que faltam, em número, dentro do anel.
        const missing = Math.max(0, game.crystals.length - game.collected);
        if (missing > 0) {
            ctx.font = `700 ${Math.round(game.cell * 0.34)}px ${FONT_DISPLAY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(157, 255, 106, 0.75)';
            ctx.fillText(String(missing), 0, 1);
        }
    }

    if (open) {
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.45 * (0.8 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#9dff6a', 0.75);
        ctx.fill();
    }

    ctx.restore();
}

function drawCrystals(layout, menuOnly) {
    const crystals = menuOnly
        ? layout.crystals.map((cell) => ({ ...cell, taken: false }))
        : game.crystals;
    const size = game.cell * 0.22;

    for (const crystal of crystals) {
        if (crystal.taken) continue;
        const { px, py } = cellCenter(crystal.x, crystal.y);
        const bob = Math.sin(game.globalClock * 2.4 + crystal.x + crystal.y) * game.cell * 0.05;

        ctx.save();
        ctx.translate(px, py + bob);
        ctx.rotate(game.globalClock * 1.2);
        ctx.fillStyle = '#d8f8ff';
        ctx.shadowColor = hexToRgba(accent(), 0.9);
        ctx.shadowBlur = game.cell * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.72, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

function drawPlayer() {
    const pos = walkerPos(game.player);
    const { px, py } = cellCenter(pos.x, pos.y);
    const radius = game.cell * 0.32;
    const dir = game.player.dir || { x: 0, y: 1 };
    const blink = game.phase === 'caught' && Math.floor(game.globalClock * 8) % 2 === 0;

    ctx.save();
    ctx.translate(px, py);
    ctx.globalAlpha = blink ? 0.35 : 1;

    // Rasto: onde se esteve há um instante, mais fraco.
    if (game.player.moving) {
        ctx.beginPath();
        ctx.arc(-dir.x * radius * 0.7, -dir.y * radius * 0.7, radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#35e0ff', 0.18);
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#35e0ff';
    ctx.shadowColor = 'rgba(53, 224, 255, 0.8)';
    ctx.shadowBlur = game.cell * 0.5;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Os olhos olham para onde se vai: é o que dá a entender a direção num
    // corpo redondo, sem precisar de o virar.
    const eye = radius * 0.3;
    ctx.fillStyle = '#04131c';
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(dir.x * radius * 0.3 - dir.y * side * eye, dir.y * radius * 0.3 + dir.x * side * eye, eye * 0.62, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawGuards(menuOnly) {
    const scattering = !menuOnly && game.guardMode === 'scatter';

    for (const guard of menuOnly ? menuGuards() : game.guards) {
        const pos = guard.walker ? walkerPos(guard.walker) : { x: guard.x, y: guard.y };
        const dir = guard.walker?.dir || { x: 0, y: 1 };
        const { px, py } = cellCenter(pos.x, pos.y);
        const radius = game.cell * 0.34;
        const color = scattering ? '#5f7cff' : guard.color;

        ctx.save();
        ctx.translate(px, py);
        ctx.globalAlpha = scattering ? 0.7 : 1;
        ctx.fillStyle = color;
        ctx.shadowColor = hexToRgba(color, 0.7);
        ctx.shadowBlur = game.cell * 0.35;

        // O corpo clássico: cúpula em cima, serrilha em baixo.
        ctx.beginPath();
        ctx.arc(0, -radius * 0.1, radius, Math.PI, 0);
        ctx.lineTo(radius, radius * 0.7);
        const teeth = 4;
        for (let i = 0; i < teeth; i++) {
            const mid = radius - ((i + 0.5) * 2 * radius) / teeth;
            const end = radius - ((i + 1) * 2 * radius) / teeth;
            ctx.lineTo(mid, radius * 0.35);
            ctx.lineTo(end, radius * 0.7);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        const eye = radius * 0.3;
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(side * eye, -radius * 0.2, eye * 0.85, 0, Math.PI * 2);
            ctx.fillStyle = '#f6f9ff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(side * eye + dir.x * eye * 0.4, -radius * 0.2 + dir.y * eye * 0.4, eye * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = '#0a1020';
            ctx.fill();
        }

        ctx.restore();
    }
}

/** No menu os guardas estão parados onde o nível os põe — é uma fotografia do nível. */
function menuGuards() {
    const layout = game.menuLayout;
    if (!layout) return [];
    return layout.guards.map((guard) => ({ ...guard, color: guardColorOf(guard.kind) }));
}

const GUARD_MENU_COLORS = { roam: '#ff5d9e', chase: '#ff8a3d', ambush: '#b78bff' };
const guardColorOf = (kind) => GUARD_MENU_COLORS[kind] || '#ff5d9e';

// ---------- HUD ----------

/**
 * O HUD é desenhado no canvas, onde não há `backdrop-filter`: o vidro é imitado
 * à mão, com fundo translúcido, contorno de 1px e um risco de luz no topo — o
 * mesmo truque do HUD do Pixel Racing.
 */
function glassPanel(x, y, w, h, r, alpha = 0.44) {
    ctx.save();
    roundRect(x, y, w, h, r);
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

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawHud() {
    const level = game.level;
    if (!level) return;

    const width = Math.min(HUD_MAX_WIDTH, view.width - EDGE_PAD * 2);
    const x = (view.width - width) / 2;
    const y = view.topInset;

    glassPanel(x, y, width, HUD_HEIGHT, 16);

    const pad = 14;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Nível e nome, à esquerda.
    ctx.font = `600 9px ${FONT_DISPLAY}`;
    ctx.letterSpacing = '1.4px';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.55)';
    ctx.fillText(`NÍVEL ${level.id}`, x + pad, y + 18);
    ctx.letterSpacing = '0px';
    ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#eef2ff';
    ctx.fillText(level.name, x + pad, y + 36);

    // Relógio, à direita.
    const urgent = game.timeLeft <= 10;
    ctx.textAlign = 'right';
    ctx.font = `700 20px ${FONT_DISPLAY}`;
    ctx.fillStyle = urgent ? '#ff5d9e' : '#eef2ff';
    ctx.fillText(fmtClock(game.timeLeft), x + width - pad, y + 28);

    ctx.font = `500 11px ${FONT_BODY}`;
    ctx.fillStyle = 'rgba(238, 242, 255, 0.66)';
    ctx.fillText(`${game.collected}/${game.crystals.length} cristais`, x + width - pad, y + 44);
    ctx.textAlign = 'left';

    drawLives(x + pad, y + 44);

    // A barra do tempo, rente ao fundo do painel.
    const left = Math.max(0, game.timeLeft / level.seconds);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x + pad, y + HUD_HEIGHT - 9, width - pad * 2, 3);
    ctx.fillStyle = urgent ? '#ff5d9e' : accent();
    ctx.fillRect(x + pad, y + HUD_HEIGHT - 9, (width - pad * 2) * left, 3);

    ctx.restore();
}

/** As vidas, em pontos: cheios os que restam, vazios os que já se gastaram. */
function drawLives(x, y) {
    const total = game.lives + game.livesLost;
    for (let i = 0; i < total; i++) {
        ctx.beginPath();
        ctx.arc(x + 5 + i * 14, y - 4, 4.5, 0, Math.PI * 2);
        if (i < game.lives) {
            ctx.fillStyle = '#35e0ff';
            ctx.fill();
        } else {
            ctx.strokeStyle = 'rgba(238, 242, 255, 0.3)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }
}

// ---------- Avisos por cima do labirinto ----------

function drawPhaseOverlay() {
    if (game.phase === 'countdown') {
        drawBanner(game.countdownValue > 0 ? String(game.countdownValue) : 'VAI!', accent());
    } else if (game.phase === 'caught') {
        drawBanner('APANHADO!', '#ff5d9e', `${game.lives} ${game.lives === 1 ? 'vida' : 'vidas'} por gastar`);
    } else if (game.phase === 'ending' && game.result) {
        const cleared = game.result.cleared;
        drawBanner(
            cleared ? 'NÍVEL CONCLUÍDO' : (game.result.reason === 'tempo' ? 'TEMPO ESGOTADO' : 'SEM VIDAS'),
            cleared ? '#9dff6a' : '#ff5d9e',
            cleared ? '★'.repeat(game.result.stars) + '☆'.repeat(MAX_STARS - game.result.stars) : null
        );
    }
}

function drawBanner(text, color, sub = null) {
    const cx = view.width / 2;
    const cy = mazeTop() + (view.height - mazeTop()) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 24;
    ctx.font = `800 ${Math.min(58, view.width * 0.14)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);

    if (sub) {
        ctx.font = `600 16px ${FONT_BODY}`;
        ctx.fillStyle = 'rgba(238, 242, 255, 0.8)';
        ctx.fillText(sub, cx, cy + 40);
    }
    ctx.restore();
}

// ---------- Cor ----------

/** `#rrggbb` com alfa. As cores dos níveis vêm em hexadecimal e o canvas quer rgba. */
function hexToRgba(hex, alpha) {
    const value = hex.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
