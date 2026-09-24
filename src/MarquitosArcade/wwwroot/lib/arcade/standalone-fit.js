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
})();
