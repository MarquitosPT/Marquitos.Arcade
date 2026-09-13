# Estrutura dos jogos: pasta de ficheiros estáticos, não um projeto por jogo

**Estado:** decidido · **Data:** 2026-09-13

## Contexto

Cada jogo era um `index.html` único com o CSS e o JavaScript todo inline — 1500
linhas no caso maior. Para os jogos crescerem (sprites PNG, SVG, mais lógica,
sons) isso deixou de dar. Havia três hipóteses em cima da mesa:

1. **Pasta por jogo** com os ficheiros separados, servidos estaticamente.
2. **Um projeto Razor Class Library (DLL) por jogo**, referenciado pela aplicação.
3. **Um serviço ASP.NET Core por jogo** — já rejeitado antes, por causa do deploy
   (ver "Servidor único vs. um serviço por jogo" no README).

## Decisão

Cada jogo é **uma pasta em `wwwroot/games/<slug>/`** com a sua própria estrutura
de `css/`, `js/` (módulos ES) e `assets/`. O que é comum aos jogos vive num SDK
partilhado em `wwwroot/lib/arcade/`.

## Porquê não uma Razor Class Library por jogo

Uma RCL é a ferramenta certa para empacotar **componentes Razor e código C#** que
se querem reutilizar entre aplicações. Nenhum dos jogos tem código C#: são canvas,
`requestAnimationFrame` e Web Audio, a correr inteiramente no browser. Uma RCL por
jogo compilaria uma DLL cujo conteúdo é... ficheiros estáticos.

Em concreto, custava:

- **Os URLs mudavam.** Os assets estáticos de uma RCL são servidos em
  `/_content/<NomeDoAssembly>/...`. Os jogos deixariam de viver em
  `/games/<slug>/`, o que parte os links do catálogo, os links das pontuações, o
  `tools/covers/` e o âmbito da PWA. Dá para reescrever os caminhos, mas é
  complexidade a troco de nada.
- **O ciclo de trabalho ficava mais lento.** Hoje muda-se um `.js` e faz-se F5.
  Com uma RCL, mexer num ficheiro estático passa a implicar recompilar o projeto.
- **Mais três `.csproj`** na solução, mais referências, mais tempo de build, para
  transportar ficheiros que o `UseStaticFiles` já serve.

E não dava nada em troca: uma RCL compensa quando se quer versionar e distribuir
o jogo por NuGet, ou quando o jogo traz componentes Razor. Nada disso se aplica.

### E Blazor para os jogos em si?

Também não, e vale a pena dizer porquê já que o portal é Blazor:

- **Blazor WebAssembly** obrigaria a descarregar o runtime .NET (vários MB) para
  correr um jogo cuja lógica são 400 linhas de JavaScript. E desenhar no canvas a
  partir de C# passa por JS interop a cada chamada, que a 60fps não compensa.
- **Blazor Server** seria pior: cada frame passaria por um websocket.

Blazor continua a ser a escolha certa onde já está — o portal, o catálogo, as
pontuações e as páginas de conta. A fronteira é a mesma de sempre: **Blazor para
as páginas, JavaScript para o interior do canvas.**

## Quando reconsiderar (e promover **um** jogo, não todos)

Passar um jogo a RCL faz sentido se:

- O jogo precisar de **lógica de servidor própria** — multijogador em tempo real
  por websockets, validação de pontuação no servidor, emparelhamento de jogadores.
- Se quiser **distribuir o jogo por NuGet** para o reutilizar noutro sítio.
- O jogo passar a ter **interface em componentes Razor** em vez de canvas.

A estrutura atual foi pensada para essa promoção ser barata: a pasta de um jogo
mapeia 1:1 no `wwwroot/` de uma RCL. Promover é mover a pasta e acrescentar um
`.csproj`, não reescrever o jogo.

## Estrutura de um jogo

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
- **Um módulo, um assunto.** Se um ficheiro precisa de duas frases para se
  descrever, são dois módulos.
- **Números de afinação vivem no `config.js`**, não espalhados pelo código.
- **O que é comum a dois jogos vai para o SDK** em `wwwroot/lib/arcade/`.

## SDK partilhado (`wwwroot/lib/arcade/`)

Módulos ES sem dependências externas, importáveis por caminho absoluto
(`import { createAudio } from '/lib/arcade/audio.js'`) ou em bloco pelo
`index.js`:

| Módulo         | O que resolve                                                        |
| -------------- | -------------------------------------------------------------------- |
| `audio.js`     | Ciclo de vida do `AudioContext` e bips sintetizados                  |
| `scores.js`    | Cliente de `/api/scores/:gameId`, cache offline e nome do jogador     |
| `storage.js`   | `localStorage` que não rebenta em Safari privado                     |
| `viewport.js`  | Canvas em ecrã inteiro, nítido em Retina e por baixo do notch         |
| `loop.js`      | Ciclo `requestAnimationFrame` com delta-time limitado                |
| `dom.js`       | Seletores, `escapeHtml`, grupos de ecrãs e de botões                 |
| `topbar.js`    | Barra de topo comum (arcada, pontuações, pausa, sair)                |
| `math.js`      | `clamp`, `lerp`, ângulos, aleatórios, `shuffle`                      |

Antes disto, o mesmo `safeGet`/`safeSet` de `localStorage`, o mesmo
`ensureAudio`, o mesmo `beep` e a mesma barra de topo estavam copiados nos três
jogos.
