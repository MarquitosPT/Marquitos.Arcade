// Salta o ecrã de arranque quando se volta a um jogo de uma página dele.
//
// O ecrã de arranque de um jogo sai sempre — é o arranque da consola. Mas quem
// foi ler o guia do jogo e volta não está a arrancar nada: está a regressar,
// e ver o logótipo e a barra outra vez parece um recarregar desnecessário.
//
// A página que se deixa (o guia) marca o regresso com `skipSplashOnNextVisit`
// (splash.js): uma nota de uso único no sessionStorage com o caminho do jogo e
// a hora. Este script lê-a e apaga-a logo; se for para esta página e for
// recente, põe `arcade-splash-skip` no <html>, e o splash.css esconde o ecrã.
//
// Tem de ser um <script> clássico no <head>, e não parte do splash-boot.js: o
// módulo só corre depois de o HTML estar lido, e até lá o ecrã de arranque já
// se tinha pintado — piscava e desaparecia, que é pior do que ficar.
(() => {
  // A mesma chave do splash.js (SKIP_KEY), que escreve a nota.
  const KEY = 'arcade:splash-skip';
  const TTL_MS = 15000;

  let note = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    note = JSON.parse(raw || 'null');
  } catch {
    // Armazenamento bloqueado ou nota estragada: o arranque sai como sempre.
    return;
  }

  const fresh = note && typeof note.at === 'number' && Date.now() - note.at < TTL_MS;
  if (fresh && note.path === location.pathname.replace(/index\.html$/, '')) {
    document.documentElement.classList.add('arcade-splash-skip');
  }
})();
