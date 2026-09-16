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

  // Última folga publicada, para só mexer no CSS quando muda de facto.
  let published = null;
  // Só depois da primeira medição é que vale a pena avisar quem remede.
  let settled = false;

  function measure() {
    // `navigator.standalone` é específico do iOS e identifica exatamente a
    // app afixada — ao contrário de `display-mode: standalone`, que também
    // apanha o Android, onde o layout está correto e esticar estragaria.
    const iosStandalone = window.navigator.standalone === true;
    // Serve a folga do topo em splash.css (--ios-top-clearance).
    root.toggleAttribute("data-ios-standalone", iosStandalone);

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

    if (gap === published) return;
    published = gap;
    root.style.setProperty("--viewport-gap", `${gap}px`);

    // Quem se dimensiona em JS — o canvas dos jogos, via
    // lib/arcade/viewport.js — só sabe remedir a um `resize`, e a folga
    // pode mudar sem que o iOS dispare nenhum. Reentrar aqui é inofensivo:
    // à segunda a folga já é a mesma e sai-se acima.
    if (settled) window.dispatchEvent(new Event("resize"));
  }

  measure();
  settled = true;

  window.addEventListener("resize", measure);

  // No primeiro arranque de uma app afixada o iOS chega a reportar o
  // viewport curto e só depois o assenta no ecrã todo, sem disparar
  // `resize` pelo meio. Uma medição só no <head> ficava com a folga de um
  // ecrã que já não existe, e a app acabava mais alta do que o ecrã — o
  // rodapé e os controlos saíam por baixo. Daí remedir enquanto o arranque
  // decorre; como o ecrã de arranque tapa tudo nos primeiros segundos,
  // nada disto se vê.
  const remeasure = () => measure();
  requestAnimationFrame(() => {
    measure();
    requestAnimationFrame(remeasure);
  });
  window.addEventListener("load", remeasure, { once: true });
  window.addEventListener("pageshow", remeasure);
  window.visualViewport?.addEventListener("resize", remeasure);
  document.addEventListener("visibilitychange", remeasure);
  for (const atraso of [150, 600, 1500, 3000]) setTimeout(remeasure, atraso);

  // Âncora do documento.
  //
  // Para a app chegar ao fundo do ecrã, o <body> mede-se em `vh` e passa
  // do fim do viewport (ver a nota no styles.css). O preço é o documento
  // voltar a ter uns 59pt por onde rolar — e era a rolar o documento que
  // o Safari escondia o topo. Os cliques em fragmentos já não lhe tocam
  // (wwwroot/hash-scroll.js); isto trata do resto, como um arrasto na
  // barra de topo ou no rodapé.
  //
  // Fica de fora o scroll que o iOS faz para revelar um campo por cima do
  // teclado: aí o movimento é para bem do utilizador e não se desfaz.
  const typing = () => {
    const el = document.activeElement;
    return (
      el instanceof HTMLElement &&
      (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
    );
  };

  window.addEventListener(
    "scroll",
    () => {
      if (window.scrollY !== 0 && !typing()) window.scrollTo(0, 0);
    },
    { passive: true }
  );
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
  const BLUR_KEY = "arcade-debug-noblur";

  const stored = (key) => {
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };

  const remember = (key, on) => {
    try {
      if (on) window.localStorage.setItem(key, "1");
      else window.localStorage.removeItem(key);
    } catch {
      /* modo privado: a escolha vale só para esta sessão. */
    }
  };

  // Tira o `backdrop-filter` a tudo (ver a regra em splash.css), para se
  // ver se a névoa por trás da barra de estado é nossa ou do sistema.
  const setBlur = (off) => {
    root.toggleAttribute("data-no-blur", off);
    remember(BLUR_KEY, off);
    render();
  };

  const param = new URLSearchParams(window.location.search).get("debug");
  if (param === "viewport") remember(STORE_KEY, true);
  if (param === "blur") {
    remember(STORE_KEY, true);
    remember(BLUR_KEY, true);
  }
  if (param === "off") {
    remember(STORE_KEY, false);
    remember(BLUR_KEY, false);
  }

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

  // O que o CSS está mesmo a aplicar, não o que devia.
  //
  // A linha `css` acima sonda os `--probe-*`, que já existiam antes da regra
  // do vidro — não serve para saber se o splash.css em uso já a traz. Se
  // estiver em cache, o atributo muda e não acontece nada, que se confunde
  // com "o vidro não era a causa". Por isso lemos o valor computado de um
  // elemento com vidro e do pseudo-elemento que preenche a barra de estado:
  // com o vidro desligado, ambos têm de dizer `none`.
  function computedBlur(el, pseudo) {
    if (!el) return "-";
    const cs = getComputedStyle(el, pseudo);
    const v = cs.backdropFilter || cs.webkitBackdropFilter || "none";
    return v === "none" ? "none" : "ATIVO";
  }

  function glassState() {
    const glass = document.querySelector(".topnav, .topBar, .hud, .game-panel");
    const shell = document.getElementById("app");
    return `elem:${computedBlur(glass, null)} ::before:${computedBlur(shell, "::before")}`;
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
      `vidro        ${root.hasAttribute("data-no-blur") ? "DESLIGADO" : "ligado"} (2 dedos)   ${glassState()}`,
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
      remember(STORE_KEY, false);
    } else {
      show();
      remember(STORE_KEY, true);
    }
  }

  document.addEventListener(
    "touchstart",
    (event) => {
      // Três dedos: liga e desliga o painel. Não colide com nada nos jogos
      // nem no site.
      if (event.touches.length === 3) toggle();
      // Dois dedos: só conta com o painel no ar, senão apanhava um gesto
      // que se faz sem querer a jogar.
      else if (event.touches.length === 2 && panel) {
        setBlur(!root.hasAttribute("data-no-blur"));
      }
    },
    { passive: true }
  );

  const start = () => {
    if (stored(BLUR_KEY)) root.toggleAttribute("data-no-blur", true);
    if (stored(STORE_KEY)) show();
    window.addEventListener("resize", render);
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
