# Cache do browser: `no-cache` por omissão, eterno só com impressão digital

**Estado:** decidido · **Data:** 2026-09-15

## Contexto

Quem afixa o site ao ecrã principal do telemóvel deixa de ter Ctrl+F5. A PWA
arranca sempre no mesmo `start_url`, não tem barra de endereço, e no iOS o
WebKit é particularmente agarrado ao que já descarregou. O resultado que se via:
jogos a abrir com o `index.html` de há dias, ou com CSS novo e `js/` velho —
metade dos ficheiros atualizados, metade não, que é pior do que nenhum.

A causa não é o browser ser teimoso: é o servidor não dizer nada. O
`UseStaticFiles` responde com `ETag` e `Last-Modified` mas **sem
`Cache-Control`**, e a RFC 9111 autoriza o browser, nesse caso, a inventar um
prazo de validade a partir da idade do ficheiro (a *heuristic freshness*, tipicamente 10% do tempo
desde a última modificação). Um ficheiro estável há um mês
ganha assim três dias de validade — e durante esses três dias nem sequer há um
pedido ao servidor para o contradizer.

Os assets do portal já escapavam a isto porque o `App.razor` os referencia por
`@Assets["..."]`, que lhes acrescenta um `?v=<hash do conteúdo>`. Os jogos, não:
o `games/<slug>/index.html` é HTML escrito à mão, com `href="css/base.css"` e
`import './state.js'` sem versão nenhuma.

## Decisão

Um middleware — `Web/CachePolicy.cs`, ligado no `Program.cs` antes dos ficheiros
estáticos — carimba `Cache-Control` em todas as respostas, com dois regimes:

| resposta                                  | `Cache-Control`                        |
| ----------------------------------------- | -------------------------------------- |
| URL com `?v=` (impressão digital)          | `public, max-age=31536000, immutable`  |
| tudo o resto                               | `no-cache`                             |
| páginas que o Identity já marca `no-store` | intocado (é mais restritivo)           |

`no-cache` não quer dizer "não guardes": quer dizer **"guarda, mas pergunta
antes de usar"**. O browser mantém a cópia e revalida-a a cada pedido com o
`If-None-Match`; como o servidor de ficheiros estáticos emite `ETag`, a resposta
habitual é um `304 Not Modified` sem corpo. Fica-se com a garantia de frescura
ao preço de um cabeçalho, não ao preço de voltar a descarregar tudo.

O carimbo é posto num `Response.OnStarting` em vez de ser escrito ali no
middleware. É de propósito: o `MapStaticAssets` e o `UseStaticFiles` correm
depois, e o que escrevêssemos antes deles seria substituído. O `OnStarting` corre
quando a resposta arranca — a seguir a toda a gente — por isso é o último a
falar.

## Porquê não versionar também os ficheiros dos jogos

Seria o ideal em termos de rede: com `?v=<hash>` em cada `css/` e `js/` de um
jogo, nem os 304 eram precisos. Mas os `index.html` dos jogos são estáticos, sem
passagem por Razor, e os módulos ES importam-se uns aos outros por caminho
relativo escrito no código (`import { clamp } from '../../lib/arcade/math.js'`).
Versionar isso implicaria ou um passo de build a reescrever HTML e imports, ou
escrever o hash à mão em cada link — precisamente o tipo de trabalho manual que
se esquece na vez em que interessa.

O custo de não o fazer é um pedido condicional por ficheiro no arranque de um
jogo (~20 pedidos, resposta vazia). Numa arcada caseira isso não se nota; um
script velho nota-se sempre.

## Quando reconsiderar

- **Se aparecer um CDN à frente do App Service.** Aí vale a pena distinguir
  `public` de `private` e dar aos ficheiros dos jogos uma impressão digital a
  sério, para o CDN os poder guardar sem revalidar.
- **Se os jogos passarem a ter um passo de build** (bundling, minificação). Nessa
  altura o hash sai de graça do próprio build e o `no-cache` dos assets pode dar
  lugar a `immutable`.
- **Se se quiser o site a funcionar offline.** Aí a conversa muda de figura: é
  preciso um service worker, e a política de cache passa a ser dele. Note-se que
  `no-cache` obriga a ir à rede, por isso hoje a arcada não abre sem ligação —
  o que já acontecia, porque as pontuações vêm do servidor.
