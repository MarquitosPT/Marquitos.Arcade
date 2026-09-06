# Marquitos.Arcade

Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

## Estrutura

- `index.html`, `styles.css`: portal principal com branding e catálogo de jogos.
- `pontuacoes.html`, `pontuacoes.js`: página dedicada às pontuações, com um painel por jogo carregado dinamicamente a partir da API.
- `games/tasca-do-ze/`: mini-jogo "Tasca do Zé" (gestão de pedidos), com leaderboard persistido no servidor via `/api/scores/tasca-do-ze`.
- `games/pong/`: Pong Retro, com modo 1 jogador (vs. CPU, pontuação submetida via `/api/scores/pong`) e 2 jogadores.
- `server.js`: servidor Node/Express único que serve todo o site estático (portal + jogos) e a API de pontuações genérica `/api/scores/:gameId`, persistida em `scores.json`.

## Servidor único vs. um servidor por jogo

A arcada usa **um único servidor Node/Express** (`server.js`) para todos os jogos, em vez de um servidor por jogo. Razões:

- O Azure App Service `marquitos-arcade.azurewebsites.net` corre um único processo Node numa única porta — ter vários servidores implicaria vários Web Apps ou um proxy reverso à frente deles, o que é complexidade desnecessária para jogos casuais de baixo tráfego.
- Os jogos são maioritariamente estáticos (HTML/CSS/JS no browser); só precisam de backend quando têm leaderboard persistente. O endpoint `/api/scores/:gameId` é genérico e serve qualquer jogo novo sem duplicar código de servidor.
- Um único `scores.json` (`{ "tasca-do-ze": [...], "pong": [...] }`) simplifica o deploy e o backup.

Se algum jogo precisar de lógica de servidor muito diferente (ex. websockets para multiplayer em tempo real), faz sentido isolá-lo num serviço próprio nessa altura — não antes.

## Adicionar um jogo novo

1. Criar `games/<slug>/index.html` (pode ser um ficheiro único autocontido, como os atuais).
2. Se precisar de leaderboard persistente, chamar `GET/POST /api/scores/<slug>`.
3. Adicionar um `<article class="game-card">` em `index.html` a apontar para `./games/<slug>/`.
4. Adicionar o jogo ao array `GAMES` em `pontuacoes.js` para aparecer na página de pontuações.

## Pontuações

Não há dashboard na página principal — as pontuações vivem todas em `pontuacoes.html`, que gera um painel por jogo (a partir do array `GAMES` em `pontuacoes.js`) e busca o leaderboard de cada um via `GET /api/scores/:gameId`. Os dados são persistidos no servidor em `scores.json`.
