// Os níveis: quantas cartas tem cada tabuleiro.
//
// Não há tabuleiros desenhados à mão — cada nível é só um número de cartas, e
// os animais saem à sorte em cada partida (ver `dealCards` em board.js). É por
// isso que repetir um nível nunca é decorar a posição das cartas.

import {
    CARDS_STEP, FIRST_LEVEL_CARDS, MAX_CARDS, PAR_SECONDS_PER_PAIR,
    THREE_STAR_ERRORS_PER_PAIR, TWO_STAR_ERRORS_PER_PAIR
} from './config.js';

/**
 * Um nome por nível, uma palavra cada: aparece no HUD, que num telemóvel é
 * estreito. Vão do ninho à arca — a do Noé, com a bicharada toda. Um nível a
 * mais do que os nomes (ou as cores) chamava-se "Nível N" e repetia as cores.
 */
const NAMES = [
    'Ninho', 'Capoeira', 'Pocilga', 'Curral', 'Estábulo', 'Celeiro',
    'Pomar', 'Prado', 'Charco', 'Ribeiro', 'Colmeia', 'Pinhal',
    'Bosque', 'Montado', 'Lameiro', 'Serra', 'Planalto', 'Pântano',
    'Savana', 'Deserto', 'Selva', 'Recife', 'Oceano', 'Arca'
];

/**
 * A cor de cada nível, a condizer com o nome: a Colmeia é cor de mel, o
 * Oceano é azul, a Arca é roxa. É o acento do jogo inteiro enquanto o nível
 * está apontado ou a ser jogado (ver `applyLevelAccent` em level.js). São
 * todas claras de propósito: o texto dos botões, escuro, tem de se ler em
 * cima de qualquer uma, e a patinha branca das costas das cartas também.
 */
const ACCENTS = [
    '#f2b35a', '#ff9f5a', '#ff8fb1', '#e8a36b', '#7fb2ff', '#ff7a6b',
    '#ff6f8a', '#7ddc5a', '#4fd1c5', '#5ab8f2', '#ffcf4d', '#5ccf8e',
    '#9bd35a', '#c9b458', '#c99a6b', '#8fa9d9', '#b59cf2', '#7fc4a0',
    '#f2c14e', '#f5a25d', '#3ed598', '#ff7f6e', '#4aa8ff', '#c58cff'
];

/**
 * @typedef {object} Level
 * @property {number} id Número do nível, a começar em 1.
 * @property {string} name
 * @property {string} accent A cor do nível.
 * @property {number} cards Cartas no tabuleiro (sempre par).
 * @property {number} pairs
 * @property {number} par Tempo-alvo em segundos.
 * @property {number} twoStarErrors Erros até onde ainda se ganham duas estrelas.
 * @property {number} threeStarErrors Erros até onde ainda se ganham três.
 */

/** @type {Level[]} */
export const LEVELS = [];

for (let cards = FIRST_LEVEL_CARDS, id = 1; cards <= MAX_CARDS; cards += CARDS_STEP, id++) {
    const pairs = cards / 2;
    LEVELS.push({
        id,
        name: NAMES[id - 1] || `Nível ${id}`,
        accent: ACCENTS[(id - 1) % ACCENTS.length],
        cards,
        pairs,
        par: pairs * PAR_SECONDS_PER_PAIR,
        twoStarErrors: Math.floor(pairs * TWO_STAR_ERRORS_PER_PAIR),
        threeStarErrors: Math.floor(pairs * THREE_STAR_ERRORS_PER_PAIR)
    });
}

export const levelCount = () => LEVELS.length;

export const levelById = (id) => LEVELS.find((level) => level.id === id) || null;
