// Navegação para fragmentos (#catalogo, #pong, ...) tratada à mão.
//
// O layout da arcada é um shell fixo: o #app ocupa a viewport e quem
// rola é a .page-scroll lá dentro — o documento em si nunca rola (ver a
// nota no html/body em styles.css). O Safari em iOS, porém, trata uma
// navegação para um fragmento a mexer na viewport do *documento*,
// mesmo quando o alvo está dentro de outra caixa com scroll e mesmo
// com o documento sem overflow. O resultado é o shell inteiro a
// deslizar para debaixo da barra de sistema, com uma faixa em branco
// no fundo — e, numa app afixada, a perder o ecrã inteiro.
//
// O CSS já tira o overflow do documento; isto fecha a porta ao resto:
// o clique num link de fragmento é intercetado, o URL é atualizado com
// history.pushState (que, ao contrário de location.hash, não dispara o
// scroll nativo) e o scroll é feito por nós na .page-scroll.
(() => {
  const SCROLLER = ".page-scroll";

  const reducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const scroller = () => document.querySelector(SCROLLER);

  function targetFor(hash) {
    if (!hash || hash === "#") return null;
    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      id = hash.slice(1);
    }
    if (!id) return null;
    return document.getElementById(id) ?? document.querySelector(`[name="${CSS.escape(id)}"]`);
  }

  // Repõe a viewport do documento se o Safari lhe chegou a mexer.
  // Só nos frames a seguir a uma navegação: um reset permanente lutaria
  // com o scroll legítimo que o iOS faz para revelar um campo por cima
  // do teclado, nos formulários da conta.
  function resetViewport() {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  }

  function resetViewportSoon() {
    resetViewport();
    requestAnimationFrame(() => {
      resetViewport();
      requestAnimationFrame(resetViewport);
    });
  }

  function scrollToTarget(el, behavior) {
    const box = scroller();
    if (box?.contains(el)) {
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      const top =
        box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - margin;
      box.scrollTo({ top: Math.max(0, top), behavior });
    } else {
      el.scrollIntoView({ behavior, block: "start" });
    }
    resetViewportSoon();
  }

  // O scroll nativo leva o foco do teclado com ele; como aqui o
  // travamos, passamo-lo à mão para o leitor de ecrã e o Tab seguinte
  // continuarem a partir do alvo.
  function focusTarget(el) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  function applyHash(behavior) {
    const el = targetFor(window.location.hash);
    if (el) scrollToTarget(el, behavior);
    else resetViewportSoon();
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || link.target || link.hasAttribute("download")) return;

    const url = new URL(link.href, document.baseURI);
    const here = new URL(window.location.href);
    // Só os fragmentos desta mesma página: tudo o resto (outra rota,
    // outra query, outro site) segue para o router do Blazor.
    if (url.origin !== here.origin || url.pathname !== here.pathname || url.search !== here.search) return;
    if (!url.hash) return;

    const el = targetFor(url.hash);
    if (!el) return;

    event.preventDefault();
    history.pushState(null, "", url.hash);
    scrollToTarget(el, reducedMotion() ? "auto" : "smooth");
    focusTarget(el);
  });

  // Recuar/avançar no histórico entre fragmentos, e qualquer código que
  // escreva em location.hash diretamente.
  window.addEventListener("popstate", () => applyHash("auto"));
  window.addEventListener("hashchange", () => applyHash("auto"));

  // Entrada direta num URL com fragmento (ex.: o "Pontuações" de um
  // jogo, /pontuacoes?jogo=pong#pong): aqui o scroll nativo já
  // aconteceu, por isso desfazemo-lo e refazemo-lo na caixa certa. O
  // segundo passo, depois do load, é para as imagens `lazy` que ainda
  // podem empurrar o alvo.
  applyHash("auto");
  window.addEventListener("load", () => applyHash("auto"), { once: true });

  // A enhanced navigation do Blazor troca o conteúdo sem recarregar a
  // página: o alvo do fragmento no URL novo só existe depois disso.
  window.__arcadeHashScroll = { reapply: () => applyHash("auto") };
})();
