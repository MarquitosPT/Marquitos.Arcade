const storageKey = "marquitosArcadeScores";
const rollButton = document.querySelector("#roll-btn");
const resultBox = document.querySelector("#result-box");
const playerInput = document.querySelector("#player-name");

rollButton.addEventListener("click", () => {
  const playerName = (playerInput.value || "Anónimo").trim() || "Anónimo";
  const dieOne = randomDie();
  const dieTwo = randomDie();
  const total = dieOne + dieTwo;
  const points = calculateScore(total);

  resultBox.innerHTML = `
    <p>Dado 1: <strong>${dieOne}</strong></p>
    <p>Dado 2: <strong>${dieTwo}</strong></p>
    <p>Total: <strong>${total}</strong></p>
    <p>Pontos ganhos: <strong>${points}</strong></p>
  `;

  saveArcadeScore({
    player: playerName,
    game: "Tasca do Zé",
    score: points,
    createdAt: new Date().toISOString().slice(0, 10),
  });
});

function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function calculateScore(total) {
  if (total === 7) return 180;
  if (total === 6 || total === 8) return 120;
  if (total === 5 || total === 9) return 80;
  if (total === 4 || total === 10) return 50;
  return 20;
}

function saveArcadeScore(entry) {
  const existingRaw = localStorage.getItem(storageKey);
  let entries = [];
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed)) entries = parsed;
    } catch (error) {
      console.error("Falha ao carregar pontuações da arcade.", error);
      entries = [];
    }
  }
  entries.push(entry);
  localStorage.setItem(storageKey, JSON.stringify(entries));
}
