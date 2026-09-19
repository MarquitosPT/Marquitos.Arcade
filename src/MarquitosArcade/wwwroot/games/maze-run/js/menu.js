// Menu: quem joga, que nível e o que já se fez.
//
// São dois ecrãs, como no Pixel Racing. O primeiro pergunta o mínimo — o nome
// (só a quem não tem sessão iniciada) — e propõe continuar de onde se ficou; o
// segundo mostra os níveis, os que estão abertos e o que falta nos outros.
//
// O labirinto que se vê por trás do vidro é o do nível selecionado, com os
// cristais e os guardas nos sítios onde vão estar: o menu é uma janela para o
// nível, não um cartaz.

import { escapeHtml } from '/lib/arcade/index.js';

import { MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { LEVELS, buildLevelLayout, levelById, levelCount } from './levels.js';
import { bestOf, isUnlocked, progress, totalScore, totalStars, unlockedCount } from './progress.js';
import { layoutMaze } from './render.js';
import { game } from './state.js';
import { els, overlays } from './ui.js';

/** Caixa do desenho do labirinto nos cartões, em unidades do viewBox. */
const PREVIEW_PAD = 0.6;

/** Os labirintos do menu constroem-se uma vez — são sempre os mesmos. */
const layouts = new Map();

function layoutFor(level) {
    if (!layouts.has(level.id)) layouts.set(level.id, buildLevelLayout(level));
    return layouts.get(level.id);
}

/**
 * O labirinto do cartão, desenhado pelas arestas como no jogo (ver render.js):
 * cada lado de chão que dá para parede vale um risco. É o mesmo labirinto que
 * se vai jogar, e não uma ilustração — sai da mesma semente.
 */
function mazePreviewSvg(level, { locked }) {
    const { maze } = layoutFor(level);
    const segments = [];

    // `isWallStatic`: o cartão mostra a forma do labirinto, e as portas fechadas
    // não são paredes — quem diz que o nível tem portas é a etiqueta aqui em baixo.
    for (const { x, y } of maze.floors) {
        if (maze.isWallStatic(x, y - 1)) segments.push(`M${x} ${y}h1`);
        if (maze.isWallStatic(x, y + 1)) segments.push(`M${x} ${y + 1}h1`);
        if (maze.isWallStatic(x - 1, y)) segments.push(`M${x} ${y}v1`);
        if (maze.isWallStatic(x + 1, y)) segments.push(`M${x + 1} ${y}v1`);
    }

    const width = maze.cols + PREVIEW_PAD * 2;
    const height = maze.rows + PREVIEW_PAD * 2;

    return `<svg class="mazeShape${locked ? ' is-locked' : ''}" viewBox="${-PREVIEW_PAD} ${-PREVIEW_PAD} ${width} ${height}"
        preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="--level-accent: ${level.accent}">
        <path class="mazeWalls" d="${segments.join('')}"></path>
    </svg>`;
}

/** As estrelas do nível, com as que faltam apagadas — vê-se a escala inteira. */
function starRow(stars) {
    const filled = Math.max(0, Math.min(MAX_STARS, stars || 0));
    const dots = Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < filled ? '' : 'off'}">★</i>`).join('');
    return `<span class="levelStars" role="img" aria-label="${filled} de ${MAX_STARS} estrelas">${dots}</span>`;
}

/**
 * O que este nível tem além de cristais e guardas. Vale a pena mostrar também
 * nos níveis fechados: é assim que se vê o que vem a seguir e porque é que vale
 * a pena lá chegar.
 */
function levelTags(level) {
    const tags = [];
    if (level.portals) tags.push(['\u{1F300}', level.portals, 'portal', 'portais']);
    if (level.doors) tags.push(['\u{1F511}', level.doors, 'porta trancada', 'portas trancadas']);
    if (level.freezers) tags.push(['\u2744', level.freezers, 'cristal de gelo', 'cristais de gelo']);
    if (!tags.length) return '';

    const chips = tags
        .map(([icon, count, one, many]) =>
            `<span class="levelTag" title="${count} ${count === 1 ? one : many}">
                <i aria-hidden="true">${icon}</i>${count}
                <span class="visuallyHidden">${count === 1 ? one : many}</span>
            </span>`)
        .join('');

    return `<span class="levelTags">${chips}</span>`;
}

function levelCard(level) {
    const unlocked = isUnlocked(level.id);
    const best = bestOf(level.id);

    const meta = !unlocked
        ? `<span class="levelMeta">Conclui o nível ${level.id - 1}</span>`
        : best
            ? `<span class="levelMeta">${fmtTime(best.ms)} · ${fmtPoints(best.score)} pts</span>`
            : '<span class="levelMeta">Por jogar</span>';

    // O cartão fechado não leva `disabled` nem `aria-disabled`: ele responde ao
    // clique (abana e diz o que falta), e um controlo que responde não é um
    // controlo desativado. O que o estado tem de dizer, di-lo o nome acessível.
    const label = unlocked
        ? `Nível ${level.id}, ${level.name}`
        : `Nível ${level.id}, ${level.name} — bloqueado, conclui o nível ${level.id - 1}`;

    return `<button type="button" class="levelCard${unlocked ? '' : ' is-locked'}"
        data-value="${level.id}" aria-label="${escapeHtml(label)}">
        <span class="levelShape">
            ${mazePreviewSvg(level, { locked: !unlocked })}
            ${unlocked ? '' : '<span class="levelLock" aria-hidden="true">🔒</span>'}
        </span>
        <span class="levelInfo">
            <span class="levelNumber">Nível ${level.id}</span>
            <span class="levelName">${escapeHtml(level.name)}</span>
            ${meta}
            ${levelTags(level)}
            ${unlocked && best ? starRow(best.stars) : ''}
        </span>
    </button>`;
}

/** O labirinto que se vê por trás do vidro. */
function previewLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return;
    game.menuLayout = layoutFor(level);
    layoutMaze();
}

export function createMenu({ playerName, onPlay }) {
    /**
     * Quem tem sessão iniciada joga com o nome da conta — é esse que vai ao
     * quadro, portanto pedir outro seria mentir ao jogador. A visitantes
     * mostra-se o campo.
     */
    function bindAccount() {
        playerName.account.then((displayName) => {
            const signedIn = !!displayName;
            els.nameRow.hidden = signedIn;
            els.accountRow.hidden = !signedIn;
            if (signedIn) {
                els.accountName.textContent = displayName;
                els.accountInitial.textContent = [...displayName][0].toUpperCase();
            }
            els.nameSlot.classList.remove('is-pending');
        });
    }

    /** O ponto da situação: níveis abertos, estrelas e pontos. */
    function refreshProgress() {
        const open = unlockedCount();
        const total = levelCount();
        const stars = totalStars();

        els.progressLine.textContent = `${open} de ${total} ${total === 1 ? 'nível' : 'níveis'}`
            + ` · ${stars} de ${total * MAX_STARS} estrelas`;
        els.progressBar.style.setProperty('--fill', `${Math.round((open / total) * 100)}%`);

        // Quem joga sem conta só tem este aparelho para se lembrar do que fez —
        // e é justo dizer-lho antes de investir uma tarde nos níveis.
        els.progressNote.hidden = progress.stored;
        els.playBtn.textContent = bestOf(open) ? `Repetir o nível ${open}` : `Jogar o nível ${open}`;
    }

    function showMenu() {
        // O botão grande joga sempre o nível mais alto que está aberto — é o
        // "continuar" de quem volta ao jogo sem querer escolher nada.
        game.menuLevelId = unlockedCount();
        refreshProgress();
        previewLevel(game.menuLevelId);
        overlays.show('start');
    }

    function showLevels() {
        refreshProgress();
        els.levelsSub.textContent = `Escolhe por onde recomeçar · ${fmtPoints(totalScore())} pontos até agora`;
        els.levelGrid.innerHTML = LEVELS.map(levelCard).join('');
        markSelected();
        overlays.show('levels');
    }

    function markSelected() {
        for (const card of els.levelGrid.querySelectorAll('.levelCard')) {
            card.classList.toggle('active', Number(card.dataset.value) === game.menuLevelId);
        }
    }

    els.levelGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.levelCard');
        if (!card) return;

        const levelId = Number(card.dataset.value);
        if (!isUnlocked(levelId)) {
            // Um nível fechado não abre à força, mas vale a pena mostrar-lhe o
            // labirinto: é para lá que se está a jogar.
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 400);
            return;
        }

        game.menuLevelId = levelId;
        markSelected();
        previewLevel(levelId);
        onPlay(levelId);
    });

    bindAccount();

    return { showMenu, showLevels, refreshProgress, previewLevel };
}
