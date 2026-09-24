# Marquitos.Arcade

Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

**Em linha: [arcade.marquitos.pt](https://arcade.marquitos.pt)**

Blazor Web App (.NET 10, render mode Interactive Server) com ASP.NET Core Identity e SQLite, em `src/MarquitosArcade/`. Substituiu o antigo servidor Node/Express + `scores.json` que o site usava originalmente — o site é multi-página (não uma SPA) e o iOS Safari reavalia o modo standalone da PWA a cada navegação de página completa; a "enhanced navigation" do Blazor evita esse full page reload. A mudança também abriu caminho para login de amigos e leaderboard persistido em BD.

## Estrutura

- `src/MarquitosArcade/Components/Pages/Home.razor`, `wwwroot/styles.css`: portal principal com branding e catálogo de jogos. O catálogo é gerado a partir do array `Catalog` no `@code` da página — cada jogo é um cartão com a sua capa, o título em overlay e a sua cor (classes `.theme-*`). `styles.css` é a folha de estilos global do site — cobre o portal, a página de pontuações e as páginas de conta (`/Account/...`); cada jogo tem as suas próprias folhas de estilo, em `games/<slug>/css/`. Ver [Tema](#tema-glass-claro-e-escuro).
- `src/MarquitosArcade/wwwroot/theme.js`: escolha do tema claro/escuro (ver [Tema](#tema-glass-claro-e-escuro)).
- `src/MarquitosArcade/wwwroot/covers/`: capas 16:9 dos jogos (WebP) usadas no catálogo — são screenshots reais de cada jogo, gerados por `tools/covers/` (ver [Capas dos jogos](#capas-dos-jogos)).
- `src/MarquitosArcade/Components/Pages/Pontuacoes.razor`: página dedicada às pontuações em `/pontuacoes`, com um painel por jogo (array `Games` no `@code`). Lê os tops diretamente da base de dados no servidor, via `ScoresEndpoints.GetTopScoresAsync` — o mesmo método que serve o endpoint `GET /api/scores/:gameId`, mas sem passar por HTTP.
- `src/MarquitosArcade/Components/Pages/Privacidade.razor` e `Suporte.razor`: as duas páginas de texto — política de privacidade em `/privacidade` e suporte em `/suporte`. São os URLs apontados pela app na App Store (política de privacidade e suporte), por isso são para manter estáveis. Chega-se lá pela nota no fim da home, a seguir ao catálogo (`.home-meta` em `Home.razor`) — e não pelo rodapé, que é uma barra de uma linha onde os links partiam a linha em ecrãs estreitos. O texto vive no próprio `.razor` (não há CMS nem markdown por trás), no painel de vidro das páginas simples (`.page-shell`), com a tipografia longa na secção `.longform` do `styles.css`. Duas notas ao mexer nelas: a política tem duas datas a actualizar (a do topo e a da linha de versão no fim), e o suporte diz que a arcada não envia emails — se algum dia houver servidor de email configurado, a resposta sobre a palavra-passe esquecida deixa de ser verdade.
- `src/MarquitosArcade/wwwroot/games/<slug>/`: um jogo por pasta, cada um com o seu `index.html` (só markup), `css/`, `js/` (módulos ES) e `assets/`. Ver [Estrutura de um jogo](#estrutura-de-um-jogo) e, para o porquê desta organização em vez de um projeto .NET por jogo, [docs/estrutura-dos-jogos.md](docs/estrutura-dos-jogos.md).
  - `tasca-do-ze/`: mini-jogo "Tasca do Zé" (gestão de pedidos), com leaderboard persistido via `/api/scores/tasca-do-ze`.
  - `pong/`: Pong Retro, com modo 1 jogador (vs. CPU, pontuação submetida via `/api/scores/pong`) e 2 jogadores.
  - `maze-run/`: Maze Run, labirintos por níveis — apanhar os cristais abre a saída, e há guardas a impedi-lo. Pelo caminho há cristais de gelo que os congelam, portais que ligam duas pontas do labirinto e portas trancadas com a sua chave (ver [As peças do Maze Run](#as-peças-do-maze-run)). Os níveis vão-se desbloqueando à medida que se concluem, e o progresso fica guardado na conta de quem tem sessão iniciada (ver [Progresso e níveis](#progresso-e-níveis)). Os labirintos não estão desenhados à mão: saem de uma semente por nível (`buildMaze` em `js/maze.js`), como as pistas do Pixel Racing saem do `buildTrack` — **acrescentar um nível é acrescentar uma entrada ao array `LEVELS` do `js/levels.js`**, e mais nada.
  - `terras-do-reino/`: Terras do Reino, economia medieval contínua num tabuleiro isométrico com relevo — semear e colher trigo, cortar madeira, tirar pedra, abrir minas de ouro, moinhos, padarias, vacarias e oficinas, e comerciar com três vilas vizinhas geridas pelo CPU, que crescem sozinhas e são as rivais na tabela da prosperidade. Não há guerra nem fim de partida: o reino fica gravado (na conta, para quem tem sessão iniciada) e, ao voltar, recupera o tempo em que o jogo esteve fechado. Ver [Terras do Reino](#terras-do-reino).
  - `pixel-racing/`: Pixel Racing, corrida simples em qualquer uma das seis pistas ou campeonato de três, com pontuação via `/api/scores/pixel-racing`. O menu tem dois passos: o primeiro ecrã pergunta só o nome (a quem não tem sessão iniciada) e o modo; a pista (ou a taça, no campeonato), a cor do carro e a dificuldade ficam no ecrã seguinte, já a saber o que se vai correr. As pistas são geradas por `buildTrack` a partir de uma superelipse com harmónicos, e o grau de perícia que o cartão mostra é medido no traçado (`corneringProfile`) em vez de escrito à mão: as três primeiras fazem-se sem levantar o pé, as três da taça Pro são mais compridas, mais estreitas e têm curvas que obrigam a travar ou a entrar a derrapar. A cor sai da paleta única de `CAR_COLORS` e os adversários ficam com três das restantes, por isso nunca há dois carros da mesma cor na pista.
- `src/MarquitosArcade/wwwroot/lib/arcade/`: SDK partilhado pelos jogos (áudio, leaderboard, armazenamento, viewport do canvas, ciclo de jogo, barra de topo, ecrã de arranque). Módulos ES sem dependências externas. O `splash.css`/`splash.js`/`splash-boot.js` são a exceção que também serve o portal — ver [Ecrã de arranque](#ecrã-de-arranque).
- `tools/games/smoke-test.mjs`: smoke-test dos jogos em Chromium headless, corrido em cada pull request por `.github/workflows/jogos-smoke-test.yml`. Ver [Testar os jogos](#testar-os-jogos).
- `.github/workflows/build-dotnet.yml`: compila o site (`dotnet build`) em cada pull request — o smoke-test dos jogos não passa pelo compilador. Ver [Compilar o site num pull request](#compilar-o-site-num-pull-request).
- `src/MarquitosArcade/Scores/ScoresEndpoints.cs`: endpoint genérico `GET/POST /api/scores/:gameId`, persistido na tabela `Scores` (EF Core + SQLite). Se o pedido vier de um utilizador autenticado, o nome do leaderboard vem da conta (evita spoofing de nomes); caso contrário aceita o nome livre submetido pelo jogo.
- `src/MarquitosArcade/Progress/ProgressEndpoints.cs`: endpoint genérico `GET/PUT /api/progress/:gameId`, para os jogos com níveis. Guarda um JSON opaco por (conta, jogo) na tabela `GameProgress`. Ver [Progresso e níveis](#progresso-e-níveis).
- `src/MarquitosArcade/Scores/ScoreMaintenance.cs`: limpeza da tabela `Scores` no arranque — apaga as pontuações que ficaram a apontar para contas já eliminadas. Ver [Pontuações](#pontuações).
- `src/MarquitosArcade/Web/CachePolicy.cs`: política de cache HTTP — `immutable` para os URLs com impressão digital (`?v=`), `no-cache` para todo o resto. Ver [Cache do browser](#cache-do-browser-e-o-site-afixado-ao-ecrã-principal).
- `src/MarquitosArcade/Data/`: `ApplicationDbContext`, `ApplicationUser` e as migrations do EF Core.
- `src/MarquitosArcade/Components/Account/`: páginas de login/registo/gestão de conta scaffolded pelo template Identity do ASP.NET Core (login em `/Account/Login`, registo em `/Account/Register`, gestão em `/Account/Manage`). Sem confirmação por email — não há servidor de email configurado, por isso ficaria a bloquear amigos convidados. O cookie de sessão (configurado em `Program.cs`, `ConfigureApplicationCookie`) é sempre persistente e dura um ano — isto é uma arcada de amigos instalada como PWA, não um banco, e uma sessão que expirava ao fechar a app já causou pontuações publicadas como "Anónimo": o jogo continuava a mostrar o nome guardado no `localStorage` de uma visita anterior (ver [O nome do jogador](#o-nome-do-jogador)) sem o jogador reparar que a conta, essa, já não tinha sessão.

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
5. Adicionar uma entrada ao array `Catalog` em `Components/Pages/Home.razor` (slug, título, tagline, descrição, emoji, tema e capa) e, se o tema for novo, uma classe `.theme-<jogo>` em `styles.css` com a cor (`--game-accent`) e o fundo da capa (`--cover-bg`). Só isso: a tipografia dos cartões é do catálogo e é igual para todos (ver [Cartões do catálogo](#cartões-do-catálogo)).
6. Adicionar o jogo ao array `Games` em `Components/Pages/Pontuacoes.razor` para aparecer na página de pontuações.

## Cartões do catálogo

Os cartões da home estão numa grelha, e numa grelha **o cartão mais alto de uma
linha estica os outros**. Por isso duas coisas estão fixas:

- **A tipografia é do catálogo, não de cada jogo.** Todos os títulos e
  subtítulos usam a mesma letra. Cada jogo já teve o seu lettering próprio (a
  serifa da Tasca do Zé, a monoespaçada do Pong e do Pixel Racing); lado a lado
  na grelha a mistura lia-se mal. O que cada um tem de seu é a **cor**
  (`--game-accent`): pinta o risco por cima do título, o subtítulo e o halo ao
  passar o rato.
- **A descrição ocupa sempre três linhas.** Com menos, sobra o espaço; com
  mais, corta-se com reticências (`line-clamp: 3` em `.game-card-body p`, com um
  `min-height` de três linhas). Assim os cartões têm todos a mesma altura em
  qualquer largura, e quem escreve uma descrição nova não tem de contar
  caracteres — só de saber que o que passar das três linhas não se lê. Na
  prática, as que lá estão andam pelos 90 caracteres.

O risco da cor tem de ficar **acima** do topo do título: o `bottom` do
`.game-marquee::before` é menor do que o `padding-top` do `.game-marquee`. Com
os dois iguais, o risco assenta em cima das letras.

## Capas dos jogos

Cada cartão do catálogo mostra um screenshot real do jogo — capturado a jogar, não um mockup — com o título em overlay num banner, na cor do próprio jogo. As imagens vivem em `wwwroot/covers/<slug>.webp` (16:9, 960x540).

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

**O progresso guardado tem versão, e um nível novo entra no meio dos que já
havia.** As marcas estão guardadas pelo número do nível, por isso um progresso
gravado com outra numeração não diz a verdade sobre esta — o nível 3 de então
pode ser o 5 de agora. Em vez de o mostrar errado, sobe-se o `VERSION` em
`games/maze-run/js/progress.js` e recomeça-se; quem faz a recusa é o `accept`
do cliente do SDK, por onde passa tudo o que se lê, do aparelho e da conta.
Isto serve enquanto o jogo não estiver no ar: a partir daí, a marca de cada
nível tem de passar a ficar guardada por um nome próprio do nível, que não muda
quando ele muda de sítio na lista.

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

## O carrossel dos níveis

Os níveis do Maze Run não estão numa lista a rolar: estão em páginas, com setas,
arrasto e as setas do teclado. Uma lista a rolar num telemóvel esconde o que vem
a seguir atrás do próprio dedo, e num jogo de níveis o que interessa é ver de
uma vez o que já se abriu e o que falta.

**Quantos cabem numa página decide-o o CSS, não o JavaScript.** As variáveis
`--page-cols` e `--page-rows` (em `css/carousel.css`) mudam com o media query, e
o `js/carousel.js` lê-as para repartir os cartões:

| onde                        | por página  |
| --------------------------- | ----------- |
| telemóvel ao alto           | 2 × 2 = 4   |
| telemóvel ao comprido       | 3 × 1 = 3   |
| tablet e computador         | 3 × 2 = 6   |

Assim a regra de quantos cabem vive num sítio só — quem sabe o tamanho do ecrã é
o CSS. Ao rodar o aparelho o número muda, e o carrossel refaz as páginas
mantendo à vista o cartão que lá estava.

**Os cartões têm todos a mesma altura**, e isso não é acaso: cada um tem
sempre as mesmas cinco linhas, pela mesma ordem e todas presentes mesmo quando
não há nada para pôr numa delas.

| linha    | o que diz                                                       |
| -------- | --------------------------------------------------------------- |
| número   | `Nível 7`                                                        |
| nome     | uma palavra, que nunca quebra em duas linhas                     |
| peças    | portais, portas e gelo que o nível tem (vazia nos primeiros)     |
| estado   | `Conclui o nível 6`, `Por jogar` ou a melhor marca               |
| estrelas | as três, apagadas no que ainda não se fez                        |

Daí os **nomes dos níveis serem de uma palavra** (`LEVELS` em `js/levels.js`):
num cartão estreito, um nome que quebre rouba uma linha e desalinha a fila
toda. O `.levelName` ainda leva `nowrap` com reticências como rede, mas é rede
— o nome deve caber. As filas usam `grid-auto-rows: 1fr` em vez da altura do
conteúdo, senão a caixa do labirinto, que tem proporção fixa, arredondava para
um píxel diferente de fila para fila.

**As setas mudam de sítio conforme o que falta no ecrã.** Ao alto, num ecrã
estreito, descem para o fundo encostadas à direita, com os pontos das páginas à
esquerda: nos lados, cada seta roubava uns 40px de largura, quase um terço de um
cartão. Ao comprido é ao contrário — largura é o que sobra e altura o que falta
—, por isso voltam aos lados e a linha dos pontos desaparece.

Três armadilhas que este ecrã ensinou:

- **O arrasto é feito à mão, com eventos de ponteiro, e não com o scroll
  horizontal do browser.** O ecrã onde ele vive trava o gesto lateral
  (`touch-action: pan-y`, ver `css/screens.css`) para o arrasto não levar o
  documento atrás, e essa trava alcançaria também um scroll nativo lá dentro: o
  `touch-action` efetivo é a interseção do elemento com o dos seus antepassados.
- **Um arrasto acaba sempre com o dedo em cima de um cartão.** Sem o engolir, o
  clique que se segue começava o nível que calhasse estar por baixo (o
  `swallowClick` em `js/carousel.js`).
- **Os media queries desta folha estão todos no fim**, depois das regras que
  alteram. Com a mesma especificidade ganha a última: um bloco de media query
  escrito antes da regra base não faz nada, e foi assim que os pontos das
  páginas continuaram à vista ao comprido apesar do `display: none`.

E uma que não é do carrossel mas apareceu com ele: o browser aumenta sozinho o
corpo de texto de um bloco comprido quando a página fica larga (o *font
boosting*, pensado para artigos lidos ao telemóvel). Ao rodar o telemóvel, a
nota do fim deste ecrã passava a letra graúda enquanto tudo à volta ficava
igual. Quem o desliga é o `text-size-adjust: 100%` no `css/base.css`.

## As peças do Maze Run

São quarenta e oito níveis, e a curva sobe de quatro em quatro: cada degrau
apresenta ou aperta uma coisa — o tamanho do labirinto, mais um guarda, uma peça
nova — e os quatro níveis do degrau dão tempo para a aprender antes do seguinte.
Do 1 ao 4 há só cristais e dois guardas; o gelo entra no 5, os portais no 9, a
porta trancada no 17 e a segunda porta no 25.

Quarenta e oito é também o número que enche as páginas do carrossel em todos os
formatos: 12 páginas de 4 ao alto, 16 de 3 ao comprido, 8 de 6 no computador.

**As sementes dos níveis não foram escolhidas à mão.** Nem todos os labirintos
dão para trancar (ver a secção a seguir), e uma receita pode sair com uma peça a
menos sem ninguém dar por isso. Cada semente foi procurada — monta-se o nível,
verifica-se que cumpre a receita toda, e tenta-se a seguinte até dar. O cenário
`maze-run-mecanicas` do smoke-test faz a mesma verificação aos quarenta e oito a
cada execução, por isso uma receita que deixe de cumprir falha o teste em vez de
chegar a quem joga.

Além dos cristais e dos guardas, um nível pode ter três coisas. Todas se ligam
pela receita (`js/levels.js`) e nenhuma precisa de um mapa desenhado à mão:

| peça                | o que faz                                                        | campo na receita |
| ------------------- | ---------------------------------------------------------------- | ---------------- |
| Cristal de gelo     | congela os guardas uns segundos; congelados não andam nem apanham | `freezers: 2`    |
| Portal              | liga duas pontas do labirinto; o jogador **e os guardas** usam-no | `portals: 1`     |
| Porta trancada      | corta o caminho até a sua chave aparecer; também trava os guardas  | `doors: 1`       |

Três decisões que não são óbvias, e o porquê:

- **O gelo repõe, não soma.** Apanhar dois cristais seguidos não dá doze
  segundos, dá seis outra vez (`FREEZE_SECONDS`). Somar fazia com que guardar
  cristais valesse mais do que jogar bem, e o nível passava a ganhar-se com o
  inventário em vez de com o caminho. E não sobrevive a uma vida perdida — era
  prémio a mais por um erro.
- **Os guardas atravessam os portais.** É o que impede que um portal seja um
  botão de fuga: o atalho é de toda a gente. Para isso o mapa de distâncias dos
  guardas (`distanceField`) trata um portal como uma porta ao lado — sem isso,
  um guarda passava ao lado do portal sem o ver e o jogador tinha um atalho que
  a perseguição não conhecia.
- **Um portal nunca é a única passagem para lado nenhum.** Uma célula com portal
  não se atravessa: quem lhe chega ao centro é levado para a outra ponta
  (`enterPortal` em `js/walker.js`). Se essa célula for a única ligação ao que
  está do outro lado dela, fecha ali o labirinto — só lá se entra caindo do
  outro portal, e um cristal ou a saída lá dentro fazem um nível que parece
  impossível. Por isso `placePortals` só põe uma ponta onde, com **todas** as
  pontas fechadas ao mesmo tempo, se continua a chegar a pé do início a todo o
  labirinto. Pelo mesmo motivo duas pontas nunca ficam encostadas uma à outra —
  quem saísse de uma caía logo na outra e era atirado outra vez. O smoke-test
  verifica as duas coisas nos quarenta e oito níveis.
- **A chave abre a porta onde quer que ela esteja.** Obrigar a voltar lá com a
  chave na mão era um segundo atravessamento do labirinto para uma decisão já
  tomada.

### O problema difícil: trancar um labirinto cheio de laços

Uma porta só é uma porta se trancar mesmo alguma coisa. A forma ingénua de a
colocar — escolher uma célula no caminho para a saída — **não funciona**: os
labirintos são "entrançados" de propósito (o `braid` abre becos sem saída, para
uma perseguição ter sempre uma volta a dar), e num labirinto com laços fechar
uma célula ao calhar quase nunca corta o caminho. Dá-se a volta, e a porta passa
a enfeite.

O que `placeDoors` faz:

1. **A saída vai para o fundo de um beco** quando o nível tem portas. A boca de
   um beco corta-o do resto por construção — assim existe de certeza onde pôr a
   porta.
2. **Procura-se um corte a sério**: cada célula candidata é fechada à
   experiência e faz-se uma travessia do labirinto; só serve a que deixa mesmo o
   destino inalcançável. Primeiro no caminho mais curto (barato, quase sempre
   chega), depois em todo o labirinto. Entre as que servem ganham os corredores
   — uma porta num cruzamento não se lê.
3. **A chave fica o mais longe possível da porta**, e não do início. Foi a
   medida que parecia óbvia e estava errada: a porta está lá ao fundo, longe do
   início, e a célula mais longe do início que ainda é alcançável é precisamente
   a que está encostada a ela — a chave calhava colada ao cadeado.
4. **Com mais do que uma porta, elas encadeiam-se**: a primeira tranca a saída,
   a segunda tranca a chave da primeira. Quem joga percebe a ordem sem lhe
   explicarem. Por isso a chave de uma porta que não é a última só pode ir para
   um sítio onde ainda seja possível cortar o caminho até lá — senão o nível
   ficava com menos uma porta do que a receita pede.

Nem todos os labirintos dão para isto. **Num nível com portas, a semente
escolhe-se pelo que sai**: monta-se, conta-se o que lá ficou e troca-se a
semente até a receita ser cumprida. O cenário `maze-run-mecanicas` do
smoke-test monta os níveis todos e falha se alguma receita der um nível com
peças a menos, uma porta que não tranque a saída, uma chave que não se consiga
alcançar ou uma peça fora do alcance — é a rede que deixa acrescentar níveis sem
medo.

### Portas e o labirinto que está pintado

As paredes de um nível são pintadas uma vez para um canvas à parte e dali
copiadas a cada frame (ver `paintMaze` em `js/render.js`). Uma porta que abre
não pode obrigar a repintar tudo, por isso **uma porta fechada não é parede**:
a grelha do labirinto (`maze.grid`) é a forma escavada e nunca muda, e as portas
fechadas vivem num conjunto à parte (`maze.blocked`).

Daí haver duas perguntas diferentes a fazer ao labirinto, e confundi-las dar
bugs difíceis de ver:

| pergunta               | quem responde       | quem usa                                    |
| ---------------------- | ------------------- | ------------------------------------------- |
| "isto é parede?"       | `isWallStatic`      | o desenho das paredes e os cartões do menu  |
| "dá para passar aqui?" | `isFloor`/`isWall`  | o andar, as saídas de uma célula, os guardas |

Como o mapa dos guardas se refaz a cada frame, uma porta que abre entra nele
sozinha — não há nada em cache para invalidar.

## Terras do Reino

> **Em testes.** No catálogo aparece como "Em breve" (`IsPlayable: false` em
> `Home.razor`), mas joga-se indo direto a `/games/terras-do-reino/`. O painel
> das pontuações está escondido (comentado em `Pontuacoes.razor`, e o botão 🏆
> do jogo com `hidden`); as pontuações continuam a ser guardadas. Para lançar,
> desfazem-se estes três pontos.

O primeiro jogo da arcada sem partidas: um reino que cresce enquanto se joga e
continua de onde ficou. Inspirado no tabuleiro de peças do Carcassonne — o mapa
é um tabuleiro de casas em perspetiva isométrica, com colinas que sobem, lagos
que descem e a "placa" de terra à vista nas bordas —, mas é um jogo de
economia, não de conquista: ninguém ataca ninguém.

### O ciclo do jogo

1. **Campos** (sem trabalhadores): toca-se para semear e, quando o trigo está
   dourado, toca-se outra vez para colher. É o primeiro dinheiro do reino, e dá
   trabalho de propósito — até se construir um **celeiro**, que o faz sozinho.
2. **Casas** trazem moradores; os edifícios de produção precisam deles como
   trabalhadores (por ordem de construção: o primeiro a ser feito é o primeiro a
   ter gente). Quem trabalha paga o imposto inteiro, quem está parado paga um
   quarto (`IDLE_TAX_SHARE`) — senão encher o mapa de casas era a melhor jogada.
3. **Cadeias de produção**: trigo → moinho → farinha → padaria → pão; trigo →
   vacaria → leite → leitaria → queijo; madeira → carpintaria → tábuas. O
   lenhador precisa de árvores à volta, a pedreira de rochas, a mina de uma veia
   de ouro numa colina.
4. **O povo come ao fim de cada dia** (queijo, pão ou leite). Bem alimentado, e
   com variedade, fica mais contente e paga mais — mas nunca se revolta: um
   reino sem pão é pobre, não é um reino em guerra.
5. **O castelo** sobe de nível: alarga o território onde se pode construir,
   aumenta o armazém e abre o escalão seguinte de edifícios.
6. **O mercado** vende e compra às vilas vizinhas (ver abaixo).
7. **Aplanar colinas**: nas colinas só se fazem minas, por isso uma colina no
   território pode ser aplanada na ficha dela, um bloco de 2x2 casas de cada
   vez, por moedas e madeira (`FLATTEN_COST`), e passa a terra livre —
   devolvendo alguma pedra (`FLATTEN_STONE`). As veias de ouro não se aplanam.
8. **Estradas de pedra** (`ROAD_COST` por casa): no modo de estrada toca-se
   onde começa e depois onde acaba cada troço, e o caminho contorna sozinho
   edifícios, árvores, água e colinas (preferindo as estradas que já há). Onde
   uma estrada encosta a dois edifícios, o povo anda a pé entre eles
   (`js/walkers.js`): tanto mais gente quanto mais moradores
   (`RESIDENTS_PER_WALKER`). As vilas calcetam as ruas à volta de cada
   edifício que fazem e têm a sua própria gente na rua. À volta do castelo fica
   uma praça de uma casa onde só há estradas.

Os **objetivos** (`js/quests.js`) são o tutorial: uma lista por ordem que leva
de uma casa e um campo até ao castelo no nível máximo, cada um com recompensa.
Depois dela, o jogo continua com marcos de prosperidade que vão dobrando.

### As vilas vizinhas (CPU)

Três vilas (`TOWNS` em `js/config.js`), cada uma com o seu ofício: o que
produzem fica barato no mercado, o que procuram fica caro. Crescem sozinhas,
edifício a edifício, e comerciam entre si em caravanas que se veem a atravessar
o mapa. A tabela 👑 Reinos compara a prosperidade de todos.

O preço de cada bem sai do "stock" que as vilas têm dele: no ponto de
referência é o preço base, com pouco sobe, com muito desce. Vender enche o
stock, por isso despejar cem trigos de uma vez rende menos do que vender aos
poucos; com o tempo, o stock volta ao equilíbrio que as vilas ditam. De tempos a
tempos há uma **feira** numa vila, que faz de um bem o mais procurado durante
dois dias.

### Mapa, desenho e controlos

- **O mapa é de 88x88 casas** e uma casa é a peça mais pequena: uma árvore,
  um rochedo, um troço de estrada. Os edifícios ocupam blocos de 2x2 casas (o
  castelo 4x4), guardados pelo canto de cima; os raios (território, vizinhos
  de um lenhador, alcance de um celeiro) contam-se em casas a partir do centro
  do bloco. Ao construir, o bloco fica centrado no canto de casa mais perto do
  dedo (`anchorFor` em `js/iso.js`). Os desenhos das peças continuam feitos
  para o bloco de 2x2 (`js/draw.js`); as árvores e os rochedos, de uma casa só,
  carimbam-se mais pequenos.
- **O mapa sai de uma semente** (`js/world.js`, ruído de valor em `js/rng.js`).
  O relevo e as florestas leem o ruído a meia resolução — as colinas e os lagos
  têm o tamanho de antes, com margens mais finas.
  À volta do castelo garante-se o que o começo precisa — árvores, rochas, água e
  uma veia de ouro ao alcance do castelo no nível 3 —, e não só em contagem: tem de
  haver uma casa livre com árvores (ou rochas) à volta, onde caibam o lenhador e a
  pedreira. As vilas escolhem entre
  vários sítios o que tem mais terra à volta. O smoke-test verifica isto em 200
  sementes.
- **Nada é imagem**: árvores, casas, moinhos e castelos são polígonos
  (`js/draw.js`, `js/sprites.js`). A parte estática de cada peça é pintada uma
  vez numa cache à escala do ecrã (`js/sprite-cache.js`); a parte viva — pás do
  moinho, fumo, vacas, bandeiras, brilho do ouro — desenha-se a cada frame.
- **O tabuleiro desenha-se de trás para a frente**, diagonal a diagonal
  (`js/render.js`): o chão de cada casa e logo a seguir o que está em cima dela.
  É o que faz uma colina tapar o que está atrás. O chão (relva, lados,
  estradas) é a exceção: são milhares de casas, por isso pinta-se por blocos
  de 11x11 numa imagem à parte, à escala do ecrã, e só se repinta quando muda o
  que o bloco tem ou o zoom; os blocos compõem-se por baixo das peças.
- **A vista roda** de 90 em 90 graus (🔄 Rodar, na barra de baixo, ou as
  teclas Q e E). A rotação vive só entre a grelha e o ecrã (`camera.rot` em `js/iso.js`): cada casa do mapa
  passa para uma "grelha da vista", rodada à volta do centro do mapa, e só essa
  é projetada; o resto do jogo continua a falar em casas do mapa. A ordem do
  pintor, os lados das colinas, os blocos do chão e o toque (`pickTile`) são
  os da grelha da vista. As peças também rodam: as primitivas de `js/draw.js`
  pintam as faces viradas para quem olha, as portas e janelas das faces de
  costas não se veem, e as peças de várias partes pintam-nas por ordem de
  profundidade (`layered`). A luz é a do ecrã, vem sempre da esquerda. Ficam
  sempre de frente a mina (um monte de rocha com a entrada à vista) e as pás
  do moinho (que se vira para o vento).
- **Arrastar** anda pelo mapa, **beliscar** ou a **roda** aproxima, **tocar**
  escolhe uma casa ou constrói (`js/input.js`). Um toque só conta se o dedo
  quase não se mexeu — largar o dedo no fim de um arrasto não constrói nada.
- O HUD e os painéis são HTML, não canvas: números que mudam devagar e uma dúzia
  de bens ganham o vidro verdadeiro e a quebra de linha sem trabalho à mão. Os
  balões por cima dos edifícios (💤 sem trabalhadores, 📦 armazém cheio, 🌾
  pronto a colher) são do canvas.

### Gravação e tempo fora do jogo

O reino grava-se pelo mesmo cliente do SDK que o Maze Run usa
(`lib/arcade/progress.js`): no aparelho sempre, na conta com sessão iniciada.
Como o servidor aceita até 8 kB por jogo, **a gravação leva a semente do mapa em
vez do mapa**, e os edifícios como listas curtas de números (`js/save.js`); as
vilas levam só quantos edifícios têm, porque crescem sempre para os mesmos
sítios. As colinas aplanadas vão como a lista dos índices das casas (`fl`),
aplicada ao mapa antes de se porem os edifícios, e as estradas como um bit por
casa do quadrado de 60x60 à volta do castelo, em base64 (`r`, 600 caracteres
fixos). A gravação é a v2 (mapa de 88x88); uma v1, do tempo em que cada casa
era um edifício, passa a v2 ao carregar, dobrando as coordenadas — o relevo é
amostrado de modo a que o reino caia no mesmo sítio, e o chão debaixo de cada
edifício é limpo à força, para nunca ficar nenhum em cima de um lago. Um reino com setenta edifícios ocupa perto de 1,5 kB.

A regra de junção é diferente da do Maze Run: **ganha a cópia com mais tempo de
jogo**. Um reino não se junta campo a campo como as marcas de um nível — são
dois mundos diferentes —, e o que tem mais horas é o que mais custaria perder.
Pela mesma razão, o botão do menu só fica ativo depois de a conta responder:
fundar um reino novo antes disso podia pôr um reino de cinco minutos por cima
de um de cinco horas guardado noutro aparelho.

Ao voltar, o jogo **recupera o tempo em que esteve fechado**, até três horas
(`OFFLINE_MAX_SECONDS`), passando a mesma economia em passos de um ou dois
segundos, e diz o que se fez entretanto.

A pontuação no quadro é a **prosperidade** (moedas, bens ao preço de
referência, edifícios e castelo), enviada ao sair e ao subir o castelo — só
quando é melhor do que a última enviada, e limitada ao máximo que o servidor
aceita (999 999).

### Acrescentar um edifício

1. Uma entrada em `BUILDINGS` (`js/config.js`): custo, escalão, trabalhadores,
   receita (`recipe`) e, se precisar, vizinhos (`near`) ou sítio (`site`).
2. O desenho em `STATIC` (e, se mexer, em `LIVE`) no `js/sprites.js`.
3. Se o edifício fizer coisa que não seja uma receita (como o guarda-florestal
   ou o celeiro), o passo dele em `js/economy.js`.

A gravação guarda o tipo pelo índice em `BUILDINGS`: **acrescenta-se sempre no
fim da lista**, senão as gravações antigas trocam os edifícios uns pelos outros.

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
