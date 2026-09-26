// Constantes de afinação da Memória Animal.
//
// Os tamanhos dos cartões não vivem aqui: dependem do ecrã e do número de
// cartas, e quem os decide é o js/layout.js a cada remedição. Aqui ficam os
// números do jogo — tempos, pontos e estrelas.

export const GAME_ID = 'memoria-animal';

/**
 * O que a janela "Acerca" mostra (ver /lib/arcade/about.js). Os autores e o
 * titular do copyright são os da arcada; o ano do © é o da publicação.
 */
export const ABOUT = {
    title: 'Memória Animal',
    emoji: '🐮',
    tagline: 'Pares · Memória · Bicharada',
    version: '0.9.0',
    published: '2026-09-26',
    status: 'Em testes'
};

export const NAME_STORAGE_KEY = 'memoriaAnimalPlayerName_v1';
export const PROGRESS_STORAGE_KEY = 'memoriaAnimalProgress_v1';

/** Etiqueta de quem não deu nome. Nunca é guardada nem enviada ao quadro (ver lib/arcade/scores.js). */
export const PLAYER_FALLBACK = 'Tu';

// ---------- Níveis ----------

/**
 * O primeiro nível tem 4 cartas (2 pares) e cada nível acrescenta 2, até às 32
 * do último (16 pares): quinze níveis. As 32 cabem num telemóvel ao alto numa
 * grelha de 4 × 8 com cartões de uns 70px — o suficiente para se reconhecer o
 * animal de relance (ver js/layout.js).
 */
export const FIRST_LEVEL_CARDS = 4;
export const CARDS_STEP = 2;
export const MAX_CARDS = 32;

// ---------- Ritmo ----------

/**
 * No início de cada nível as cartas ficam à vista uns instantes, para se
 * olhar bem antes de se virarem. Cresce com o tabuleiro, mas com teto: num
 * tabuleiro de 32 ninguém as decora todas em três segundos e meio, e é
 * precisamente isso que o torna difícil.
 */
export const PREVIEW_BASE_SECONDS = 1.2;
export const PREVIEW_PER_PAIR = 0.15;
export const PREVIEW_MAX_SECONDS = 3.5;

/** Quanto tempo ficam à vista duas cartas que não formam par, antes de se virarem. */
export const MISMATCH_SECONDS = 0.9;

/** Entre o último par e o ecrã de resultados — para se ver o tabuleiro completo. */
export const CLEAR_PAUSE_SECONDS = 1.1;

// ---------- Pontuação ----------

/** Pontos por cada par encontrado. */
export const PAIR_POINTS = 100;

/** Pontos por cada segundo abaixo do tempo-alvo do nível. */
export const TIME_POINTS = 5;

/** Tempo-alvo: segundos por par. Abaixo dele, cada segundo que sobra vale pontos. */
export const PAR_SECONDS_PER_PAIR = 5;

/** Pontos que cada erro (duas cartas sem par) custa. */
export const ERROR_POINTS = 20;

/**
 * Um nível concluído vale sempre, pelo menos, isto por par — por muitos erros
 * que se tenham dado. Acabar um tabuleiro nunca pode valer zero.
 */
export const MIN_POINTS_PER_PAIR = 25;

/**
 * As três estrelas de um nível, pelo número de erros:
 *   1 — concluído;
 *   2 — com tantos erros quantos pares, ou menos;
 *   3 — com metade disso, ou menos.
 * São pelos erros e não pelo tempo de propósito: é um jogo de memória, e quem
 * joga devagar mas sem se enganar jogou bem.
 */
export const MAX_STARS = 3;
export const TWO_STAR_ERRORS_PER_PAIR = 1;
export const THREE_STAR_ERRORS_PER_PAIR = 0.5;
