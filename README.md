# Marquitos.Arcade

Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

Blazor Web App (.NET 10, render mode Interactive Server) com ASP.NET Core Identity e SQLite, em `src/MarquitosArcade/`. Substituiu o antigo servidor Node/Express + `scores.json` que o site usava originalmente — o site é multi-página (não uma SPA) e o iOS Safari reavalia o modo standalone da PWA a cada navegação de página completa; a "enhanced navigation" do Blazor evita esse full page reload. A mudança também abriu caminho para login de amigos e leaderboard persistido em BD.

## Estrutura

- `src/MarquitosArcade/Components/Pages/Home.razor`, `wwwroot/styles.css`: portal principal com branding e catálogo de jogos. O catálogo é gerado a partir do array `Catalog` no `@code` da página — cada jogo é um cartão com a sua capa, o título em overlay e a cor/lettering próprios (classes `.theme-*`). `styles.css` é a folha de estilos global do site — cobre o portal, a página de pontuações e as páginas de conta (`/Account/...`); os jogos têm os seus próprios estilos, autocontidos. Ver [Tema](#tema-glass-claro-e-escuro).
- `src/MarquitosArcade/wwwroot/theme.js`: escolha do tema claro/escuro (ver [Tema](#tema-glass-claro-e-escuro)).
- `src/MarquitosArcade/wwwroot/covers/`: capas 16:9 dos jogos (WebP) usadas no catálogo — são screenshots reais de cada jogo, gerados por `tools/covers/` (ver [Capas dos jogos](#capas-dos-jogos)).
- `src/MarquitosArcade/wwwroot/pontuacoes.html`, `pontuacoes.js`: página dedicada às pontuações, com um painel por jogo carregado dinamicamente a partir da API.
- `src/MarquitosArcade/wwwroot/games/tasca-do-ze/`: mini-jogo "Tasca do Zé" (gestão de pedidos), com leaderboard persistido via `/api/scores/tasca-do-ze`.
- `src/MarquitosArcade/wwwroot/games/pong/`: Pong Retro, com modo 1 jogador (vs. CPU, pontuação submetida via `/api/scores/pong`) e 2 jogadores.
- `src/MarquitosArcade/Scores/ScoresEndpoints.cs`: endpoint genérico `GET/POST /api/scores/:gameId`, persistido na tabela `Scores` (EF Core + SQLite). Se o pedido vier de um utilizador autenticado, o nome do leaderboard vem da conta (evita spoofing de nomes); caso contrário aceita o nome livre submetido pelo jogo.
- `src/MarquitosArcade/Data/`: `ApplicationDbContext`, `ApplicationUser` e as migrations do EF Core.
- `src/MarquitosArcade/Components/Account/`: páginas de login/registo/gestão de conta scaffolded pelo template Identity do ASP.NET Core (login em `/Account/Login`, registo em `/Account/Register`, gestão em `/Account/Manage`). Sem confirmação por email — não há servidor de email configurado, por isso ficaria a bloquear amigos convidados.

## Tema (glass, claro e escuro)

O site usa um tema "glass": superfícies de vidro fosco (`backdrop-filter`) sobre um fundo animado de auroras de néon, em duas variantes — clara e escura.

O estado do tema vive no atributo `data-theme` do `<html>`:

| `data-theme`     | significado                                    |
| ---------------- | ---------------------------------------------- |
| *(sem atributo)* | segue o sistema (`prefers-color-scheme`)       |
| `light`          | claro, por escolha explícita do utilizador     |
| `dark`           | escuro, por escolha explícita do utilizador    |

O botão na barra de topo (`MainLayout.razor`) cicla entre os três estados. A lógica está em `wwwroot/theme.js`, carregado no `<head>` antes do primeiro paint para não haver "flash" do tema errado, e guarda a escolha em `localStorage`. O ícone visível do botão é escolhido por CSS a partir do `data-theme` — nada de JS a repintar DOM, por isso sobrevive à *enhanced navigation* do Blazor (que troca o `<body>` sem recarregar a página) sem o site precisar de render mode interativo.

Em `styles.css` as cores são todas tokens CSS (`--bg`, `--glass-bg`, `--accent`, ...) definidos três vezes: no `:root` (claro, a base), no `@media (prefers-color-scheme: dark)` restringido a `:root:not([data-theme="light"])`, e em `:root[data-theme="dark"]`. Nenhuma cor pode ter a sua única definição dentro do media query, senão a escolha explícita do utilizador deixa de ganhar. Para acrescentar uma cor nova, acrescenta-a nos três sítios.

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
3. Gerar a capa do jogo: acrescentar uma receita ao array `GAMES` em `tools/covers/capture-covers.mjs` e correr o script (ver [Capas dos jogos](#capas-dos-jogos)).
4. Adicionar uma entrada ao array `Catalog` em `Components/Pages/Home.razor` (slug, título, tagline, descrição, emoji, tema e capa) e, se o tema for novo, uma classe `.theme-<jogo>` em `styles.css` com a cor (`--game-accent`), o fundo da capa (`--cover-bg`) e o lettering do jogo.
5. Adicionar o jogo ao array `Games` em `Components/Pages/Pontuacoes.razor` para aparecer na página de pontuações.

## Capas dos jogos

Cada cartão do catálogo mostra um screenshot real do jogo — capturado a jogar, não um mockup — com o título em overlay num banner, no lettering e na cor do próprio jogo. As imagens vivem em `wwwroot/covers/<slug>.webp` (16:9, 960x540).

Para as regerar (por exemplo, depois de mudar o aspeto de um jogo):

```bash
cd tools/covers
npm install          # playwright
npx playwright install chromium

# noutro terminal: cd src/MarquitosArcade && dotnet run
node capture-covers.mjs --base http://localhost:5000
node capture-covers.mjs --base http://localhost:5000 --only pong   # só um jogo
```

O script abre cada jogo num Chromium headless, joga-o com o guião definido no array `GAMES`, recorta a zona interessante em 16:9 e grava o WebP. Como os jogos têm elementos aleatórios (pedidos, ângulo da bola, posição dos carros), cada execução dá um fotograma diferente — vale a pena espreitar o resultado antes de fazer commit.

Jogos que ainda não existem não têm screenshot: o `Maze Run` usa um labirinto gerado por `tools/covers/make-maze-placeholder.mjs` (`wwwroot/covers/maze-run.svg`).

## Pontuações

Não há dashboard na página principal — as pontuações vivem todas em `pontuacoes.html`, que gera um painel por jogo (a partir do array `GAMES` em `pontuacoes.js`) e busca o leaderboard de cada um via `GET /api/scores/:gameId`.

## Deploy (Azure App Service)

O workflow `.github/workflows/main_marquitos-arcade.yml` publica `src/MarquitosArcade` e faz deploy para o App Service `marquitos-arcade` a cada push em `main`. Para a base de dados sobreviver a deploys, a connection string (`ConnectionStrings__DefaultConnection`) deve apontar para um caminho persistente do App Service (ex.: `/home/data/app.db`), não para dentro da pasta de conteúdo publicada.
