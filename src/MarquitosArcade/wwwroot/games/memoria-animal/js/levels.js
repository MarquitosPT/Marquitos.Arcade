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
 * estreito. Vão do ninho à arca — a do Noé, com a bicharada toda.
 */
const NAMES = [
    'Ninho', 'Capoeira', 'Pocilga', 'Curral', 'Estábulo', 'Celeiro',
    'Pomar', 'Prado', 'Charco', 'Ribeiro', 'Colmeia', 'Pinhal',
    'Bosque', 'Montado', 'Lameiro', 'Serra', 'Planalto', 'Pântano',
    'Savana', 'Deserto', 'Selva', 'Recife', 'Oceano', 'Arca'
];

/**
 * @typedef {object} Level
 * @property {number} id Número do nível, a começar em 1.
 * @property {string} name
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
        cards,
        pairs,
        par: pairs * PAR_SECONDS_PER_PAIR,
        twoStarErrors: Math.floor(pairs * TWO_STAR_ERRORS_PER_PAIR),
        threeStarErrors: Math.floor(pairs * THREE_STAR_ERRORS_PER_PAIR)
    });
}

export const levelCount = () => LEVELS.length;

export const levelById = (id) => LEVELS.find((level) => level.id === id) || null;
