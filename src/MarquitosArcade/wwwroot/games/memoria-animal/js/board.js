// O tabuleiro: baralhar, montar as cartas e arrumá-las no ecrã.
//
// As cartas são botões — um toque, o Enter ou o Espaço viram-nas, e o leitor de
// ecrã diz o que está à vista. O virar é uma transição de CSS (css/board.css);
// aqui só se trocam classes.

import { escapeHtml, shuffle } from '/lib/arcade/index.js';

import { ANIMALS, animalById, animalSrc } from './animals.js';
import { fitGrid } from './layout.js';
import { game } from './state.js';
import { els } from './ui.js';

/** Altura do cartão a dividir pela largura: um pouco mais alto do que largo, como as cartas de papel. */
const CARD_RATIO = 1.15;

/** Teto da largura de um cartão — num computador, quatro cartas não precisam de encher o ecrã. */
const MAX_CARD_WIDTH = 150;

/** Cartas do último tabuleiro montado, para o relayout não ter de as procurar. */
let count = 0;

/**
 * Escolhe `pairs` animais diferentes à sorte e devolve as cartas baralhadas —
 * cada animal duas vezes.
 * @returns {string[]} Ids dos animais, pela ordem em que ficam no tabuleiro.
 */
export function dealCards(pairs) {
    const chosen = shuffle(ANIMALS.map((animal) => animal.id)).slice(0, pairs);
    return shuffle([...chosen, ...chosen]);
}

/**
 * Monta o tabuleiro com estas cartas, todas viradas para baixo.
 * @param {string[]} animals
 * @returns {import('./state.js').Card[]}
 */
export function buildBoard(animals) {
    count = animals.length;
    els.board.innerHTML = animals.map((id, index) => cardHtml(id, index)).join('');
    const cards = [...els.board.children].map((el, index) => ({
        index,
        animal: animals[index],
        el,
        up: false,
        matched: false
    }));
    layoutBoard();
    return cards;
}

function cardHtml(id, index) {
    // A ilustração vai logo no HTML, com a carta virada: quando ela se vira, a
    // imagem já está descodificada e não aparece uma carta branca a meio.
    return `<button type="button" class="card" data-index="${index}" aria-label="Carta ${index + 1}, virada para baixo">
        <span class="cardInner">
            <span class="cardFace cardBack" aria-hidden="true"></span>
            <span class="cardFace cardFront" aria-hidden="true">
                <img src="${animalSrc(id)}" alt="" draggable="false" decoding="async">
            </span>
        </span>
    </button>`;
}

/** Vira uma carta para cima ou para baixo, e diz ao leitor de ecrã o que se vê. */
export function setCardUp(card, up) {
    card.up = up;
    card.el.classList.toggle('is-up', up);
    const name = animalById(card.animal)?.name || '';
    card.el.setAttribute('aria-label', up
        ? `Carta ${card.index + 1}: ${name}${card.matched ? ', par encontrado' : ''}`
        : `Carta ${card.index + 1}, virada para baixo`);
}

export function setCardMatched(card) {
    card.matched = true;
    card.el.classList.add('is-matched');
    setCardUp(card, true);
}

/** As duas cartas sem par abanam — é o "não" do jogo. */
export function shakeCards(cards) {
    for (const card of cards) {
        card.el.classList.remove('is-wrong');
        // Forçar um reflow para a animação recomeçar se a mesma carta errar duas vezes seguidas.
        void card.el.offsetWidth;
        card.el.classList.add('is-wrong');
    }
}

/**
 * Espera que as ilustrações deste tabuleiro estejam prontas a desenhar, com um
 * teto: uma imagem que não chegue nunca pode deixar o nível por começar.
 */
export function whenImagesReady(timeoutMs = 4000) {
    const images = [...els.board.querySelectorAll('img')];
    const ready = Promise.all(images.map((img) => img.decode().catch(() => undefined)));
    const limit = new Promise((resolve) => setTimeout(resolve, timeoutMs));
    return Promise.race([ready, limit]);
}

/**
 * Arruma as cartas na área livre: escolhe as colunas e o tamanho que dão os
 * maiores cartões (ver layout.js). Corre a cada mudança de tamanho do ecrã.
 */
export function layoutBoard() {
    if (!count) return;
    const style = getComputedStyle(els.stage);
    const width = els.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = els.stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (width <= 0 || height <= 0) return;

    const grid = fitGrid({ count, width, height, ratio: CARD_RATIO, maxWidth: MAX_CARD_WIDTH });
    const board = els.board.style;
    board.setProperty('--cols', grid.cols);
    board.setProperty('--card-w', `${grid.cardW}px`);
    board.setProperty('--card-h', `${grid.cardH}px`);
    board.setProperty('--gap', `${grid.gap}px`);
    // O raio e a moldura acompanham o cartão: num de 60px, 14px de raio era uma bolacha.
    board.setProperty('--card-radius', `${Math.round(Math.max(8, Math.min(16, grid.cardW * 0.13)))}px`);
    els.board.dataset.cols = String(grid.cols);
}

/** A carta por trás de um clique, se for uma carta deste tabuleiro. */
export function cardFromEvent(event) {
    const el = event.target.closest('.card');
    if (!el || !els.board.contains(el)) return null;
    return game.cards[Number(el.dataset.index)] || null;
}

/** Mensagem por cima do HUD ("Olha bem…", o nome do animal) — nunca por cima das cartas. */
let bannerTimer = 0;
export function showBanner(text, { tone = '', hold = 0 } = {}) {
    clearTimeout(bannerTimer);
    els.banner.innerHTML = escapeHtml(text);
    els.banner.className = `banner is-visible${tone ? ` banner--${tone}` : ''}`;
    if (hold > 0) bannerTimer = setTimeout(hideBanner, hold);
}

export function hideBanner() {
    clearTimeout(bannerTimer);
    els.banner.classList.remove('is-visible');
}
