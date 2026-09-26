// Menu: quem joga, que nível e o que já se fez.
//
// São dois ecrãs, como no Maze Run. O primeiro pergunta o mínimo — o nome (só
// a quem não tem sessão iniciada) — e propõe continuar de onde se ficou; o
// segundo mostra os níveis num carrossel de páginas, também como no Maze Run
// (o carrossel é o do SDK, /lib/arcade/carousel.js).

import { createCarousel, escapeHtml } from '/lib/arcade/index.js';

import { fitGrid } from './layout.js';
import { MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { LEVELS, levelCount } from './levels.js';
import { showMenuBoard } from './level.js';
import { bestOf, isUnlocked, progress, totalScore, totalStars, unlockedCount } from './progress.js';
import { game } from './state.js';
import { els, overlays } from './ui.js';

/** As estrelas do nível, com as que faltam apagadas — vê-se a escala inteira. */
function starRow(stars) {
    const filled = Math.max(0, Math.min(MAX_STARS, stars || 0));
    const dots = Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < filled ? '' : 'off'}">★</i>`).join('');
    return `<span class="levelStars" role="img" aria-label="${filled} de ${MAX_STARS} estrelas">${dots}</span>`;
}

/** Caixa do desenho do tabuleiro nos cartões, em unidades do viewBox (4:3, como a caixa no CSS). */
const PREVIEW_W = 120;
const PREVIEW_H = 90;
const PREVIEW_PAD = 8;

/**
 * O tabuleiro do nível em miniatura: as cartas viradas, na grelha que o jogo
 * escolhe para elas num telemóvel ao alto. Sai do mesmo `fitGrid` que arruma
 * as cartas a sério (ver layout.js) — é o tabuleiro, e não uma ilustração.
 */
function boardPreviewSvg(level, { locked }) {
    const grid = fitGrid({
        count: level.cards,
        width: PREVIEW_W - PREVIEW_PAD * 2,
        height: PREVIEW_H - PREVIEW_PAD * 2,
        ratios: [1.15, 1],
        maxWidth: 24
    });
    // Aqui não há `gap` em píxeis a respeitar: o espaço é uma fração da carta.
    const gap = Math.max(1, grid.cardW * 0.14);
    const w = grid.cardW - gap;
    const h = grid.cardH - gap;
    const cols = grid.cols;
    const rows = Math.ceil(level.cards / cols);
    const boardW = cols * grid.cardW;
    const boardH = rows * grid.cardH;
    const x0 = (PREVIEW_W - boardW) / 2 + gap / 2;
    const y0 = (PREVIEW_H - boardH) / 2 + gap / 2;

    const rects = [];
    for (let i = 0; i < level.cards; i++) {
        const row = Math.floor(i / cols);
        // A última fila, quando não está cheia, fica centrada — como no jogo.
        const inRow = row === rows - 1 ? level.cards - row * cols : cols;
        const shift = ((cols - inRow) * grid.cardW) / 2;
        const x = x0 + shift + (i % cols) * grid.cardW;
        const y = y0 + row * grid.cardH;
        rects.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w * 0.18).toFixed(1)}"/>`);
    }

    return `<svg class="boardShape${locked ? ' is-locked' : ''}" viewBox="0 0 ${PREVIEW_W} ${PREVIEW_H}"
        preserveAspectRatio="xMidYMid meet" aria-hidden="true">${rects.join('')}</svg>`;
}

/**
 * Um cartão de nível.
 *
 * Todos têm exatamente as mesmas cinco linhas, pela mesma ordem e sempre
 * presentes — número, nome, cartas, estado e estrelas —, como no Maze Run: uma
 * página do carrossel com cartões de alturas diferentes é uma fila torta.
 */
function levelCard(level) {
    const unlocked = isUnlocked(level.id);
    const best = bestOf(level.id);
    const state = !unlocked
        ? `Conclui o nível ${level.id - 1}`
        : best ? `${fmtTime(best.ms)} · ${fmtPoints(best.score)} pts` : 'Por jogar';

    // O cartão fechado não leva `disabled`: responde ao clique (abana), e o
    // que o estado tem de dizer, di-lo o nome acessível.
    const label = unlocked
        ? `Nível ${level.id}, ${level.name}, ${level.cards} cartas`
        : `Nível ${level.id}, ${level.name}, ${level.cards} cartas — bloqueado, conclui o nível ${level.id - 1}`;

    return `<button type="button" class="levelCard${unlocked ? '' : ' is-locked'}${best ? ' is-done' : ''}"
        data-value="${level.id}" aria-label="${escapeHtml(label)}">
        <span class="levelShape">
            ${boardPreviewSvg(level, { locked: !unlocked })}
            ${unlocked ? '' : '<span class="levelLock" aria-hidden="true">🔒</span>'}
        </span>
        <span class="levelInfo">
            <span class="levelNumber">Nível ${level.id}</span>
            <span class="levelName">${escapeHtml(level.name)}</span>
            <span class="levelCards">${level.cards} cartas · ${level.pairs} pares</span>
            <span class="levelState">${escapeHtml(state)}</span>
            ${starRow(best?.stars)}
        </span>
    </button>`;
}

export function createMenu({ playerName, onPlay }) {
    const carousel = createCarousel({
        root: els.levelsCarousel,
        viewport: els.levelViewport,
        track: els.levelGrid,
        prev: els.prevPageBtn,
        next: els.nextPageBtn,
        dots: els.levelDots
    }, { pageClass: 'levelPage' });

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

        els.progressLine.textContent = `${open} de ${total} níveis · ${totalStars()} de ${total * MAX_STARS} estrelas`;
        els.progressBar.style.setProperty('--fill', `${Math.round((open / total) * 100)}%`);

        // Quem joga sem conta só tem este aparelho para se lembrar do que fez.
        els.progressNote.hidden = progress.stored;
        const level = LEVELS[open - 1];
        els.playBtn.textContent = `${bestOf(open) ? 'Repetir' : 'Jogar'} o nível ${open} · ${level.cards} cartas`;
    }

    function showMenu() {
        // O botão grande joga sempre o nível mais alto que está aberto — é o
        // "continuar" de quem volta ao jogo sem querer escolher nada.
        game.menuLevelId = unlockedCount();
        refreshProgress();
        showMenuBoard(game.menuLevelId);
        overlays.show('start');
    }

    function showLevels() {
        refreshProgress();
        els.levelsSub.textContent = `Escolhe por onde recomeçar · ${fmtPoints(totalScore())} pontos até agora`;
        // Abre na página onde está o nível apontado — quem vem do menu com o
        // nível 9 à frente não tem de o ir procurar.
        carousel.setCards(LEVELS.map(levelCard), { show: LEVELS.findIndex((level) => level.id === game.menuLevelId) });
        markSelected();
        overlays.show('levels');
    }

    function markSelected() {
        for (const card of els.levelGrid.querySelectorAll('.levelCard')) {
            card.classList.toggle('active', Number(card.dataset.value) === game.menuLevelId);
        }
    }

    // As setas do teclado mudam de página enquanto os níveis estiverem à vista.
    window.addEventListener('keydown', (event) => {
        if (!overlays.isVisible('levels')) return;
        if (carousel.handleKey(event.key)) event.preventDefault();
    });

    els.levelGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.levelCard');
        if (!card) return;

        const levelId = Number(card.dataset.value);
        if (!isUnlocked(levelId)) {
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 400);
            return;
        }

        game.menuLevelId = levelId;
        markSelected();
        onPlay(levelId);
    });

    bindAccount();

    return { showMenu, showLevels, refreshProgress };
}
