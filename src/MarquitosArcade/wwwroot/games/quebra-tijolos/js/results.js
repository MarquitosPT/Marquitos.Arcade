import { escapeHtml } from '/lib/arcade/index.js';

import { LIVES, MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { levelById, levelCount } from './levels.js';
import { bestOf, totalScore } from './progress.js';
import { game } from './state.js';
import { els, overlays, topBar } from './ui.js';

let onAction = () => {};
export function setResultHandler(handler) {
    onAction = handler;
}

function stars(count) {
    return Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < count ? '' : 'off'}">★</i>`).join('');
}

function statTable(rows) {
    return `<table class="statTable"><tbody>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="statValue">${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>`;
}

function checklist(result, level) {
    const items = [
        [true, 'Limpar a muralha'],
        [result.livesLeft === LIVES, `Guardar as ${LIVES} vidas`],
        [result.ms <= level.targetMs, `Dentro do alvo (${fmtTime(level.targetMs)})`]
    ];
    return `<ul class="starChecklist">${items.map(([ok, text]) => `<li class="${ok ? 'ok' : ''}"><i aria-hidden="true">${ok ? '★' : '☆'}</i>${escapeHtml(text)}</li>`).join('')}</ul>`;
}

function renderCleared(result) {
    const level = levelById(result.levelId);
    const nextId = result.levelId + 1;
    const hasNext = nextId <= levelCount();
    let html = `<div class="resultHead">
        <div class="resultStars" role="img" aria-label="${result.stars} de ${MAX_STARS} estrelas">${stars(result.stars)}</div>
        <div class="bannerText">Muralha vencida</div>
        <div class="sub">${escapeHtml(level.name)}</div>
    </div>`;

    if (result.unlockedLevel) {
        const unlocked = levelById(result.unlockedLevel);
        html += `<div class="unlockNote">🔓 Nível ${unlocked.id} desbloqueado — ${escapeHtml(unlocked.name)}</div>`;
    }

    html += checklist(result, level);
    html += statTable([
        ['Tempo', fmtTime(result.ms)],
        ['Tijolos partidos', String(result.bricks)],
        ['Vidas por gastar', String(result.livesLeft)],
        ['Pontos do nível', fmtPoints(result.score)],
        ['Total no jogo', fmtPoints(result.total)]
    ]);

    if (result.improved) html += '<div class="sectionLabel">Nova melhor marca neste nível</div>';
    else {
        const best = bestOf(result.levelId);
        if (best) html += `<div class="sectionLabel">Melhor marca: ${fmtPoints(best.score)} pts · ${fmtTime(best.ms)}</div>`;
    }

    html += `<div class="resultActions">
        ${hasNext ? `<button class="btn" id="nextLevelBtn" type="button">Nível ${nextId} →</button>` : `<div class="sectionLabel">Já limpaste as ${levelCount()} muralhas.</div>`}
        <button class="btnOutline" id="retryBtn" type="button">Repetir o nível</button>
        <button class="btnOutline" id="levelsBtn" type="button">Escolher nível</button>
    </div>`;
    return html;
}

function renderFailed(result) {
    const level = levelById(result?.levelId);
    return `<div class="resultHead">
        <div class="resultMedal">💔</div>
        <div class="bannerText failed">Sem vidas</div>
        <div class="sub">${escapeHtml(level?.name || '')}</div>
    </div>
    ${statTable([
        ['Tempo em jogo', fmtTime(result?.ms || 0)],
        ['Tijolos por partir', String(result?.bricksLeft || 0)],
        ['Pontos desta tentativa', fmtPoints(result?.score || 0)],
        ['Total guardado', fmtPoints(totalScore())]
    ])}
    <p class="resultHint">${escapeHtml(level?.hint || '')}</p>
    <div class="resultActions">
        <button class="btn" id="retryBtn" type="button">Tentar outra vez</button>
        <button class="btnOutline" id="levelsBtn" type="button">Escolher nível</button>
    </div>`;
}

function wireButtons() {
    const result = game.result;
    els.resultBody.querySelector('#nextLevelBtn')?.addEventListener('click', () => onAction('next', result.levelId + 1));
    els.resultBody.querySelector('#retryBtn')?.addEventListener('click', () => onAction('retry', result.levelId));
    els.resultBody.querySelector('#levelsBtn')?.addEventListener('click', () => onAction('levels'));
}

export function showResultScreen() {
    game.phase = 'result';
    topBar.setInGame(false);
    els.resultBody.innerHTML = game.result?.cleared ? renderCleared(game.result) : renderFailed(game.result);
    overlays.show('result');
    wireButtons();
}
