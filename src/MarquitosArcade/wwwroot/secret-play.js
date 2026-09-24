// Entrada secreta nos jogos em testes.
//
// Um jogo por lançar aparece no catálogo como "Em breve", sem link (ver
// Home.razor). Para o testar como os jogadores o vão ter — numa app afixada
// ao ecrã principal, sem barra de endereço onde escrever o URL —, o cartão
// dele leva `data-secret-play` com o endereço do jogo, e um toque duplo com
// três dedos em cima do cartão abre-o. No computador, Alt + duplo clique.
//
// Os eventos são apanhados no documento, e não no cartão: a enhanced
// navigation do Blazor troca o HTML da página e levaria os listeners com ela.
(() => {
  const SELECTOR = "[data-secret-play]";
  /** Tempo máximo (ms) entre os dois toques de três dedos. */
  const DOUBLE_TAP_MS = 600;

  let last = { card: null, at: 0 };

  const cardOf = (event) => event.target.closest?.(SELECTOR) ?? null;

  const open = (card) => {
    const url = card.getAttribute("data-secret-play");
    if (url) window.location.href = url;
  };

  // O touchstart em que o terceiro dedo pousa conta como um toque.
  document.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 3) return;
      const card = cardOf(event);
      if (!card) return;
      const now = performance.now();
      if (last.card === card && now - last.at < DOUBLE_TAP_MS) {
        last = { card: null, at: 0 };
        open(card);
      } else {
        last = { card, at: now };
      }
    },
    { passive: true }
  );

  document.addEventListener("dblclick", (event) => {
    if (!event.altKey) return;
    const card = cardOf(event);
    if (card) open(card);
  });
})();
