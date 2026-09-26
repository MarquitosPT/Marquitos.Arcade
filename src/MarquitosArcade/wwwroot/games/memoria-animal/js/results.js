// Ecrã de fim de nível.
//
// Aqui só se mostra: o que havia para guardar (progresso e pontuação) já ficou
// guardado no momento em que o nível acabou, em level.js.

import { escapeHtml } from '/lib/arcade/index.js';

import { MAX_CARDS, MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { levelById, levelCount } from './levels.js';
import { bestOf, totalScore } from './progress.js';
import { game } from './state.js';
import { els, overlays, topBar } from './ui.js';

/** Registado pelo main.js: o que fazer quando se pede outro nível ou o menu. */
let onAction = () => {};
export function setResultHandler(handler) {
    onAction = handler;
}

const HEADLINES = ['Boa!', 'Muito bem!', 'Memória de elefante!'];

export function showResultScreen() {
    game.phase = 'result';
    topBar.setInGame(false);
    els.resultBody.innerHTML = renderCleared(game.result);
    overlays.show('result');
    wireButtons();
}

function stars(count) {
    return Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < count ? '' : 'off'}">★</i>`).join('');
}

function renderCleared(result) {
    const level = levelById(result.levelId);
    const nextId = result.levelId + 1;
    const hasNext = nextId <= levelCount();

    let html = `<div class="resultHead">
        <div class="resultStars" role="img" aria-label="${result.stars} de ${MAX_STARS} estrelas">${stars(result.stars)}</div>
        <div class="bannerText">${HEADLINES[result.stars - 1] || 'Nível concluído'}</div>
        <div class="sub">Nível ${level.id} · ${escapeHtml(level.name)} · ${level.cards} cartas</div>
    </div>`;

    if (result.unlockedLevel) {
        const unlocked = levelById(result.unlockedLevel);
        html += `<div class="unlockNote">🔓 Nível ${unlocked.id} desbloqueado — ${unlocked.cards} cartas</div>`;
    }

    html += statTable([
        ['Tempo', fmtTime(result.ms) + (result.seconds <= level.par ? ' ✅' : ` · alvo ${level.par}s`)],
        ['Jogadas', String(result.attempts)],
        ['Erros', `${result.errors}${result.stars < MAX_STARS ? ` · ★★★ até ${level.threeStarErrors}` : ''}`],
        ['Pontos do nível', fmtPoints(result.score)],
        ['Total no jogo', fmtPoints(totalScore())]
    ]);

    if (result.improved) html += '<div class="sectionLabel">Nova melhor marca neste nível</div>';
    else {
        const best = bestOf(result.levelId);
        if (best) html += `<div class="sectionLabel">Melhor marca: ${fmtPoints(best.score)} pts · ${fmtTime(best.ms)}</div>`;
    }

    const next = hasNext
        ? `<button class="btn" id="nextLevelBtn" type="button">Nível ${nextId} · ${levelById(nextId).cards} cartas →</button>`
        : '<div class="finalNote">🏆 Chegaste ao fim — as ${MAX_CARDS} cartas! Tenta agora as três estrelas em todos os níveis.</div>';

    html += `<div class="resultActions">
        ${next}
        <button class="btnOutline" id="retryBtn" type="button">Repetir o nível</button>
        <button class="btnOutline" id="levelsBtn" type="button">Escolher nível</button>
    </div>`;

    return html;
}

function statTable(rows) {
    return `<table class="statTable"><tbody>${rows
        .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="statValue">${escapeHtml(value)}</td></tr>`)
        .join('')}</tbody></table>`;
}

function wireButtons() {
    const result = game.result;
    els.resultBody.querySelector('#nextLevelBtn')?.addEventListener('click', () => onAction('next', result.levelId + 1));
    els.resultBody.querySelector('#retryBtn')?.addEventListener('click', () => onAction('retry', result.levelId));
    els.resultBody.querySelector('#levelsBtn')?.addEventListener('click', () => onAction('levels'));
}
