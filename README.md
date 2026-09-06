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

## Nova arquitetura em curso: Blazor Web App + SQLite (`src/MarquitosArcade`)

O portal está a migrar do servidor Node/Express + `scores.json` para uma **Blazor Web App** (.NET 10, render mode Interactive Server) em `src/MarquitosArcade/`, que vai substituir por completo o `server.js` atual. Motivação: o site é multi-página (não uma SPA), e o iOS Safari reavalia o modo standalone da PWA a cada navegação de página completa — a "enhanced navigation" do Blazor evita esse full page reload. Isto também abre caminho para login de amigos e leaderboard persistido em BD, coisas difíceis de fazer bem só com ficheiros estáticos.

Estado atual desta fase (auth + BD, UI dos jogos inalterada):

- **ASP.NET Core Identity + SQLite** (`src/MarquitosArcade/Data/`) substitui o `scores.json` — login/registo de amigos em `/Account/Login` e `/Account/Register`, sem confirmação por email (não há servidor de email configurado).
- **`/api/scores/:gameId`** (GET/POST) foi reimplementado em `Scores/ScoresEndpoints.cs` com o mesmo contrato JSON do `server.js`, agora persistido na tabela `Scores` (EF Core). Se o pedido vier de um utilizador autenticado, o nome do leaderboard vem da conta (evita spoofing); caso contrário mantém-se o comportamento atual de nome livre.
- Os jogos (`games/tasca-do-ze`, `games/pong`) e o portal (`index.html`, `pontuacoes.html`) foram copiados tal e qual para `wwwroot/` — zero alterações à UI dos jogos nesta fase, só um link "👤 Entrar" novo na nav.
- A base de dados aplica as migrações automaticamente no arranque (`Database.Migrate()` em `Program.cs`).

Para correr localmente:

```bash
cd src/MarquitosArcade
dotnet run
```

**Ainda por fazer antes de isto substituir a produção (Azure App Service `marquitos-arcade`, atualmente Node):**

1. Mudar a *stack* do App Service de Node para .NET 10 (ação no portal Azure, fora do alcance deste repositório).
2. Apontar a connection string (`ConnectionStrings__DefaultConnection`) para um caminho persistente do App Service (ex.: `/home/data/app.db`), para o SQLite e os utilizadores não serem apagados a cada deploy.
3. Atualizar `.github/workflows/main_marquitos-arcade.yml` para publicar o projeto .NET em vez do `npm install`/Node atual.
4. Só depois disto validado, remover `server.js`, `web.config`, `package.json` e os ficheiros estáticos duplicados na raiz.
