// Ecrã de resultados: fim de corrida e fim de torneio.
//
// A pontuação enviada para o leaderboard não é a posição: é posição + tempo,
// para uma vitória folgada valer mais do que uma à tangente, e para o modo
// torneio (três corridas) poder somar.

import { escapeHtml } from '/lib/arcade/index.js';

import { LAPS_REQUIRED, MODE_TOURNAMENT, RACE_POINTS, TOURNAMENT_CUPS } from './config.js';
import { fmtTime, ordinal } from './format.js';
import { muteEngine } from './audio.js';
import { spawnConfetti } from './particles.js';
import { startRace } from './race.js';
import { scores } from './scores.js';
import { race, session } from './state.js';
import { els, overlays, topBar } from './ui.js';

/**
 * Ritmo de referência, em unidades do mundo por segundo. Dele sai o tempo a
 * bater em cada pista: abaixo dele, cada 25 ms poupado vale um ponto.
 *
 * O tempo de referência vem do comprimento da pista e não de um número fixo.
 * Fixo, a pista mais curta rendia sempre mais pontos do que as outras, e o
 * quadro de pontuações passava a dizer quem escolheu a pista mais curta em vez
 * de quem correu melhor. Assim o bónus mede o ritmo que se levou, e as pistas
 * compridas valem a pena. O valor está afinado para dar os mesmos ~70 s de
 * sempre nas três pistas originais, para as pontuações já guardadas
 * continuarem a valer o mesmo que as novas.
 */
const REFERENCE_SPEED = 270;
const TIME_BONUS_PER_MS = 25;
const referenceMs = (track) => (track.total * LAPS_REQUIRED / REFERENCE_SPEED) * 1000;
/** Multiplicador dos pontos de posição na pontuação do leaderboard. */
const POSITION_WEIGHT = 20;

/** A taça que se está a correr, para os resultados dizerem qual foi. */
const cupName = () => (TOURNAMENT_CUPS[session.cupIdx] || { name: '' }).name;

/** Medalha do pódio; a partir do 4.º lugar é o próprio número. */
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ordinal(rank));

/** Chamado quando o jogador pede para voltar ao menu. Registado pelo main.js. */
let onReturnToMenu = () => {};
export function setReturnToMenuHandler(handler) {
    onReturnToMenu = handler;
}

export function showResultScreen() {
    race.phase = 'result';
    muteEngine();
    topBar.setInGame(false);

    const playerEntry = race.finishSnapshot.find((e) => e.key === 'player');
    const raceTimeMs = race.clock * 1000;
    const raceScore = RACE_POINTS[playerEntry.rank - 1] * POSITION_WEIGHT
        + Math.max(0, Math.floor((referenceMs(race.track) - raceTimeMs) / TIME_BONUS_PER_MS));
    session.playerScore += raceScore;

    for (const entry of race.finishSnapshot) {
        session.tournamentPoints[entry.key] = (session.tournamentPoints[entry.key] || 0) + RACE_POINTS[entry.rank - 1];
    }

    const isTournament = session.mode === MODE_TOURNAMENT;
    const isLastRace = session.raceIndex >= session.tracks.length - 1;

    els.resultBody.innerHTML = isTournament && isLastRace
        ? renderTournamentEnd()
        : renderRaceEnd(playerEntry, raceTimeMs, raceScore, isTournament);

    overlays.show('result');

    if (!isTournament) scores.submitQuietly(session.playerBoardName, session.playerScore);

    wireResultButtons();
}

function renderRaceEnd(playerEntry, raceTimeMs, raceScore, isTournament) {
    let html = `<div class="resultHead">
        <div class="resultMedal">${medal(playerEntry.rank)}</div>
        <div class="bannerText">${ordinal(playerEntry.rank)} lugar</div>
        <div class="sub">${escapeHtml(race.track.name)}</div>
    </div>`;
    html += resultTable(race.finishSnapshot.map((entry) => ({
        key: entry.key, rank: entry.rank, name: entry.name, color: entry.color
    })));

    if (isTournament) {
        html += `<div class="sectionLabel">Taça ${escapeHtml(cupName())} · corrida ${session.raceIndex + 1} de ${session.tracks.length}</div>`;
        html += resultTable(standingsRows());
        html += '<div class="resultActions"><button class="btn" id="nextRaceBtn">Próxima corrida →</button></div>';
    } else {
        html += statRow([['Tempo', fmtTime(raceTimeMs)], ['Pontos', `+${raceScore}`]]);
        html += '<div class="resultActions">'
            + '<button class="btn" id="againBtn">Correr outra vez</button>'
            + '<button class="btnOutline" id="menuBtn">Menu</button>'
            + '</div>';
    }
    return html;
}

function renderTournamentEnd() {
    const rows = standingsRows();
    const playerFinal = rows.findIndex((row) => row.key === 'player') + 1;

    let html = `<div class="resultHead">
        <div class="resultMedal">${playerFinal === 1 ? '🏆' : medal(playerFinal)}</div>
        <div class="bannerText">Taça ${escapeHtml(cupName())} concluída</div>
        <div class="sub">${playerFinal === 1 ? 'Campeão da arcade!' : `${ordinal(playerFinal)} lugar no campeonato`}</div>
    </div>`;
    html += resultTable(rows);
    html += statRow([['Pontuação total', String(session.playerScore)]]);
    html += '<div class="resultActions"><button class="btn" id="menuBtn">Voltar ao menu</button></div>';

    scores.submitQuietly(session.playerBoardName, session.playerScore);
    if (playerFinal <= 3) spawnConfetti();
    return html;
}

/** Métricas do fim da corrida, em cartões lado a lado. */
function statRow(stats) {
    const cells = stats
        .map(([label, value]) => `<div class="stat"><span class="statLabel">${label}</span><span class="statValue">${value}</span></div>`)
        .join('');
    return `<div class="statRow">${cells}</div>`;
}

/** Participantes por pontos de campeonato, do primeiro para o último. */
function standingsRows() {
    return session.participants
        .map((p) => ({ key: p.key, name: p.name, color: p.color, points: session.tournamentPoints[p.key] || 0 }))
        .sort((a, b) => b.points - a.points)
        .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Tabela de uma classificação. Serve a da corrida e a do campeonato: a única
 * diferença é a coluna dos pontos, que só existe quando as linhas os trazem.
 * @param {Array<{ key: string, rank: number, name: string, color: string, points?: number }>} rows
 */
function resultTable(rows) {
    const body = rows.map((row) => {
        const points = row.points === undefined ? '' : `<td class="points">${row.points} pts</td>`;
        return `<tr class="${row.key === 'player' ? 'me' : ''}">`
            + `<td class="medal">${medal(row.rank)}</td>`
            + `<td class="name"><span class="swatch" style="background:${row.color};color:${row.color}"></span>${escapeHtml(row.name)}</td>`
            + `${points}</tr>`;
    }).join('');
    return `<table class="resultTable"><tbody>${body}</tbody></table>`;
}

/** Os botões são recriados a cada resultado, por isso ligam-se depois do innerHTML. */
function wireResultButtons() {
    const nextBtn = document.getElementById('nextRaceBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            session.raceIndex++;
            startRace(session.tracks[session.raceIndex]);
        });
    }

    const againBtn = document.getElementById('againBtn');
    if (againBtn) againBtn.addEventListener('click', () => onReturnToMenu('again'));

    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', () => onReturnToMenu('menu'));
}
