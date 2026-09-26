// Menu: quem joga, que nível e o que já se fez.
//
// São dois ecrãs, como no Maze Run. O primeiro pergunta o mínimo — o nome (só
// a quem não tem sessão iniciada) — e propõe continuar de onde se ficou; o
// segundo mostra os níveis todos de uma vez, abertos e por abrir. São botões
// pequenos e cabem num ecrã de telemóvel, por isso não há carrossel.

import { escapeHtml } from '/lib/arcade/index.js';

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

/**
 * Um cartão de nível. Todos têm as mesmas quatro linhas — número, cartas,
 * estado e estrelas —, mesmo quando uma delas está vazia, para a grelha não
 * ficar torta.
 */
function levelCard(level) {
    const unlocked = isUnlocked(level.id);
    const best = bestOf(level.id);
    const state = !unlocked ? '🔒' : best ? fmtTime(best.ms) : 'Por jogar';

    // O cartão fechado não leva `disabled`: responde ao clique (abana), e o
    // que o estado tem de dizer, di-lo o nome acessível.
    const label = unlocked
        ? `Nível ${level.id}, ${level.name}, ${level.cards} cartas`
        : `Nível ${level.id}, ${level.cards} cartas — bloqueado, conclui o nível ${level.id - 1}`;

    return `<button type="button" class="levelCard${unlocked ? '' : ' is-locked'}${best ? ' is-done' : ''}"
        data-value="${level.id}" aria-label="${escapeHtml(label)}">
        <span class="levelNumber">${level.id}</span>
        <span class="levelCards">${level.cards} cartas</span>
        <span class="levelState">${escapeHtml(state)}</span>
        ${starRow(best?.stars)}
    </button>`;
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
