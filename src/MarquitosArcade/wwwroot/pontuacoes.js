// Carrossel de jogos da página de pontuações (ver wwwroot/lib/arcade/carousel.js,
// a mesma receita do menu de níveis do Maze Run).
//
// Ao contrário do menu do Maze Run, aqui não há nada para "escolher": cada
// página do carrossel já é só o quadro de pontuações desse jogo (ver
// Components/Pages/Pontuacoes.razor), por isso deslizar entre jogos é só um
// efeito visual, sem pedir nada ao servidor. O ícone, o título e o
// "↻ Atualizar" vivem fora do que desliza — um cabeçalho só, preso ao topo
// do cartão — e é este ficheiro que os mantém a corresponder ao jogo que
// está à vista, lendo os `data-*` do cartão da página atual. Só o
// "Atualizar" é que navega a sério, para /pontuacoes?jogo=<id> — e é a
// navegação melhorada do Blazor que troca o conteúdo sem recarregar a
// página.
//
// Essa troca de conteúdo é também a razão de isto se repetir a cada
// navegação: o carrossel guarda os cartões numa cópia sua (ver `setCards`
// mais abaixo), e essa cópia fica desatualizada quando o servidor manda
// outro jogo para abrir.

import { createCarousel } from './lib/arcade/index.js';

/** O cabeçalho (ícone, título, "Atualizar") tem sempre de refletir o jogo à vista. */
function updateHeader(card) {
    if (!card) return;
    const { value: id, emoji, name } = card.dataset;

    const refreshBtn = document.getElementById('gamesRefreshBtn');
    if (refreshBtn && id) refreshBtn.href = `/pontuacoes?jogo=${encodeURIComponent(id)}`;

    const emojiEl = document.getElementById('gamesEmoji');
    if (emojiEl && emoji) emojiEl.textContent = emoji;

    const nameEl = document.getElementById('gamesName');
    if (nameEl && name) nameEl.textContent = name;
}

function syncCarousel() {
    const root = document.getElementById('gamesCarousel');
    if (!root) return;

    const viewport = document.getElementById('gamesViewport');
    const track = document.getElementById('gamesTrack');
    const cards = Array.from(track.querySelectorAll('.scoreCard'));
    const showIndex = Math.max(0, cards.findIndex((card) => card.dataset.value === root.dataset.selected));

    // O carrossel em si só se cria uma vez: o `viewport` sobrevive a uma
    // navegação melhorada para esta mesma página (ex.: o botão Recuar do
    // browser, ou o link "Atualizar"), e recriá-lo duplicava os ouvintes do
    // arrasto e das setas em cima do mesmo elemento.
    let carousel = viewport.__arcadeCarousel;
    if (!carousel) {
        carousel = createCarousel({
            root,
            viewport,
            track,
            prev: document.getElementById('gamesPrevBtn'),
            next: document.getElementById('gamesNextBtn'),
            dots: document.getElementById('gamesDots')
        }, {
            pageClass: 'gamePage',
            // Sempre à procura de novo no DOM (nunca por `cards` ali de
            // cima): isto só se define uma vez, mas continua a ser chamado
            // depois de a página ter sido reconstruída por `syncCarousel`.
            onPageChange(page) {
                updateHeader(document.querySelectorAll('#gamesTrack .scoreCard')[page]);
            }
        });
        viewport.__arcadeCarousel = carousel;
    }
    carousel.setCards(cards.map((card) => card.outerHTML), { show: showIndex });
    updateHeader(cards[showIndex]);
}

syncCarousel();
window.__arcadePontuacoes = { reapply: syncCarousel };

// As setas do teclado mudam de página do carrossel de jogos.
document.addEventListener('keydown', (event) => {
    const carousel = document.getElementById('gamesViewport')?.__arcadeCarousel;
    if (carousel?.handleKey(event.key)) event.preventDefault();
});
