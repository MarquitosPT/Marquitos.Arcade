// Carrossel de jogos da página de pontuações (ver wwwroot/lib/arcade/carousel.js,
// a mesma receita do menu de níveis do Maze Run).
//
// Trocar de jogo é só isso — um cartão é um link normal para
// /pontuacoes?jogo=<id>, e é a navegação melhorada do Blazor que já trata de
// ir buscar o HTML novo ao servidor e trocar o conteúdo sem recarregar a
// página. Sem isto, os cartões continuam a funcionar como uma grelha simples
// (ver o CSS): o que falta ao carregar só JS é repô-los em páginas do
// carrossel e voltar a fazê-lo a seguir a cada uma dessas navegações — o
// carrossel guarda os cartões numa cópia sua (ver `setCards` mais abaixo) que
// fica desatualizada quando o servidor manda outro jogo selecionado.

import { createCarousel } from './lib/arcade/index.js';

function syncCarousel() {
    const root = document.getElementById('gamesCarousel');
    if (!root) return;

    const viewport = document.getElementById('gamesViewport');
    const track = document.getElementById('gamesTrack');
    const cards = Array.from(track.querySelectorAll('.gameCard'));
    const activeIndex = Math.max(0, cards.findIndex((card) => card.classList.contains('active')));

    // O carrossel em si só se cria uma vez: o `viewport` sobrevive a uma
    // navegação melhorada para esta mesma página (ex.: o botão Recuar do
    // browser), e recriá-lo duplicava os ouvintes do arrasto e das setas em
    // cima do mesmo elemento.
    let carousel = viewport.__arcadeCarousel;
    if (!carousel) {
        carousel = createCarousel({
            root,
            viewport,
            track,
            prev: document.getElementById('gamesPrevBtn'),
            next: document.getElementById('gamesNextBtn'),
            dots: document.getElementById('gamesDots')
        }, { pageClass: 'gamePage' });
        viewport.__arcadeCarousel = carousel;
    }
    carousel.setCards(cards.map((card) => card.outerHTML), { show: activeIndex });
}

syncCarousel();
window.__arcadePontuacoes = { reapply: syncCarousel };

// As setas do teclado mudam de página do carrossel de jogos.
document.addEventListener('keydown', (event) => {
    const carousel = document.getElementById('gamesViewport')?.__arcadeCarousel;
    if (carousel?.handleKey(event.key)) event.preventDefault();
});
