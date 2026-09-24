// Desliga o menu de contexto do browser (botão direito) na arcada e nos jogos.
//
// Num jogo o menu só atrapalha: aparece por cima do tabuleiro e rouba o foco a
// meio de uma jogada. Os jogos que dão uso ao botão direito (as Terras do Reino
// abrem as opções da casa) tratam-no nos seus próprios eventos de ponteiro.
//
// Os campos de texto ficam de fora: é lá que o menu serve para colar, corrigir
// a ortografia ou escolher uma palavra-passe guardada. Os <input> que não
// recebem texto (caixas, botões, sliders...) não contam como tal.
(() => {
  const TEXT_FIELD = [
    'input:not([type="button"], [type="submit"], [type="reset"], [type="image"], '
      + '[type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"])',
    'textarea',
    '[contenteditable]:not([contenteditable="false"])'
  ].join(', ');

  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest?.(TEXT_FIELD)) return;
    event.preventDefault();
  });
})();
