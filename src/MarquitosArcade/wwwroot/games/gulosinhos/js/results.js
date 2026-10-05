// Ecrã de fim de nível — concluído ou não.
//
// Aqui só se mostra: o que havia para guardar já ficou guardado quando o nível
// acabou, em level.js.

import { escapeHtml } from '/lib/arcade/index.js';

import { MAX_STARS } from './config.js';
import { fmtClock, fmtPoints, fmtTime } from './format.js';
import { levelById, levelCount } from './levels.js';
import { bestOf, totalScore } from './progress.js';
import { game } from './state.js';
import { els, overlays, topBar } from './ui.js';

let onAction = () => {};
export function setResultHandler(handler) {
    onAction = handler;
}

export function showResultScreen() {
    game.phase = 'result';
    topBar.setInGame(false);
    const result = game.result;
    els.resultBody.innerHTML = result?.cleared ? renderCleared(result) : renderFailed(result);
    overlays.show('result');
    wireButtons();
}

function stars(count) {
    return Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < count ? '' : 'off'}">★</i>`).join('');
}

/** As três condições, com o que se fez em cada uma — quem vê percebe o que falta. */
function starChecklist(result) {
    const items = [
        [true, 'Chegar ao frasco'],
        [result.candies >= result.totalCandies, `Todas as guloseimas (${result.candies}/${result.totalCandies})`],
        [result.seconds <= result.par, `Dentro do tempo-alvo (${fmtClock(result.par)})`]
    ];
    return `<ul class="starChecklist">${items
        .map(([ok, text]) => `<li class="${ok ? 'ok' : ''}"><i aria-hidden="true">${ok ? '★' : '☆'}</i>${escapeHtml(text)}</li>`)
        .join('')}</ul>`;
}

function renderCleared(result) {
    const level = levelById(result.levelId);
    const nextId = result.levelId + 1;
    const hasNext = nextId <= levelCount();

    let html = `<div class="resultHead">
        <div class="resultStars" role="img" aria-label="${result.stars} de ${MAX_STARS} estrelas">${stars(result.stars)}</div>
        <div class="bannerText">Nível concluído</div>
        <div class="sub">${escapeHtml(level.name)}</div>
    </div>`;

    if (result.unlockedLevel) {
        const unlocked = levelById(result.unlockedLevel);
        html += `<div class="unlockNote">🔓 Nível ${unlocked.id} desbloqueado — ${escapeHtml(unlocked.name)}</div>`;
    }

    html += starChecklist(result);
    html += statTable([
        ['Tempo', fmtTime(result.ms)],
        ['Guloseimas', `${result.candies}/${result.totalCandies}`],
        ...(result.stomps ? [['Guardiões pisados', String(result.stomps)]] : []),
        ['Corações por gastar', String(result.heartsLeft)],
        ['Pontos do nível', fmtPoints(result.score)],
        ['Total no jogo', fmtPoints(totalScore())]
    ]);

    if (result.improved) html += '<div class="sectionLabel">Nova melhor marca neste nível</div>';
    else {
        const best = bestOf(result.levelId);
        if (best) html += `<div class="sectionLabel">Melhor marca: ${fmtPoints(best.score)} pts · ${fmtTime(best.ms)}</div>`;
    }

    html += `<div class="resultActions">
        ${hasNext ? `<button class="btn" id="nextLevelBtn">Nível ${nextId} →</button>` : '<div class="sectionLabel">Chegaste ao fim dos níveis que há. Vêm mais.</div>'}
        <button class="btnOutline" id="retryBtn">Repetir o nível</button>
        <button class="btnOutline" id="levelsBtn">Escolher nível</button>
    </div>`;
    return html;
}

function renderFailed(result) {
    const level = levelById(result?.levelId);
    return `<div class="resultHead">
        <div class="resultMedal">💔</div>
        <div class="bannerText failed">Sem corações</div>
        <div class="sub">${escapeHtml(level?.name || '')}</div>
    </div>
    ${statTable([
        ['Guloseimas apanhadas', `${result?.candies ?? 0}/${result?.totalCandies ?? 0}`],
        ['Tempo em jogo', fmtTime(result?.ms || 0)]
    ])}
    <p class="resultHint">${escapeHtml(level?.hint || '')}</p>
    <div class="resultActions">
        <button class="btn" id="retryBtn">Tentar outra vez</button>
        <button class="btnOutline" id="levelsBtn">Escolher nível</button>
    </div>`;
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
