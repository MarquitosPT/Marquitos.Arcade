# Marquitos.Arcade

Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

Blazor Web App (.NET 10, render mode Interactive Server) com ASP.NET Core Identity e SQLite, em `src/MarquitosArcade/`. Substituiu o antigo servidor Node/Express + `scores.json` que o site usava originalmente — o site é multi-página (não uma SPA) e o iOS Safari reavalia o modo standalone da PWA a cada navegação de página completa; a "enhanced navigation" do Blazor evita esse full page reload. A mudança também abriu caminho para login de amigos e leaderboard persistido em BD.

## Estrutura

- `src/MarquitosArcade/wwwroot/index.html`, `styles.css`: portal principal com branding e catálogo de jogos. `styles.css` é a folha de estilos global do site — cobre o portal, a página de pontuações e as páginas de conta (`/Account/...`); os jogos têm os seus próprios estilos, autocontidos.
- `src/MarquitosArcade/wwwroot/pontuacoes.html`, `pontuacoes.js`: página dedicada às pontuações, com um painel por jogo carregado dinamicamente a partir da API.
- `src/MarquitosArcade/wwwroot/games/tasca-do-ze/`: mini-jogo "Tasca do Zé" (gestão de pedidos), com leaderboard persistido via `/api/scores/tasca-do-ze`.
- `src/MarquitosArcade/wwwroot/games/pong/`: Pong Retro, com modo 1 jogador (vs. CPU, pontuação submetida via `/api/scores/pong`) e 2 jogadores.
- `src/MarquitosArcade/Scores/ScoresEndpoints.cs`: endpoint genérico `GET/POST /api/scores/:gameId`, persistido na tabela `Scores` (EF Core + SQLite). Se o pedido vier de um utilizador autenticado, o nome do leaderboard vem da conta (evita spoofing de nomes); caso contrário aceita o nome livre submetido pelo jogo.
- `src/MarquitosArcade/Data/`: `ApplicationDbContext`, `ApplicationUser` e as migrations do EF Core.
- `src/MarquitosArcade/Components/Account/`: páginas de login/registo/gestão de conta scaffolded pelo template Identity do ASP.NET Core (login em `/Account/Login`, registo em `/Account/Register`, gestão em `/Account/Manage`). Sem confirmação por email — não há servidor de email configurado, por isso ficaria a bloquear amigos convidados.

## Correr localmente

```bash
cd src/MarquitosArcade
dotnet run
```

As migrações do EF Core aplicam-se automaticamente no arranque (`Database.Migrate()` em `Program.cs`), incluindo a criação do `Data/app.db` na primeira execução.

## Servidor único vs. um serviço por jogo

A arcada usa **um único processo ASP.NET Core** para todos os jogos, em vez de um serviço por jogo. Razões:

- O Azure App Service `marquitos-arcade.azurewebsites.net` corre um único App Service — ter vários serviços implicaria vários Web Apps ou um proxy reverso à frente deles, complexidade desnecessária para jogos casuais de baixo tráfego.
- Os jogos são maioritariamente estáticos (HTML/CSS/JS/canvas no browser); só precisam de backend para o leaderboard persistente. O endpoint `/api/scores/:gameId` é genérico e serve qualquer jogo novo sem duplicar código de servidor.
- Uma única base SQLite simplifica o deploy e o backup.

Se algum jogo precisar de lógica de servidor muito diferente (ex. websockets para multiplayer em tempo real), faz sentido isolá-lo num serviço próprio nessa altura — não antes.

## Adicionar um jogo novo

1. Criar `src/MarquitosArcade/wwwroot/games/<slug>/index.html` (pode ser um ficheiro único autocontido, como os atuais, com os seus próprios estilos).
2. Se precisar de leaderboard persistente, chamar `GET/POST /api/scores/<slug>`.
3. Adicionar um `<article class="game-card">` em `wwwroot/index.html` a apontar para `./games/<slug>/`.
4. Adicionar o jogo ao array `GAMES` em `wwwroot/pontuacoes.js` para aparecer na página de pontuações.

## Pontuações

Não há dashboard na página principal — as pontuações vivem todas em `pontuacoes.html`, que gera um painel por jogo (a partir do array `GAMES` em `pontuacoes.js`) e busca o leaderboard de cada um via `GET /api/scores/:gameId`.

## Deploy (Azure App Service)

O workflow `.github/workflows/main_marquitos-arcade.yml` publica `src/MarquitosArcade` e faz deploy para o App Service `marquitos-arcade` a cada push em `main`. Para a base de dados sobreviver a deploys, a connection string (`ConnectionStrings__DefaultConnection`) deve apontar para um caminho persistente do App Service (ex.: `/home/data/app.db`), não para dentro da pasta de conteúdo publicada.
