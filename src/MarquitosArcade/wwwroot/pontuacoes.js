const GAMES = [
  { id: "tasca-do-ze", name: "Tasca do Zé", emoji: "🍽️" },
  { id: "pong", name: "Pong Retro", emoji: "🏓" },
];

const scoresMain = document.querySelector("#scores-main");

GAMES.forEach((game) => {
  scoresMain.appendChild(buildPanel(game));
});

GAMES.forEach((game) => loadScores(game.id));

// Se a página abrir com um #jogo no URL (vindo do catálogo), destaca esse painel.
if (location.hash) {
  const target = document.querySelector(location.hash);
  if (target) {
    target.classList.add("highlight");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function buildPanel(game) {
  const panel = document.createElement("section");
  panel.className = "game-panel";
  panel.id = game.id;

  panel.innerHTML = `
    <div class="game-panel-head">
      <h2><span aria-hidden="true">${game.emoji}</span> ${escapeHtml(game.name)}</h2>
      <button class="refresh-btn" type="button" data-game="${game.id}">↻ Atualizar</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pontuação</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody data-body="${game.id}">
          <tr><td colspan="4" class="empty-state">A carregar pontuações...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  panel
    .querySelector(".refresh-btn")
    .addEventListener("click", () => loadScores(game.id));

  return panel;
}

function loadScores(gameId) {
  const tbody = document.querySelector(`tbody[data-body="${gameId}"]`);
  tbody.innerHTML = `<tr><td colspan="4" class="empty-state">A carregar pontuações...</td></tr>`;

  fetch(`/api/scores/${gameId}`)
    .then((res) => {
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    })
    .then((scores) => renderScores(gameId, scores))
    .catch(() => {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">⚠️ Não foi possível ligar ao servidor. Tenta atualizar.</td></tr>`;
    });
}

function renderScores(gameId, scores) {
  const tbody = document.querySelector(`tbody[data-body="${gameId}"]`);

  if (!Array.isArray(scores) || scores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Ainda não há pontuações registadas. Sê o primeiro! 🎮</td></tr>`;
    return;
  }

  tbody.innerHTML = scores
    .map((entry, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1;
      return `
        <tr>
          <td>${medal}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${entry.score}</td>
          <td>${formatDate(entry.ts)}</td>
        </tr>`;
    })
    .join("");
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch (e) {
    return "—";
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
