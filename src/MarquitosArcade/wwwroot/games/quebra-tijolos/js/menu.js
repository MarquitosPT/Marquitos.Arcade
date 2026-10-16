import { createCarousel, escapeHtml } from '/lib/arcade/index.js';

import { MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { LEVELS, levelCount } from './levels.js';
import { bestOf, isUnlocked, progress, totalScore, totalStars, unlockedCount } from './progress.js';
import { game } from './state.js';
import { els, overlays } from './ui.js';

function starRow(stars) {
    const filled = Math.max(0, Math.min(MAX_STARS, stars || 0));
    return `<span class="levelStars" role="img" aria-label="${filled} de ${MAX_STARS} estrelas">${Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < filled ? '' : 'off'}">★</i>`).join('')}</span>`;
}

function previewSvg(level, { locked }) {
    const cols = level.cols;
    const rows = level.rows;
    const cellW = 10;
    const cellH = 6;
    const gap = 1.4;
    const width = cols * cellW + (cols - 1) * gap;
    const height = rows * cellH + (rows - 1) * gap;
    const x0 = (120 - width) / 2;
    const y0 = (76 - height) / 2;
    const rects = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = level.grid[row][col];
            if (!cell) continue;
            const x = x0 + col * (cellW + gap);
            const y = y0 + row * (cellH + gap);
            const fill = cell >= 9 ? '#b4b4c5' : level.palette.bricks[Math.min(2, Math.max(0, cell - 1))];
            rects.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW}" height="${cellH}" rx="2" fill="${fill}" opacity="${locked ? '0.55' : '1'}"/>`);
        }
    }
    return `<svg class="boardShape${locked ? ' is-locked' : ''}" viewBox="0 0 120 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${rects.join('')}</svg>`;
}

function levelCard(level) {
    const unlocked = isUnlocked(level.id);
    const best = bestOf(level.id);
    const state = !unlocked
        ? `Conclui o nível ${level.id - 1}`
        : best ? `${fmtTime(best.ms)} · ${fmtPoints(best.score)} pts` : 'Por jogar';
    const label = unlocked
        ? `Nível ${level.id}, ${level.name}, ${level.brickCount} tijolos`
        : `Nível ${level.id}, ${level.name}, bloqueado, conclui o nível ${level.id - 1}`;

    return `<button type="button" class="levelCard${unlocked ? '' : ' is-locked'}${best ? ' is-done' : ''}"
        data-value="${level.id}" aria-label="${escapeHtml(label)}" style="--card-accent: ${level.accent}">
        <span class="levelShape">
            ${previewSvg(level, { locked: !unlocked })}
            ${unlocked ? '' : '<span class="levelLock" aria-hidden="true">🔒</span>'}
        </span>
        <span class="levelInfo">
            <span class="levelNumber">Nível ${level.id}</span>
            <span class="levelName">${escapeHtml(level.name)}</span>
            <span class="levelCards">${level.brickCount} tijolos · alvo ${fmtTime(level.targetMs)}</span>
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

    function refreshProgress() {
        const open = unlockedCount();
        const total = levelCount();
        els.progressLine.textContent = `${open} de ${total} níveis · ${totalStars()} de ${total * MAX_STARS} estrelas`;
        els.progressBar.style.setProperty('--fill', `${Math.round((open / total) * 100)}%`);
        els.progressNote.hidden = progress.stored;
        const level = LEVELS[open - 1];
        els.playBtn.textContent = `${bestOf(open) ? 'Repetir' : 'Jogar'} o nível ${open} · ${level.brickCount} tijolos`;
    }

    function showMenu() {
        game.menuLevelId = unlockedCount();
        game.level = LEVELS[game.menuLevelId - 1];
        game.phase = 'menu';
        game.elapsed = 0;
        game.levelScore = 0;
        refreshProgress();
        overlays.show('start');
    }

    function showLevels() {
        refreshProgress();
        els.levelsSub.textContent = `Escolhe uma muralha · ${fmtPoints(totalScore())} pontos até agora`;
        carousel.setCards(LEVELS.map(levelCard), { show: LEVELS.findIndex((level) => level.id === game.menuLevelId) });
        markSelected();
        overlays.show('levels');
    }

    function markSelected() {
        for (const card of els.levelGrid.querySelectorAll('.levelCard')) {
            card.classList.toggle('active', Number(card.dataset.value) === game.menuLevelId);
        }
    }

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
