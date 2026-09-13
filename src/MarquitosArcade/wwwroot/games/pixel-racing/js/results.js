// Ecrã de resultados: fim de corrida e fim de torneio.
//
// A pontuação enviada para o leaderboard não é a posição: é posição + tempo,
// para uma vitória folgada valer mais do que uma à tangente, e para o modo
// torneio (três corridas) poder somar.

import { MODE_TOURNAMENT, RACE_POINTS } from './config.js';
import { fmtTime, ordinal } from './format.js';
import { muteEngine } from './audio.js';
import { spawnConfetti } from './particles.js';
import { startRace } from './race.js';
import { scores } from './scores.js';
import { race, session } from './state.js';
import { els, overlays, topBar } from './ui.js';

/** Tempo de referência: abaixo disto, cada 25ms poupado vale um ponto. */
const TIME_BONUS_BASE_MS = 70000;
const TIME_BONUS_PER_MS = 25;
/** Multiplicador dos pontos de posição na pontuação do leaderboard. */
const POSITION_WEIGHT = 20;

const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '4️⃣');

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
        + Math.max(0, Math.floor((TIME_BONUS_BASE_MS - raceTimeMs) / TIME_BONUS_PER_MS));
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

    if (!isTournament) scores.submitQuietly(session.participants[0].name, session.playerScore);

    wireResultButtons();
}

function renderRaceEnd(playerEntry, raceTimeMs, raceScore, isTournament) {
    let html = `<div class="sub" style="letter-spacing:0.15em;">${race.track.name.toUpperCase()}</div>`;
    html += `<div class="bannerText" style="margin-bottom:10px;">${medal(playerEntry.rank)} ${ordinal(playerEntry.rank)} LUGAR</div>`;
    html += '<table class="resultTable"><tbody>';
    for (const entry of race.finishSnapshot) {
        html += `<tr class="${entry.key === 'player' ? 'me' : ''}"><td class="medal">${medal(entry.rank)}</td>`
            + `<td><span class="swatch" style="background:${entry.color}"></span>${entry.name}</td></tr>`;
    }
    html += '</tbody></table>';

    if (isTournament) {
        html += `<div class="sectionLabel" style="margin-top:14px;">CLASSIFICAÇÃO DO TORNEIO — CORRIDA ${session.raceIndex + 1}/${session.tracks.length}</div>`;
        html += standingsTable(currentStandings());
        html += '<button class="btn" id="nextRaceBtn">PRÓXIMA CORRIDA →</button>';
    } else {
        html += `<div class="sectionLabel" style="margin-top:10px;">Tempo: ${fmtTime(raceTimeMs)} · Pontos: ${raceScore}</div>`;
        html += '<button class="btn" id="againBtn">CORRIDA OUTRA VEZ</button><button class="btnOutline" id="menuBtn">MENU</button>';
    }
    return html;
}

function renderTournamentEnd() {
    const standings = currentStandings();
    const playerFinal = standings.findIndex((s) => s.key === 'player') + 1;

    let html = '<div class="bannerText" style="margin-bottom:6px;">🏁 TORNEIO CONCLUÍDO</div>';
    html += `<div class="sub" style="letter-spacing:0.15em;">${playerFinal === 1 ? 'CAMPEÃO DA ARCADE!' : `${ordinal(playerFinal)} LUGAR NO TORNEIO`}</div>`;
    html += standingsTable(standings);
    html += `<div class="sectionLabel" style="margin-top:10px;">Pontuação total: ${session.playerScore}</div>`;
    html += '<button class="btn" id="menuBtn">VOLTAR AO MENU</button>';

    scores.submitQuietly(session.participants[0].name, session.playerScore);
    if (playerFinal <= 3) spawnConfetti();
    return html;
}

/** Participantes por pontos de campeonato, do primeiro para o último. */
function currentStandings() {
    return Object.keys(session.tournamentPoints)
        .map((key) => ({
            key,
            points: session.tournamentPoints[key],
            info: session.participants.find((p) => p.key === key)
        }))
        .sort((a, b) => b.points - a.points);
}

function standingsTable(standings) {
    let html = '<table class="resultTable"><tbody>';
    standings.forEach((entry, index) => {
        html += `<tr class="${entry.key === 'player' ? 'me' : ''}"><td class="medal">${medal(index + 1)}</td>`
            + `<td><span class="swatch" style="background:${entry.info.color}"></span>${entry.info.name}</td>`
            + `<td>${entry.points} pts</td></tr>`;
    });
    return `${html}</tbody></table>`;
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
