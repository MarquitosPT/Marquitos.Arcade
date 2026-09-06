// Servidor geral do Marquitos Arcade.
// Serve o site estático (portal + todos os mini-jogos em games/*) e expõe
// uma API de pontuações genérica, partilhada por qualquer jogo que precise
// de um leaderboard persistente no servidor.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'scores.json');

app.use(cors());
app.use(express.json());

function loadAllScores() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveAllScores(allScores) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(allScores, null, 2));
}

function sanitizeGameId(gameId) {
  return typeof gameId === 'string' ? gameId.replace(/[^a-z0-9-]/gi, '').slice(0, 40) : '';
}

function sanitizeName(name) {
  if (typeof name !== 'string') return 'Anónimo';
  let clean = name.replace(/<[^>]*>/g, '').trim();
  clean = clean.slice(0, 24);
  return clean || 'Anónimo';
}

// GET /api/scores/:gameId -> devolve o top 20 desse jogo
app.get('/api/scores/:gameId', (req, res) => {
  const gameId = sanitizeGameId(req.params.gameId);
  if (!gameId) return res.status(400).json({ error: 'Jogo inválido' });

  const allScores = loadAllScores();
  const scores = Array.isArray(allScores[gameId]) ? allScores[gameId] : [];
  res.json(scores.slice(0, 20));
});

// POST /api/scores/:gameId { name, score } -> adiciona uma pontuação e devolve o novo top 20
app.post('/api/scores/:gameId', (req, res) => {
  const gameId = sanitizeGameId(req.params.gameId);
  if (!gameId) return res.status(400).json({ error: 'Jogo inválido' });

  const { name, score } = req.body || {};
  const cleanName = sanitizeName(name);
  const cleanScore = Number.isFinite(score) ? Math.max(0, Math.min(999999, Math.round(score))) : null;

  if (cleanScore === null) {
    return res.status(400).json({ error: 'Pontuação inválida' });
  }

  const allScores = loadAllScores();
  let scores = Array.isArray(allScores[gameId]) ? allScores[gameId] : [];
  scores.push({ name: cleanName, score: cleanScore, ts: Date.now() });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 200); // guarda algum histórico a mais internamente

  allScores[gameId] = scores;
  saveAllScores(allScores);
  res.json(scores.slice(0, 20));
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log('Marquitos Arcade a correr na porta ' + PORT);
});
