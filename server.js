// Servidor de pontuações para o jogo "Tasca do Zé"
// Guarda as pontuações num ficheiro JSON simples e expõe uma API para o jogo consultar.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'scores.json');
const GAME_FILE = path.join(__dirname, 'tasca-do-ze-online.html');

app.use(cors());          // permite que o jogo, alojado noutro domínio, chame esta API
app.use(express.json());  // interpreta o corpo dos pedidos POST como JSON

function loadScores() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveScores(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2));
}

function sanitizeName(name) {
  if (typeof name !== 'string') return 'Anónimo';
  let clean = name.replace(/<[^>]*>/g, '').trim();
  clean = clean.slice(0, 24);
  return clean || 'Anónimo';
}

// GET /api/scores -> devolve o top 20
app.get('/api/scores', (req, res) => {
  const scores = loadScores();
  res.json(scores.slice(0, 20));
});

// POST /api/scores { name, score } -> adiciona uma pontuação e devolve o novo top 20
app.post('/api/scores', (req, res) => {
  const { name, score } = req.body || {};
  const cleanName = sanitizeName(name);
  const cleanScore = Number.isFinite(score) ? Math.max(0, Math.min(999999, Math.round(score))) : null;

  if (cleanScore === null) {
    return res.status(400).json({ error: 'Pontuação inválida' });
  }

  let scores = loadScores();
  scores.push({ name: cleanName, score: cleanScore, ts: Date.now() });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 200); // guarda algum histórico a mais internamente

  saveScores(scores);
  res.json(scores.slice(0, 20));
});

function sendGame(res) {
  res.sendFile(GAME_FILE);
}

app.get('/', (req, res) => {
  sendGame(res);
});

app.get('/tasca-do-ze-online.html', (req, res) => {
  sendGame(res);
});

app.listen(PORT, () => {
  console.log('Servidor a correr na porta ' + PORT);
});
