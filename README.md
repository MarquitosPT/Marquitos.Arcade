# Marquitos.Arcade

Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

**Em linha: [arcade.marquitos.pt](https://arcade.marquitos.pt)**

Blazor Web App (.NET 10, render mode Interactive Server) com ASP.NET Core Identity e SQLite, em `src/MarquitosArcade/`. Substituiu o antigo servidor Node/Express + `scores.json` que o site usava originalmente — o site é multi-página (não uma SPA) e o iOS Safari reavalia o modo standalone da PWA a cada navegação de página completa; a "enhanced navigation" do Blazor evita esse full page reload. A mudança também abriu caminho para login de amigos e leaderboard persistido em BD.

## Estrutura

- `src/MarquitosArcade/Components/Pages/Home.razor`, `wwwroot/styles.css`: portal principal com branding e catálogo de jogos. O catálogo é gerado a partir do array `Catalog` no `@code` da página — cada jogo é um cartão com a sua capa, o título em overlay e a cor/lettering próprios (classes `.theme-*`). `styles.css` é a folha de estilos global do site — cobre o portal, a página de pontuações e as páginas de conta (`/Account/...`); cada jogo tem as suas próprias folhas de estilo, em `games/<slug>/css/`. Ver [Tema](#tema-glass-claro-e-escuro).
- `src/MarquitosArcade/wwwroot/theme.js`: escolha do tema claro/escuro (ver [Tema](#tema-glass-claro-e-escuro)).
- `src/MarquitosArcade/wwwroot/covers/`: capas 16:9 dos jogos (WebP) usadas no catálogo — são screenshots reais de cada jogo, gerados por `tools/covers/` (ver [Capas dos jogos](#capas-dos-jogos)).
- `src/MarquitosArcade/Components/Pages/Pontuacoes.razor`: página dedicada às pontuações em `/pontuacoes`, com um painel por jogo (array `Games` no `@code`). Lê os tops diretamente da base de dados no servidor, via `ScoresEndpoints.GetTopScoresAsync` — o mesmo método que serve o endpoint `GET /api/scores/:gameId`, mas sem passar por HTTP.
- `src/MarquitosArcade/Components/Pages/Privacidade.razor` e `Suporte.razor`: as duas páginas de texto — política de privacidade em `/privacidade` e suporte em `/suporte`. São os URLs apontados pela app na App Store (política de privacidade e suporte), por isso são para manter estáveis. Chega-se lá pela nota no fim da home, a seguir ao catálogo (`.home-meta` em `Home.razor`) — e não pelo rodapé, que é uma barra de uma linha onde os links partiam a linha em ecrãs estreitos. O texto vive no próprio `.razor` (não há CMS nem markdown por trás), no painel de vidro das páginas simples (`.page-shell`), com a tipografia longa na secção `.longform` do `styles.css`. Duas notas ao mexer nelas: a política tem duas datas a actualizar (a do topo e a da linha de versão no fim), e o suporte diz que a arcada não envia emails — se algum dia houver servidor de email configurado, a resposta sobre a palavra-passe esquecida deixa de ser verdade.
- `src/MarquitosArcade/wwwroot/games/<slug>/`: um jogo por pasta, cada um com o seu `index.html` (só markup), `css/`, `js/` (módulos ES) e `assets/`. Ver [Estrutura de um jogo](#estrutura-de-um-jogo) e, para o porquê desta organização em vez de um projeto .NET por jogo, [docs/estrutura-dos-jogos.md](docs/estrutura-dos-jogos.md).
  - `tasca-do-ze/`: mini-jogo "Tasca do Zé" (gestão de pedidos), com leaderboard persistido via `/api/scores/tasca-do-ze`.
  - `pong/`: Pong Retro, com modo 1 jogador (vs. CPU, pontuação submetida via `/api/scores/pong`) e 2 jogadores.
  - `maze-run/`: Maze Run, labirintos por níveis — apanhar os cristais abre a saída, e há guardas a impedi-lo. Os níveis vão-se desbloqueando à medida que se concluem, e o progresso fica guardado na conta de quem tem sessão iniciada (ver [Progresso e níveis](#progresso-e-níveis)). Os labirintos não estão desenhados à mão: saem de uma semente por nível (`buildMaze` em `js/maze.js`), como as pistas do Pixel Racing saem do `buildTrack` — **acrescentar um nível é acrescentar uma entrada ao array `LEVELS` do `js/levels.js`**, e mais nada.
  - `pixel-racing/`: Pixel Racing, corrida simples em qualquer uma das seis pistas ou campeonato de três, com pontuação via `/api/scores/pixel-racing`. O menu tem dois passos: o primeiro ecrã pergunta só o nome (a quem não tem sessão iniciada) e o modo; a pista (ou a taça, no campeonato), a cor do carro e a dificuldade ficam no ecrã seguinte, já a saber o que se vai correr. As pistas são geradas por `buildTrack` a partir de uma superelipse com harmónicos, e o grau de perícia que o cartão mostra é medido no traçado (`corneringProfile`) em vez de escrito à mão: as três primeiras fazem-se sem levantar o pé, as três da taça Pro são mais compridas, mais estreitas e têm curvas que obrigam a travar ou a entrar a derrapar. A cor sai da paleta única de `CAR_COLORS` e os adversários ficam com três das restantes, por isso nunca há dois carros da mesma cor na pista.
- `src/MarquitosArcade/wwwroot/lib/arcade/`: SDK partilhado pelos jogos (áudio, leaderboard, armazenamento, viewport do canvas, ciclo de jogo, barra de topo, ecrã de arranque). Módulos ES sem dependências externas. O `splash.css`/`splash.js`/`splash-boot.js` são a exceção que também serve o portal — ver [Ecrã de arranque](#ecrã-de-arranque).
- `tools/games/smoke-test.mjs`: smoke-test dos jogos em Chromium headless, corrido em cada pull request por `.github/workflows/jogos-smoke-test.yml`. Ver [Testar os jogos](#testar-os-jogos).
- `.github/workflows/build-dotnet.yml`: compila o site (`dotnet build`) em cada pull request — o smoke-test dos jogos não passa pelo compilador. Ver [Compilar o site num pull request](#compilar-o-site-num-pull-request).
- `src/MarquitosArcade/Scores/ScoresEndpoints.cs`: endpoint genérico `GET/POST /api/scores/:gameId`, persistido na tabela `Scores` (EF Core + SQLite). Se o pedido vier de um utilizador autenticado, o nome do leaderboard vem da conta (evita spoofing de nomes); caso contrário aceita o nome livre submetido pelo jogo.
- `src/MarquitosArcade/Progress/ProgressEndpoints.cs`: endpoint genérico `GET/PUT /api/progress/:gameId`, para os jogos com níveis. Guarda um JSON opaco por (conta, jogo) na tabela `GameProgress`. Ver [Progresso e níveis](#progresso-e-níveis).
- `src/MarquitosArcade/Scores/ScoreMaintenance.cs`: limpeza da tabela `Scores` no arranque — apaga as pontuações que ficaram a apontar para contas já eliminadas. Ver [Pontuações](#pontuações).
- `src/MarquitosArcade/Web/CachePolicy.cs`: política de cache HTTP — `immutable` para os URLs com impressão digital (`?v=`), `no-cache` para todo o resto. Ver [Cache do browser](#cache-do-browser-e-o-site-afixado-ao-ecrã-principal).
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

## Ecrã de arranque

A arcada e cada jogo abrem com o logótipo em ecrã inteiro, "A carregar..." e uma
barra a crescer, sobre um fundo de raios e pixel art (`wwwroot/lib/arcade/splash.css`,
`splash.js` e `splash-boot.js`). O markup vive na página que o mostra — em
`Components/App.razor` no portal, no `index.html` de cada jogo —, porque tem de
estar pintado no primeiro frame, antes de correr JavaScript nenhum.

**Fica no ar 2 segundos, mesmo quando já está tudo pronto.** É de propósito: dá à
arcada um arranque de consola em vez de um salto seco para o menu. O `splash.js`
gere três relógios para isso não se virar contra o jogador:

| Relógio       | O que faz                                                        |
| ------------- | ---------------------------------------------------------------- |
| `minDuration` | O chão. 2s por omissão; muda-se com `data-splash-min` no markup. |
| `ready()`     | O conteúdo por baixo está montado. Sem ele a barra pára nos 92%. |
| `maxDuration` | O teto. Aos 12s desiste de esperar e sai na mesma.               |

Quem chama `ready()` é o `main.js` de cada jogo (`window.__arcadeSplash?.ready()`,
no mesmo espírito do `window.__arcadeTheme` do tema); se ninguém chamar, o `load`
da página serve de sinal. E o CSS ainda tem um último travão — uma animação que
esconde o ecrã aos 15s — para o caso de o próprio `splash-boot.js` não chegar a
correr: um módulo em falta nunca pode deixar o site tapado para sempre. É também
por isso que o `splash-boot.js` é carregado pelo seu próprio `<script>` e não vem
pela cadeia de imports do jogo: se o `main.js` rebentar a carregar, o ecrã de
arranque sai na mesma e vê-se o erro em vez de uma barra eterna.

Duas diferenças entre o portal e os jogos:

- **O portal arranca uma vez por separador** (`data-splash-once="session"`). Sem
  isto, ir de `/` para `/pontuacoes` custava 2 segundos de cada vez. Os jogos não
  levam o atributo, por isso arrancam sempre que se abre um.
- **O portal precisa do `reapply()`.** Pela mesma razão que o tema (ver acima), a
  enhanced navigation ressincroniza o `<body>` com o HTML do servidor — e esse
  HTML traz sempre o ecrã de arranque. O `data-permanent` no elemento e o
  `reapply()` no `enhancedload` garantem que ele não volta do fundo do baú.

O fundo não é uma imagem: são gradientes e sprites SVG embutidos no CSS, para não
custar nenhum pedido extra logo no arranque. Só o logótipo (`logo3.png`) é um
ficheiro, e vai com `<link rel="preload">` em todas as páginas. É isso que também
lhe permite servir retrato e paisagem sem cortes — nada tem tamanho fixo, e em
`@media (orientation: portrait)` a pixel art sai do meio e vai para as quatro
pontas, para não cair por cima do logótipo num ecrã estreito.

Ao contrário do resto do site, este ecrã é sempre escuro: a arte da arcada é
escura e trocar de tema a meio do arranque dava um flash. Os tokens de cor dele
vivem só no `splash.css`.

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
| `progress.js` | Cliente de `/api/progress/:gameId`: níveis desbloqueados e marcas, na conta e no aparelho |
| `storage.js`  | `localStorage` que não rebenta em Safari privado                 |
| `viewport.js` | Canvas em ecrã inteiro, nítido em Retina e por baixo do notch     |
| `loop.js`     | Ciclo `requestAnimationFrame` com delta-time limitado            |
| `dom.js`      | Seletores, `escapeHtml`, grupos de ecrãs e de botões             |
| `topbar.js`   | Barra de topo comum (arcada, pontuações, pausa, sair)            |
| `splash.js`   | Ecrã de arranque: tempo mínimo, barra de progresso e saída       |
| `math.js`     | `clamp`, `lerp`, ângulos, aleatórios, `shuffle`                  |

### O nome do jogador

Os três jogos resolvem o nome no mesmo sítio — `bindPlayerNameInput`, no
`scores.js` do SDK —, para o quadro de pontuações não ficar com três regras
diferentes. A ordem, da que manda para a que cede:

1. **o que o jogador escrever agora** no campo;
2. **o nome da conta**, para quem tem sessão iniciada;
3. **o nome guardado neste aparelho** numa visita anterior;
4. o **fallback** do jogo (`Tu`, `Anónimo`, `Cozinheiro(a) Anónimo`).

Duas regras que não são óbvias e que já custaram um bug:

- **O fallback nunca é guardado nem lido como nome.** Ele é a etiqueta do
  jogador dentro do jogo, não um nome escolhido. Guardá-lo fazia-o ganhar ao
  nome da conta na visita seguinte — era assim que quem tinha sessão iniciada
  acabava a correr como "Tu" no Pixel Racing.
- **Ao quadro vai `forBoard()`, não `current()`.** Quem não deu nome envia vazio
  e é o servidor que decide: o nome da conta, ou "Anónimo". Assim os três jogos
  mostram a mesma coisa na tabela, em vez de "Tu", "Anónimo" e
  "Cozinheiro(a) Anónimo" conforme o jogo de origem. O `current()` continua a
  servir o ecrã — na pista o carro é mesmo "Tu".

O servidor guarda o nome que o jogo enviar, seja quem for o jogador: quem tem de
garantir que uma pontuação de conta fica com o nome da conta é o cliente.

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

## Compilar o site num pull request

O smoke-test acima não compila nada — serve o `wwwroot` estaticamente. Quem trata
disso é o workflow `.github/workflows/build-dotnet.yml`, que corre
`dotnet build --configuration Release` em cada pull request. É de propósito o
mesmo comando do passo "Build with dotnet" do workflow de deploy: se passa no
pull request, o deploy compila.

Sem ele, um erro de C# ou de Razor só aparecia depois do merge em `main`, na
única execução que também publica. Em `main` este workflow não corre — quem
compila lá é o próprio workflow de deploy, e não vale a pena pagar o build duas
vezes.

## Adicionar um jogo novo

1. Criar `src/MarquitosArcade/wwwroot/games/<slug>/` com a estrutura acima. O `pong/` é o mais pequeno dos três e serve bem de modelo.
   Copiar de lá também o bloco `#arcadeSplash` do `index.html` (trocando o nome do jogo em `.arcade-splash-caption`), os dois `<link>` e o `<script>` do `splash-boot.js` no `<head>`, e o `window.__arcadeSplash?.ready()` no fim do `main.js` — ver [Ecrã de arranque](#ecrã-de-arranque).
2. Se precisar de leaderboard persistente, usar `createScoreClient('<slug>')` do SDK, que fala com `GET/POST /api/scores/<slug>`.
   Se tiver níveis a desbloquear, usar também `createProgressClient('<slug>')`, que fala com `GET/PUT /api/progress/<slug>` — ver [Progresso e níveis](#progresso-e-níveis).
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

Jogos que ainda não existem não têm screenshot. Enquanto o Maze Run esteve por
lançar, o cartão dele usou um labirinto desenhado à mão em SVG; agora que o jogo
existe, a capa é um fotograma dele como a dos outros, e o placeholder (e o script
que o gerava) saíram do repositório.

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

Cada linha diz também se a pontuação foi feita com sessão iniciada: as entradas
sem conta (`UserId` a `null`, o campo `registered` do `ScoreDto`) levam um
`(não registado)` em letra mais pequena a seguir ao nome (`.player-tag` no
`styles.css`). Sem conta o nome não está reservado, por isso a marca evita que
uma pontuação anónima passe por ser a de um jogador registado com o mesmo nome.

Quando alguém elimina a conta em `/Account/Manage/DeletePersonalData`, as
pontuações dessa conta saem da tabela `Scores` na mesma transação que remove o
utilizador — é o que a política de privacidade promete, e é por isso que não
ficam entradas órfãs com o nome de quem já saiu.

Isso só passou a acontecer depois de o site estar no ar, por isso o arranque
apaga também as órfãs antigas (`UserId` a apontar para uma conta que já não
existe em `AspNetUsers`), a seguir ao `Database.Migrate()` — ver
`Scores/ScoreMaintenance.cs`. Não há chave estrangeira com `ON DELETE CASCADE`
entre as duas tabelas porque acrescentá-la obrigaria o SQLite a reconstruir a
tabela `Scores` e a migration rebentaria logo nestas mesmas linhas órfãs.

## Progresso e níveis

O Maze Run é o primeiro jogo da arcada com níveis que se vão desbloqueando, e
isso obrigou a uma pergunta que as pontuações não fazem: **onde é que fica
guardado o que já se abriu?** A resposta são dois sítios, e é de propósito.

| onde                  | quem                            | o que resolve                                           |
| --------------------- | ------------------------------- | ------------------------------------------------------- |
| `localStorage`        | toda a gente                    | jogar sem conta, sem rede e sem esperar pelo servidor   |
| tabela `GameProgress` | quem tem sessão iniciada        | recomeçar em qualquer nível já aberto, noutro aparelho  |

O cliente é o `wwwroot/lib/arcade/progress.js`, partilhado — o Maze Run é o
primeiro jogo a usá-lo, mas nada nele é do Maze Run. Ele grava sempre no
aparelho primeiro e manda para o servidor a seguir, com um atraso curto para
várias mudanças seguidas irem num só pedido (e uma última gravação quando a
página se esconde, para fechar o separador a meio de um nível não custar o
nível). Sem sessão iniciada, o servidor responde `stored: false` e o jogo
continua a jogar-se na mesma — não é um erro, é um jogador sem conta.

**O servidor não sabe o que lá está dentro.** O `GET/PUT /api/progress/:gameId`
guarda um JSON opaco por (conta, jogo), com um teto de 8 kB, exatamente como o
jogo o escreveu. É a mesma escolha do endpoint das pontuações: um jogo novo com
níveis não obriga a mexer no servidor nem a criar uma migration. O que é do jogo
— a forma do objeto e a regra de junção — vive no `games/maze-run/js/progress.js`.

A regra de junção é a parte que não é óbvia. As duas cópias podem discordar (jogou-se
sem conta e iniciou-se sessão depois; jogou-se no telemóvel e no computador), e
quem ganha é **o melhor dos dois, campo a campo**: o nível mais alto aberto, mais
pontos, melhor tempo, mais estrelas. Nunca a cópia "mais recente" — a mais
recente pode ser a de um aparelho onde se jogou menos, e ninguém quer perder
níveis por ter aberto o jogo no sítio errado.

Duas notas que já custariam um bug:

- **O total de pontos não se guarda, soma-se.** É a soma do melhor resultado de
  cada nível (`totalScore`). Guardado, ficava a discordar de si próprio à
  primeira junção de duas cópias.
- **O progresso e a pontuação ficam registados quando o nível acaba**, em
  `js/level.js`, e não no ecrã de resultados: um ecrã que não chegue a montar-se
  nunca pode ser a razão de se perder o que se acabou de fazer.

Eliminar a conta apaga também o progresso, na mesma transação que remove o
utilizador e as pontuações (ver `DeletePersonalData.razor`) — é o que a política
de privacidade promete. Ao contrário da tabela `Scores`, esta nasceu já com essa
limpeza feita, por isso não há órfãs antigas para varrer no arranque.

## Cache do browser (e o site afixado ao ecrã principal)

Quem afixa a arcada ao ecrã principal do telemóvel nunca faz Ctrl+F5 — se o
browser guardar um `js/` velho, fica com ele. Para isso não acontecer, o
`Web/CachePolicy.cs` carimba o `Cache-Control` de todas as respostas:

| resposta                           | `Cache-Control`                       |
| ---------------------------------- | ------------------------------------- |
| URL com `?v=` (o que o `@Assets[]` do Blazor gera) | `public, max-age=31536000, immutable` |
| tudo o resto                       | `no-cache`                            |

`no-cache` não é "não guardes", é "guarda mas pergunta antes de usar": o browser
revalida com o `ETag` e recebe um `304` vazio quando nada mudou. Por isso os
ficheiros dos jogos (`games/<slug>/index.html`, `css/`, `js/`), que não têm
versão no URL, aparecem sempre atualizados a seguir a um deploy sem custo de
tráfego quando não mudaram.

Consequência prática ao acrescentar ficheiros a um jogo: **não é preciso fazer
nada**. Não há lista de assets para manter nem hash para escrever à mão.

O porquê desta escolha, e o que faria mudá-la, está em
[docs/cache-do-browser.md](docs/cache-do-browser.md).

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
