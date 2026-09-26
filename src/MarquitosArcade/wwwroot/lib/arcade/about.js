// Janela "Acerca" dos jogos: título, versão, autores, data de publicação e copyright.
//
// Os dados vivem no `config.js` de cada jogo (`ABOUT`), como os outros números
// que se afinam à mão; este módulo só os põe no ecrã. Há duas maneiras de os
// mostrar, para cada jogo usar a que lhe fica melhor:
//
//   - `createAboutDialog` monta um <dialog> modal com a folha about.css — é o
//     que servem os jogos com barra de topo (Maze Run, Pixel Racing, Pong,
//     Terras do Reino), que não têm um sítio natural para mais um ecrã;
//   - `renderAboutDetails` devolve só a ficha, para um jogo que já tem os seus
//     próprios ecrãs sobrepostos a enfiar num deles (a Tasca do Zé).
//
// A janela é um <dialog> nativo com `showModal()`: o browser trata do foco, do
// Esc e de pôr o resto da página inerte, sem nada disto ter de ser refeito aqui.

/** Quem faz a arcada. Um jogo com outros autores lista-os no seu `ABOUT`. */
export const ARCADE_AUTHORS = ['Marcos Gomes (MarquitosPT)'];

/** Titular dos direitos, a seguir ao "©" e ao ano. */
export const ARCADE_COPYRIGHT_HOLDER = 'MarquitosPT';

/**
 * @typedef {object} AboutInfo
 * @property {string} title Nome do jogo.
 * @property {string} version Versão, ex. "1.0.0".
 * @property {string} published Data de publicação, em ISO (`AAAA-MM-DD`).
 * @property {string} [emoji] Ícone ao lado do título.
 * @property {string} [tagline] Subtítulo curto.
 * @property {string} [status] Nota de estado (ex. "Em testes"), se não for uma versão final.
 * @property {string[]} [authors] Por omissão, `ARCADE_AUTHORS`.
 * @property {string} [copyrightHolder] Por omissão, `ARCADE_COPYRIGHT_HOLDER`.
 */

/** "2026-09-19" -> "19 de setembro de 2026". Uma data inválida passa tal como veio. */
export function formatAboutDate(iso) {
    const [year, month, day] = String(iso).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    if (Number.isNaN(date.getTime())) return String(iso);
    return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** "© 2026 MarquitosPT. Todos os direitos reservados." — o ano é o da publicação. */
export function aboutCopyright(info) {
    const year = String(info.published).slice(0, 4);
    const holder = info.copyrightHolder || ARCADE_COPYRIGHT_HOLDER;
    return `© ${year} ${holder}. Todos os direitos reservados.`;
}

/**
 * A ficha do jogo: uma lista de definições (versão, autores, publicação) e a
 * linha de copyright. Sem título — quem a usa já tem o seu.
 *
 * @param {AboutInfo} info
 * @returns {HTMLElement}
 */
export function renderAboutDetails(info) {
    const root = document.createElement('div');
    root.className = 'arcade-about-details';

    const list = document.createElement('dl');
    list.className = 'arcade-about-list';
    const authors = info.authors?.length ? info.authors : ARCADE_AUTHORS;
    const rows = [
        ['Versão', info.version],
        info.status && ['Estado', info.status],
        [authors.length > 1 ? 'Autores' : 'Autor', authors.join(', ')],
        ['Publicado', formatAboutDate(info.published)]
    ].filter(Boolean);

    for (const [term, value] of rows) {
        const row = document.createElement('div');
        row.className = 'arcade-about-row';
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        dd.textContent = value;
        row.append(dt, dd);
        list.appendChild(row);
    }

    const copyright = document.createElement('p');
    copyright.className = 'arcade-about-copyright';
    copyright.textContent = aboutCopyright(info);

    root.append(list, copyright);
    return root;
}

/**
 * Janela modal "Acerca", aberta pelo botão `opener`.
 *
 * O aspeto é o do about.css, afinado por jogo com as variáveis `--about-*`
 * (ver o topo dessa folha).
 *
 * @param {AboutInfo} info
 * @param {object} [options]
 * @param {HTMLElement} [options.opener] Botão que abre a janela.
 * @param {() => void} [options.onOpen] Ex.: um som de clique.
 * @returns {{open: () => void, close: () => void, dialog: HTMLDialogElement}}
 */
export function createAboutDialog(info, { opener, onOpen } = {}) {
    const dialog = document.createElement('dialog');
    dialog.className = 'arcade-about';
    dialog.setAttribute('aria-labelledby', 'arcadeAboutTitle');

    const panel = document.createElement('div');
    panel.className = 'arcade-about-panel';

    const head = document.createElement('div');
    head.className = 'arcade-about-head';
    if (info.emoji) {
        const badge = document.createElement('span');
        badge.className = 'arcade-about-badge';
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = info.emoji;
        head.appendChild(badge);
    }
    const kicker = document.createElement('p');
    kicker.className = 'arcade-about-kicker';
    kicker.textContent = 'Acerca de';
    const title = document.createElement('h2');
    title.className = 'arcade-about-title';
    title.id = 'arcadeAboutTitle';
    title.textContent = info.title;
    head.append(kicker, title);
    if (info.tagline) {
        const tagline = document.createElement('p');
        tagline.className = 'arcade-about-tagline';
        tagline.textContent = info.tagline;
        head.appendChild(tagline);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'arcade-about-close';
    close.textContent = 'Fechar';
    close.addEventListener('click', () => dialog.close());

    panel.append(head, renderAboutDetails(info), close);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    // Um toque no véu, fora do painel, também fecha.
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });

    // As teclas ficam na janela: os jogos ouvem o teclado no `window`, e um
    // Enter ou uma seta aqui não deviam mexer no menu por trás. O Esc continua
    // a fechar — isso é o comportamento por omissão do <dialog>, não um ouvinte.
    dialog.addEventListener('keydown', (event) => event.stopPropagation());

    function open() {
        if (dialog.open) return;
        onOpen?.();
        dialog.showModal();
        close.focus();
    }

    opener?.addEventListener('click', open);

    return { open, close: () => dialog.close(), dialog };
}
