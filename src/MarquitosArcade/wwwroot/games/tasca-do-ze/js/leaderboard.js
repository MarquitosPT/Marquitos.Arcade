// Quadro de pontuações da tasca.

import { escapeHtml } from '/lib/arcade/dom.js';
import { scores } from './scores.js';
import { els } from './ui.js';

const OFFLINE_NOTE = '⚠️ Sem ligação ao servidor — a mostrar dados guardados neste aparelho.';

function renderRows(board) {
    els.leaderboardList.innerHTML = '';

    if (!board.length) {
        els.leaderboardList.innerHTML = '<p class="empty-board">Ainda não há pontuações.<br>Sê o primeiro a jogar! 🍳</p>';
        return;
    }

    board.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        // O nome vem de outro jogador: escapar é obrigatório.
        row.innerHTML =
            `<span class="lb-rank">${medal}</span>`
            + `<span class="lb-name">${escapeHtml(entry.name)}</span>`
            + `<span class="lb-score">${entry.score}</span>`;
        els.leaderboardList.appendChild(row);
    });
}

export function renderLeaderboard() {
    els.leaderboardList.innerHTML = '<p class="empty-board">A carregar pontuações...</p>';
    return scores.fetchBoard().then((result) => {
        renderRows(result.board);
        if (result.ok) return;
        const note = document.createElement('p');
        note.className = 'empty-board';
        note.style.marginTop = '4px';
        note.textContent = OFFLINE_NOTE;
        els.leaderboardList.appendChild(note);
    });
}
