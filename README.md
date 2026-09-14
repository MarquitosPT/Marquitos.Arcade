# Marquitos.Arcade

Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

**Em linha: [arcade.marquitos.pt](https://arcade.marquitos.pt)**

Blazor Web App (.NET 10, render mode Interactive Server) com ASP.NET Core Identity e SQLite, em `src/MarquitosArcade/`. Substituiu o antigo servidor Node/Express + `scores.json` que o site usava originalmente — o site é multi-página (não uma SPA) e o iOS Safari reavalia o modo standalone da PWA a cada navegação de página completa; a "enhanced navigation" do Blazor evita esse full page reload. A mudança também abriu caminho para login de amigos e leaderboard persistido em BD.

## Estrutura

- `src/MarquitosArcade/Components/Pages/Home.razor`, `wwwroot/styles.css`: portal principal com branding e catálogo de jogos. O catálogo é gerado a partir do array `Catalog` no `@code` da página — cada jogo é um cartão com a sua capa, o título em overlay e a cor/lettering próprios (classes `.theme-*`). `styles.css` é a folha de estilos global do site — cobre o portal, a página de pontuações e as páginas de conta (`/Account/...`); cada jogo tem as suas próprias folhas de estilo, em `games/<slug>/css/`. Ver [Tema](#tema-glass-claro-e-escuro).
- `src/MarquitosArcade/wwwroot/theme.js`: escolha do tema claro/escuro (ver [Tema](#tema-glass-claro-e-escuro)).
- `src/MarquitosArcade/wwwroot/covers/`: capas 16:9 dos jogos (WebP) usadas no catálogo — são screenshots reais de cada jogo, gerados por `tools/covers/` (ver [Capas dos jogos](#capas-dos-jogos)).
- `src/MarquitosArcade/Components/Pages/Pontuacoes.razor`: página dedicada às pontuações em `/pontuacoes`, com um painel por jogo (array `Games` no `@code`). Lê os tops diretamente da base de dados no servidor, via `ScoresEndpoints.GetTopScoresAsync` — o mesmo método que serve o endpoint `GET /api/scores/:gameId`, mas sem passar por HTTP.
- `src/MarquitosArcade/wwwroot/games/<slug>/`: um jogo por pasta, cada um com o seu `index.html` (só markup), `css/`, `js/` (módulos ES) e `assets/`. Ver [Estrutura de um jogo](#estrutura-de-um-jogo) e, para o porquê desta organização em vez de um projeto .NET por jogo, [docs/estrutura-dos-jogos.md](docs/estrutura-dos-jogos.md).
  - `tasca-do-ze/`: mini-jogo "Tasca do Zé" (gestão de pedidos), com leaderboard persistido via `/api/scores/tasca-do-ze`.
  - `pong/`: Pong Retro, com modo 1 jogador (vs. CPU, pontuação submetida via `/api/scores/pong`) e 2 jogadores.
  - `pixel-racing/`: Pixel Racing, corrida simples ou campeonato de três pistas, com pontuação via `/api/scores/pixel-racing`. O menu tem dois passos: o primeiro ecrã pergunta só o nome (a quem não tem sessão iniciada) e o modo; a pista, a cor do carro e a dificuldade ficam no ecrã seguinte, já a saber o que se vai correr. A cor sai da paleta única de `CAR_COLORS` e os adversários ficam com três das restantes, por isso nunca há dois carros da mesma cor na pista.
- `src/MarquitosArcade/wwwroot/lib/arcade/`: SDK partilhado pelos jogos (áudio, leaderboard, armazenamento, viewport do canvas, ciclo de jogo, barra de topo). Módulos ES sem dependências externas.
- `tools/games/smoke-test.mjs`: smoke-test dos jogos em Chromium headless, corrido em cada pull request por `.github/workflows/jogos-smoke-test.yml`. Ver [Testar os jogos](#testar-os-jogos).
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

Os jogos têm folhas de estilo próprias, mas seguem a mesma linguagem. O Pixel
Racing é o exemplo: os ecrãs são painéis de vidro por cima da pista — o
`backdrop-filter` desfoca o canvas que está a desenhar por trás, por isso o menu
mostra a pista escolhida, viva, em vez de um fundo pintado. Os tokens estão em
`games/pixel-racing/css/theme.css` e ali só existe a variante escura (o mundo do
jogo é escuro em todas as pistas, e vidro claro por cima dele não teria
contraste). O HUD, esse, é desenhado no canvas, onde não há `backdrop-filter`:
o vidro é imitado à mão com fundo translúcido, contorno de 1px e um risco de luz
no topo (`glassPanel` em `js/render.js`).

## Correr localmente

```bash
cd src/MarquitosArcade
dotnet run
```

As migrações do EF Core aplicam-se automaticamente no arranque (`Database.Migrate()` em `Program.cs`), incluindo a criação do `Data/app.db` na primeira execução.

## Servidor único vs. um serviço por jogo

A arcada usa **um único processo ASP.NET Core** para todos os jogos, em vez de um serviço por jogo. Razões:

- A arcada corre num único Azure App Service (`marquitos-arcade`) — ter vários serviços implicaria vários Web Apps ou um proxy reverso à frente deles, complexidade desnecessária para jogos casuais de baixo tráfego.
- Os jogos são maioritariamente estáticos (HTML/CSS/JS/canvas no browser); só precisam de backend para o leaderboard persistente. O endpoint `/api/scores/:gameId` é genérico e serve qualquer jogo novo sem duplicar código de servidor.
- Uma única base SQLite simplifica o deploy e o backup.

Se algum jogo precisar de lógica de servidor muito diferente (ex. websockets para multiplayer em tempo real), faz sentido isolá-lo num serviço próprio nessa altura — não antes.

## Estrutura de um jogo

Cada jogo é uma pasta com os seus ficheiros — não um projeto .NET. O porquê dessa
escolha (e quando é que vale a pena mudar) está em
[docs/estrutura-dos-jogos.md](docs/estrutura-dos-jogos.md).

```
wwwroot/games/<slug>/
  index.html        markup apenas — sem <style> nem <script> inline
  css/              uma folha por zona do ecrã (base, hud, screens, ...)
  js/
    main.js         ponto de entrada, carregado com <script type="module">
    config.js       constantes de afinação, sem lógica
    state.js        estado mutável da partida
    ...             um módulo por área (física, desenho, controlos, áudio)
  assets/           PNG, SVG e sons deste jogo
```

Regras que mantêm isto arrumado:

- **`index.html` é só markup.** Zero CSS e zero JavaScript inline.
- **Um módulo, um assunto.** Se um ficheiro precisa de duas frases para se descrever, são dois módulos.
- **Números de afinação vivem no `config.js`**, não espalhados pelo código.
- **O que é comum a dois jogos vai para o SDK** em `wwwroot/lib/arcade/`.

### SDK partilhado

Os jogos importam o que têm em comum de `wwwroot/lib/arcade/`, por caminho absoluto:

```js
import { createViewport, createLoop } from '/lib/arcade/index.js';
import { createScoreClient } from '/lib/arcade/scores.js';
```

| Módulo        | O que resolve                                                    |
| ------------- | ---------------------------------------------------------------- |
| `audio.js`    | Ciclo de vida do `AudioContext` e bips sintetizados              |
| `scores.js`   | Cliente de `/api/scores/:gameId`, cache offline, nome do jogador e da conta |
| `storage.js`  | `localStorage` que não rebenta em Safari privado                 |
| `viewport.js` | Canvas em ecrã inteiro, nítido em Retina e por baixo do notch     |
| `loop.js`     | Ciclo `requestAnimationFrame` com delta-time limitado            |
| `dom.js`      | Seletores, `escapeHtml`, grupos de ecrãs e de botões             |
| `topbar.js`   | Barra de topo comum (arcada, pontuações, pausa, sair)            |
| `math.js`     | `clamp`, `lerp`, ângulos, aleatórios, `shuffle`                  |

## Testar os jogos

`tools/games/smoke-test.mjs` abre cada jogo num Chromium headless, joga-o durante
alguns segundos e falha se houver erro de JavaScript, módulo ou folha de estilos
que não carregue, ecrã inicial em branco, ou canvas que não chegue a desenhar.

Serve os ficheiros com um servidor estático próprio, por isso **não é preciso ter
o ASP.NET a correr nem o SDK do .NET instalado**. Os pedidos a `/api/*` respondem
503 de propósito — os jogos têm de aguentar o servidor em baixo, e isso fica assim
coberto pelo teste.

```bash
cd tools/games
npm install
npx playwright install chromium         # só na primeira vez

node smoke-test.mjs                     # todos os jogos
node smoke-test.mjs --only pong         # só um
```

Corre em cada pull request pelo workflow `.github/workflows/jogos-smoke-test.yml`
— o workflow de deploy só arranca depois do merge em `main`, por isso sem isto
nada verificava uma mudança antes de entrar. Se falhar, os screenshots de cada
jogo ficam anexados à execução como artefacto, para se ver em que ecrã o jogo se
perdeu.

Para refactors, o par `--out`/`--compare` compara os ecrãs antes e depois. O ecrã
de menu é determinístico e tem de bater certo ao pixel; os fotogramas de jogo
variam com o relógio e são informativos:

```bash
git worktree add /tmp/antes HEAD
node smoke-test.mjs --root /tmp/antes/src/MarquitosArcade/wwwroot --out /tmp/ref
node smoke-test.mjs --out /tmp/novo --compare /tmp/ref
```

## Adicionar um jogo novo

1. Criar `src/MarquitosArcade/wwwroot/games/<slug>/` com a estrutura acima. O `pong/` é o mais pequeno dos três e serve bem de modelo.
2. Se precisar de leaderboard persistente, usar `createScoreClient('<slug>')` do SDK, que fala com `GET/POST /api/scores/<slug>`.
3. Acrescentar o jogo ao array `GAMES` em `tools/games/smoke-test.mjs`, com um guião que o jogue durante alguns segundos.
4. Gerar a capa do jogo: acrescentar uma receita ao array `GAMES` em `tools/covers/capture-covers.mjs` e correr o script (ver [Capas dos jogos](#capas-dos-jogos)).
5. Adicionar uma entrada ao array `Catalog` em `Components/Pages/Home.razor` (slug, título, tagline, descrição, emoji, tema e capa) e, se o tema for novo, uma classe `.theme-<jogo>` em `styles.css` com a cor (`--game-accent`), o fundo da capa (`--cover-bg`) e o lettering do jogo.
6. Adicionar o jogo ao array `Games` em `Components/Pages/Pontuacoes.razor` para aparecer na página de pontuações.

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

Não há dashboard na página principal — as pontuações vivem todas em
`Components/Pages/Pontuacoes.razor`, que gera um painel por jogo a partir do
array `Games` no `@code` da página.

A página é renderizada no servidor e lê os tops diretamente da base de dados com
`ScoresEndpoints.GetTopScoresAsync`. É o mesmo método por trás de
`GET /api/scores/:gameId`, mas chamado sem passar por HTTP: os jogos é que usam
o endpoint, a partir do browser.

O parâmetro `?jogo=<slug>` destaca o painel desse jogo — é o que o botão 🏆 da
barra de topo dos jogos usa, junto com a âncora `#<slug>`.

## Deploy (Azure App Service)

O workflow `.github/workflows/main_marquitos-arcade.yml` publica `src/MarquitosArcade` e faz deploy para o App Service `marquitos-arcade` a cada push em `main`. O site é servido em [arcade.marquitos.pt](https://arcade.marquitos.pt), um domínio próprio apontado a esse App Service.

O domínio próprio não é cosmético. O Azure já não dá a Web Apps novas um endereço
simples: gera um sufixo único por app, do género
`marquitos-arcade-<sufixo>.spaincentral-01.azurewebsites.net`. Se a Web App for
recriada, esse endereço muda. Por isso o README não o refere, e o workflow também
não: identifica o destino pelo **nome** do App Service (`app-name: 'marquitos-arcade'`),
que se mantém. Recriar a Web App com o mesmo nome não obriga a mexer no deploy;
só é preciso reapontar o DNS.

Para a base de dados sobreviver a deploys, a connection string (`ConnectionStrings__DefaultConnection`) deve apontar para um caminho persistente do App Service (ex.: `/home/data/app.db`), não para dentro da pasta de conteúdo publicada.
