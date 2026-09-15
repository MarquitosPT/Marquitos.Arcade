// Arranca o ecrã de arranque sozinho, a partir do markup da página.
//
// Porquê um módulo à parte do splash.js: este é o único ficheiro do SDK com
// efeitos ao ser importado, e é carregado pelo seu próprio <script> em vez de
// vir pela cadeia de imports do jogo. A diferença conta — se o main.js de um
// jogo rebentar a carregar, o ecrã de arranque sai na mesma e vê-se o jogo
// partido, em vez de ficar uma barra de loading eterna a tapar o erro.
//
// A configuração vem de data-attributes no próprio elemento, para o portal
// (Blazor) e os jogos (HTML estático) partilharem o mesmo ficheiro:
//
//   <div id="arcadeSplash" class="arcade-splash" data-splash-once="session">
//
//   data-splash-once="session"  mostra uma vez por separador (o portal)
//   data-splash-min="3000"      tempo mínimo no ar, em ms
//
// Fica em window.__arcadeSplash, como o window.__arcadeTheme do theme.js: é
// assim que o main.js de cada jogo avisa que já montou o menu
// (window.__arcadeSplash?.ready()) sem ter de importar nada.

import { createSplash } from './splash.js';

const root = document.getElementById('arcadeSplash');

if (root) {
    const options = {};
    if (root.dataset.splashOnce) options.once = root.dataset.splashOnce;
    if (root.dataset.splashMin) options.minDuration = Number(root.dataset.splashMin);

    const splash = createSplash(root, options);
    window.__arcadeSplash = splash;

    // Sem um `ready()` de ninguém, o fim do carregamento da página serve de
    // sinal. É o que basta ao portal, e é a rede de segurança dos jogos.
    if (document.readyState === 'complete') splash.ready();
    else window.addEventListener('load', () => splash.ready(), { once: true });
}
