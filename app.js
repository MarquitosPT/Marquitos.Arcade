const STORAGE_KEY = "marquitosArcadeScores";

const gameCatalog = [
  "Tasca do Zé",
  "Pong Retro",
  "Pixel Racer",
  "Maze Run",
];

const seedScores = [
  { player: "MarquitosPT", game: "Tasca do Zé", score: 180, createdAt: "2026-09-06" },
  { player: "Luna", game: "Tasca do Zé", score: 140, createdAt: "2026-09-06" },
  { player: "Nuno", game: "Pong Retro", score: 95, createdAt: "2026-09-06" },
];

const filterSelect = document.querySelector("#game-filter");
const gameInput = document.querySelector("#game-input");
const scoreBoardBody = document.querySelector("#scoreboard-body");
const form = document.querySelector("#score-form");
const formMessage = document.querySelector("#form-message");

const bestScoreRef = document.querySelector("#best-score");
const activeGamesRef = document.querySelector("#active-games");
const totalEntriesRef = document.querySelector("#total-entries");

let scores = loadScores();

renderGameOptions();
renderDashboard("all");

filterSelect.addEventListener("change", () => renderDashboard(filterSelect.value));

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const player = String(form.player.value || "").trim();
  const game = String(form.game.value || "").trim();
  const score = Number(form.score.value);

  if (!player || !game || !Number.isInteger(score) || score < 1) {
    formMessage.textContent = "Preenche os campos com valores válidos.";
    return;
  }

  scores.push({
    player,
    game,
    score,
    createdAt: new Date().toISOString().slice(0, 10),
  });

  saveScores(scores);
  renderDashboard(filterSelect.value);
  form.reset();
  formMessage.textContent = "Pontuação registada no dashboard.";
});

function loadScores() {
  const rawValue = localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    saveScores(seedScores);
    return [...seedScores];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      console.error("Formato de pontuações inválido em localStorage.");
      return [...seedScores];
    }
    return parsed;
  } catch (error) {
    console.error("Falha ao ler pontuações guardadas.", error);
    return [...seedScores];
  }
}

function saveScores(nextScores) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextScores));
}

function renderGameOptions() {
  const optionsHtml = [
    `<option value="all">Todos os jogos</option>`,
    ...gameCatalog.map((gameName) => `<option value="${gameName}">${gameName}</option>`),
  ].join("");

  filterSelect.innerHTML = optionsHtml;
  gameInput.innerHTML = gameCatalog
    .map((gameName) => `<option value="${gameName}">${gameName}</option>`)
    .join("");
}

function renderDashboard(gameFilter) {
  const selectedScores =
    gameFilter === "all" ? scores : scores.filter((entry) => entry.game === gameFilter);

  const sortedScores = selectedScores.slice().sort((a, b) => b.score - a.score);

  if (sortedScores.length === 0) {
    scoreBoardBody.innerHTML = `
      <tr>
        <td colspan="5">Sem pontuações para este filtro.</td>
      </tr>`;
  } else {
    scoreBoardBody.innerHTML = sortedScores
      .map(
        (entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(entry.player)}</td>
          <td>${escapeHtml(entry.game)}</td>
          <td>${entry.score}</td>
          <td>${entry.createdAt}</td>
        </tr>`
      )
      .join("");
  }

  bestScoreRef.textContent = String(sortedScores[0]?.score ?? 0);
  totalEntriesRef.textContent = String(selectedScores.length);
  activeGamesRef.textContent = String(new Set(scores.map((entry) => entry.game)).size);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
