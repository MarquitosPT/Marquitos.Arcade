// Desliga o menu de contexto do browser (botão direito) na arcada e nos jogos.
//
// Num jogo o menu só atrapalha: aparece por cima do tabuleiro e rouba o foco a
// meio de uma jogada. Os jogos que dão uso ao botão direito (as Terras do Reino
// abrem as opções da casa) tratam-no nos seus próprios eventos de ponteiro.
//
// Os campos de texto ficam de fora: é lá que o menu serve para colar, corrigir
// a ortografia ou escolher uma palavra-passe guardada.
document.addEventListener('contextmenu', (event) => {
  if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  event.preventDefault();
});
