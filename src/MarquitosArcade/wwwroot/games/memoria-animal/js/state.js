// Estado mutável da partida e da sessão.

/**
 * @typedef {object} Card
 * @property {number} index Posição no tabuleiro.
 * @property {string} animal Id do animal (ver animals.js).
 * @property {HTMLButtonElement} el
 * @property {boolean} up Virada para cima.
 * @property {boolean} matched Já tem o par encontrado.
 */

export const game = {
    /**
     * menu    — nos ecrãs do menu; o tabuleiro por trás é só enfeite
     * loading — à espera que as ilustrações do nível carreguem
     * preview — cartas à vista antes de se virarem
     * playing — a jogar
     * ending  — último par encontrado, a caminho dos resultados
     * result  — no ecrã de resultados
     */
    phase: 'menu',
    paused: false,

    /** Nível que o menu aponta — o "Jogar" joga este. */
    menuLevelId: 1,

    /** @type {import('./levels.js').Level|null} */
    level: null,
    /** @type {Card[]} */
    cards: [],
    /** A primeira carta da jogada em curso, à espera da segunda. */
    /** @type {Card|null} */
    first: null,
    /** As duas cartas sem par que estão à vista, à espera de se virarem. */
    /** @type {Card[]} */
    wrong: [],

    attempts: 0,
    errors: 0,
    pairsFound: 0,
    /** Tempo de jogo, em segundos. Só anda em `playing` e fora da pausa. */
    elapsed: 0,

    /** Relógios em segundos: pré-visualização, cartas erradas e fim do nível. */
    previewTimer: 0,
    wrongTimer: 0,
    endTimer: 0,

    /** O que o ecrã de resultados mostra (ver level.js). */
    result: null
};

export const session = {
    /** Nome no ecrã. */
    playerName: '',
    /** Nome a enviar ao quadro — vazio se o jogador não deu nenhum. */
    playerBoardName: ''
};
