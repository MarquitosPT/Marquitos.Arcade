// Mede o desencontro entre o ecrã e o viewport de layout numa app afixada.
//
// Em iOS, com `apple-mobile-web-app-status-bar-style: black-translucent`, a
// webview de uma app afixada no ecrã principal é desenhada a começar em y=0
// (por baixo da barra de estado, que é o que se quer) mas o viewport de
// layout continua a ser descontado do topo. Fica mais curto do que o ecrã
// exatamente pela altura da barra de estado — 59pt num iPhone com Dynamic
// Island — e o que sobra em baixo é pintado com o fundo do <html>, dando
// uma faixa lisa com a cor de fundo do documento.
//
// Isto é visível em todos os ecrãs; na Tasca do Zé passava despercebido só
// porque o fundo do <html> lá é o mesmo creme do conteúdo.
//
// Aqui medimos a diferença e publicamo-la em `--viewport-gap`, para o CSS
// esticar o que precisa de chegar ao fundo. Fora deste caso a variável fica
// a 0px e nada muda.
(() => {
  const root = document.documentElement;

  function measure() {
    // `navigator.standalone` é específico do iOS e identifica exatamente a
    // app afixada — ao contrário de `display-mode: standalone`, que também
    // apanha o Android, onde o layout está correto e esticar estragaria.
    const iosStandalone = window.navigator.standalone === true;

    let gap = 0;
    if (iosStandalone && window.screen) {
      const portrait = window.innerWidth <= window.innerHeight;
      const screenHeight = portrait
        ? Math.max(window.screen.width, window.screen.height)
        : Math.min(window.screen.width, window.screen.height);
      const diff = Math.round(screenHeight - window.innerHeight);
      // Só aceitamos uma diferença da ordem de uma barra de estado: se for
      // outra coisa qualquer, é mais seguro não mexer no layout.
      if (diff > 0 && diff <= 80) gap = diff;
    }

    root.style.setProperty("--viewport-gap", `${gap}px`);
  }

  measure();
  window.addEventListener("resize", measure);
  // O iOS reporta as dimensões antigas durante a animação de rotação.
  window.addEventListener("orientationchange", () => setTimeout(measure, 300));

  // ---- Diagnóstico ----------------------------------------------------
  //
  // Numa app afixada não há consola nem barra de endereço, e o `start_url`
  // do manifesto faz o iOS arrancar sempre em "/" — a query string com que
  // se adicionou ao ecrã principal perde-se. Por isso o painel liga-se de
  // três maneiras: pelo `?debug=viewport` num browser normal, pela escolha
  // guardada, e por um toque com três dedos, que é o único que funciona de
  // certeza dentro da app afixada (em iOS o armazenamento dela é separado
  // do Safari, portanto a escolha feita no Safari não transita).
  const STORE_KEY = "arcade-debug-viewport";

  const stored = () => {
    try {
      return window.localStorage.getItem(STORE_KEY) === "1";
    } catch {
      return false;
    }
  };

  const remember = (on) => {
    try {
      if (on) window.localStorage.setItem(STORE_KEY, "1");
      else window.localStorage.removeItem(STORE_KEY);
    } catch {
      /* modo privado: o painel vale só para esta sessão. */
    }
  };

  const param = new URLSearchParams(window.location.search).get("debug");
  if (param === "viewport") remember(true);
  if (param === "off") remember(false);

  let panel = null;

  // Quanto vale cada unidade de viewport, em px. É isto que distingue os
  // dois caminhos possíveis para a faixa: se o `vh` for maior do que o
  // `innerHeight`, um elemento em fluxo normal com `height: 100vh` passa
  // do fim do viewport e é pintado na faixa — ao contrário de um `fixed`,
  // que o iOS recorta. Se for igual, não há nada a ganhar por aí.
  function unit(value) {
    const probe = document.createElement("div");
    probe.style.cssText =
      `position:absolute;top:0;left:0;width:0;visibility:hidden;` +
      `pointer-events:none;height:${value}`;
    document.body.appendChild(probe);
    const px = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    return px;
  }

  function render() {
    if (!panel) return;
    const cs = getComputedStyle(root);
    const top = cs.getPropertyValue("--probe-top").trim();
    // O `--viewport-gap` não serve de sonda: o measure() acima define-o
    // sempre, mesmo que o CSS a correr seja antigo. Já os `--probe-*` só
    // existem no splash.css novo, por isso a ausência deles denuncia uma
    // app afixada que ficou com CSS em cache.
    const fresh = top !== "";
    panel.textContent = [
      `standalone   ${window.navigator.standalone === true}`,
      `innerHeight  ${window.innerHeight}   screen ${window.screen.width}x${window.screen.height}`,
      `viewport-gap ${cs.getPropertyValue("--viewport-gap").trim() || "?"}`,
      `safe-area    topo ${top || "?"}  fundo ${cs.getPropertyValue("--probe-bottom").trim() || "?"}`,
      `css          ${fresh ? "atual" : "EM CACHE, DESATUALIZADO"}`,
      `unidades     vh ${unit("100vh")}  dvh ${unit("100dvh")}` +
        `  svh ${unit("100svh")}  lvh ${unit("100lvh")}`,
      `dpr ${window.devicePixelRatio}   ${window.location.pathname}`,
    ].join("\n");
  }

  function show() {
    if (panel || !document.body) return;
    panel = document.createElement("pre");
    panel.id = "viewport-debug";
    panel.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;margin:0;" +
      "padding:8px;font:11px/1.45 ui-monospace,monospace;white-space:pre;" +
      "background:rgba(255,0,110,.92);color:#fff;pointer-events:none";
    document.body.appendChild(panel);
    render();
  }

  function hide() {
    panel?.remove();
    panel = null;
  }

  function toggle() {
    if (panel) {
      hide();
      remember(false);
    } else {
      show();
      remember(true);
    }
  }

  // Três dedos ao mesmo tempo: não colide com nada nos jogos nem no site.
  document.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 3) toggle();
    },
    { passive: true }
  );

  const start = () => {
    if (stored()) show();
    window.addEventListener("resize", render);
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
