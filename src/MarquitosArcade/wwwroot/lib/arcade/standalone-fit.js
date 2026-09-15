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

  // ?debug=viewport: numa app afixada não há consola, por isso os números
  // que interessam aparecem por cima de tudo.
  if (new URLSearchParams(window.location.search).get("debug") === "viewport") {
    const show = () => {
      const box = document.getElementById("viewport-debug") ?? (() => {
        const el = document.createElement("pre");
        el.id = "viewport-debug";
        el.style.cssText =
          "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;margin:0;" +
          "padding:8px;font:11px/1.45 ui-monospace,monospace;white-space:pre;" +
          "background:rgba(255,0,110,.92);color:#fff;pointer-events:none";
        document.body.appendChild(el);
        return el;
      })();
      const inset = (side) =>
        getComputedStyle(root).getPropertyValue(`--probe-${side}`).trim() || "?";
      box.textContent = [
        `standalone   ${window.navigator.standalone === true}`,
        `innerHeight  ${window.innerHeight}   screen ${window.screen.width}x${window.screen.height}`,
        `viewport-gap ${getComputedStyle(root).getPropertyValue("--viewport-gap").trim()}`,
        `safe-area    topo ${inset("top")}  fundo ${inset("bottom")}`,
        `dpr ${window.devicePixelRatio}`,
      ].join("\n");
    };
    const start = () => {
      show();
      window.addEventListener("resize", show);
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
