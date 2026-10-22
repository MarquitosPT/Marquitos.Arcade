// Menu: quem joga, em que nível, e o que já se fez.
//
// Dois ecrãs, como no Maze Run e nos Gulosinhos: o primeiro pergunta o nome
// (só a quem não tem sessão iniciada) e propõe continuar de onde se ficou; o
// segundo mostra os níveis no carrossel do SDK (lib/arcade/carousel.js).
//
// Por trás do vidro está o campo do nível apontado, com os tijolos no sítio e
// a bola na raquete: o menu é uma janela para o nível, não um cartaz.

import { createCarousel, escapeHtml } from '/lib/arcade/index.js';

import { KIND_TAGS } from './bricks.js';
import { MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { prepareLevel } from './level.js';
import { LEVELS, levelById, levelCount } from './levels.js';
import { bestOf, isUnlocked, progress, totalScore, totalStars, unlockedCount } from './progress.js';
import { paintLevelShot } from './render.js';
import { game } from './state.js';
import { els, overlays } from './ui.js';

function starRow(stars) {
    const filled = Math.max(0, Math.min(MAX_STARS, stars || 0));
    const dots = Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < filled ? '' : 'off'}">★</i>`).join('');
    return `<span class="levelStars" role="img" aria-label="${filled} de ${MAX_STARS} estrelas">${dots}</span>`;
}

/** Os tijolos especiais do nível. A linha existe mesmo vazia (altura dos cartões). */
function levelTags(level) {
    const chips = level.kinds
        .map((kind) => {
            const [icon, label] = KIND_TAGS[kind];
            return `<span class="levelTag" title="${label}"><i aria-hidden="true">${icon}</i>${escapeHtml(label)}</span>`;
        })
        .join('');
    return `<span class="levelTags">${chips}</span>`;
}

/**
 * Um cartão de nível: sempre as mesmas cinco linhas, pela mesma ordem —
 * número, nome, tijolos especiais, estado e estrelas — para os cartões terem
 * todos a mesma altura (ver a nota do carrossel no README).
 */
function levelCard(level) {
    const unlocked = isUnlocked(level.id);
    const best = bestOf(level.id);

    const state = !unlocked
        ? `Conclui o nível ${level.id - 1}`
        : best
            ? `${fmtPoints(best.score)} pts · ${fmtTime(best.ms)}`
            : 'Por jogar';

    const label = unlocked
        ? `Nível ${level.id}, ${level.name}`
        : `Nível ${level.id}, ${level.name} — bloqueado, conclui o nível ${level.id - 1}`;

    return `<button type="button" class="levelCard${unlocked ? '' : ' is-locked'}"
        data-value="${level.id}" aria-label="${escapeHtml(label)}" style="--card-accent: ${level.accent}">
        <span class="levelShape">
            <canvas class="levelShot${unlocked ? '' : ' is-locked'}" data-level="${level.id}" aria-hidden="true"></canvas>
            ${unlocked ? '' : '<span class="levelLock" aria-hidden="true">🔒</span>'}
        </span>
        <span class="levelInfo">
            <span class="levelNumber">Nível ${level.id} · ${escapeHtml(level.world.name)}</span>
            <span class="levelName">${escapeHtml(level.name)}</span>
            ${levelTags(level)}
            <span class="levelState">${escapeHtml(state)}</span>
            ${starRow(best?.stars)}
        </span>
    </button>`;
}

/** O campo do nível apontado, por trás do vidro. */
export function previewLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return;
    prepareLevel(level);
    game.score = 0;
    game.elapsed = 0;
    document.documentElement.style.setProperty('--level-accent', level.accent);
}

export function createMenu({ playerName, onPlay }) {
    const carousel = createCarousel({
        root: els.levelsCarousel,
        viewport: els.levelViewport,
        track: els.levelGrid,
        prev: els.prevPageBtn,
        next: els.nextPageBtn,
        dots: els.levelDots
    }, {
        pageClass: 'levelPage',
        // As miniaturas são canvas: perdem-se sempre que o carrossel refaz as
        // páginas (ao rodar o aparelho), e é aqui que se voltam a pintar.
        onRender(track) {
            markSelected();
            for (const canvas of track.querySelectorAll('.levelShot')) paintLevelShot(canvas, levelById(Number(canvas.dataset.level)));
        }
    });

    // ---------- A conta ----------

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

    // ---------- O progresso ----------

    function refreshProgress() {
        const open = unlockedCount();
        const total = levelCount();
        els.progressLine.textContent = `${open} de ${total} níveis · ${totalStars()} de ${total * MAX_STARS} estrelas`;
        els.progressBar.style.setProperty('--fill', `${Math.round((open / total) * 100)}%`);
        els.progressNote.hidden = progress.stored;
        const level = levelById(open);
        els.playBtn.textContent = `${bestOf(open) ? 'Repetir' : 'Jogar'} o nível ${open} · ${level.name}`;
    }

    function showMenu() {
        game.phase = 'menu';
        game.menuLevelId = unlockedCount();
        refreshProgress();
        previewLevel(game.menuLevelId);
        overlays.show('start');
    }

    function showLevels() {
        game.phase = 'menu';
        refreshProgress();
        els.levelsSub.textContent = `Escolhe por onde recomeçar · ${fmtPoints(totalScore())} pontos até agora`;
        overlays.show('levels');
        carousel.setCards(LEVELS.map(levelCard), { show: LEVELS.findIndex((level) => level.id === game.menuLevelId) });
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

    return { showMenu, showLevels, refreshProgress };
}
