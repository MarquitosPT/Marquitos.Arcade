const storageKey = "marquitosArcadeScores";
const canvas = document.querySelector("#pong-canvas");
const ctx = canvas.getContext("2d");
const scoreBoard = document.querySelector("#score-board");
const statusText = document.querySelector("#status");
const restartButton = document.querySelector("#restart-btn");
const playerInput = document.querySelector("#player-name");

const paddle = { x: 18, y: 150, width: 14, height: 82, speed: 5 };
const enemy = { x: canvas.width - 32, y: 150, width: 14, height: 82, speed: 4.2 };
const ball = { x: canvas.width / 2, y: canvas.height / 2, size: 12, vx: -4.5, vy: 3.2 };

let score = 0;
let gameOver = false;
let upPressed = false;
let downPressed = false;

restartButton.addEventListener("click", resetGame);
document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);

requestAnimationFrame(gameLoop);

function onKeyDown(event) {
  if (event.key === "ArrowUp") upPressed = true;
  if (event.key === "ArrowDown") downPressed = true;
}

function onKeyUp(event) {
  if (event.key === "ArrowUp") upPressed = false;
  if (event.key === "ArrowDown") downPressed = false;
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function update() {
  if (gameOver) return;

  if (upPressed) paddle.y -= paddle.speed;
  if (downPressed) paddle.y += paddle.speed;
  paddle.y = clamp(paddle.y, 0, canvas.height - paddle.height);

  const enemyMid = enemy.y + enemy.height / 2;
  if (enemyMid < ball.y) enemy.y += enemy.speed;
  if (enemyMid > ball.y) enemy.y -= enemy.speed;
  enemy.y = clamp(enemy.y, 0, canvas.height - enemy.height);

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y <= 0 || ball.y + ball.size >= canvas.height) {
    ball.vy *= -1;
  }

  if (isColliding(paddle, ball) && ball.vx < 0) {
    ball.vx *= -1.04;
    ball.vy += (ball.y + ball.size / 2 - (paddle.y + paddle.height / 2)) * 0.045;
    score += 10;
    scoreBoard.textContent = `Pontuação: ${score}`;
  }

  if (isColliding(enemy, ball) && ball.vx > 0) {
    ball.vx *= -1;
    ball.vy += (ball.y + ball.size / 2 - (enemy.y + enemy.height / 2)) * 0.03;
  }

  if (ball.x < -ball.size) {
    finishGame();
  }

  if (ball.x > canvas.width + ball.size) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = -Math.abs(ball.vx);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#7b8cff";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

  ctx.fillStyle = "#3bf5ff";
  ctx.fillRect(ball.x, ball.y, ball.size, ball.size);

  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function finishGame() {
  gameOver = true;
  statusText.textContent = "Fim de jogo. Clica em Recomeçar para nova partida.";
  saveArcadeScore({
    player: (playerInput.value || "Anónimo").trim() || "Anónimo",
    game: "Pong Retro",
    score,
    createdAt: new Date().toISOString().slice(0, 10),
  });
}

function resetGame() {
  score = 0;
  gameOver = false;
  statusText.textContent = "";
  scoreBoard.textContent = "Pontuação: 0";
  paddle.y = 150;
  enemy.y = 150;
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.vx = -4.5;
  ball.vy = 3.2;
}

function isColliding(rect, movingBall) {
  return (
    movingBall.x < rect.x + rect.width &&
    movingBall.x + movingBall.size > rect.x &&
    movingBall.y < rect.y + rect.height &&
    movingBall.y + movingBall.size > rect.y
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
