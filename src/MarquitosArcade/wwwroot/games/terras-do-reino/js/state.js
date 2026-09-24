// Estado mutável do reino: o mundo, os bens, os edifícios, o mercado e as vilas.
//
// Tudo o que é guardado sai daqui (ver save.js); o que não é guardado — as
// caravanas, os números a flutuar, a seleção — vive em `fx` e `ui`, e perde-se
// sem mal nenhum ao fechar o jogo.

import { CASTLE_LEVELS, RESOURCES } from './config.js';

export const emptyResources = () => Object.fromEntries(RESOURCES.map((r) => [r.id, 0]));

/** O reino em jogo. `null` enquanto se está no menu sem partida carregada. */
export const game = {
    /** 'menu' | 'playing' */
    phase: 'menu',
    paused: false,
    speed: 1,
    world: null,
    seed: 0,
    /** Segundos de jogo desde o início do reino. */
    played: 0,
    /** Segundos dentro do dia corrente. */
    clock: 0,
    day: 1,
    castleLevel: 1,
    res: emptyResources(),
    /** Contentamento do povo, de 0 a 1. */
    happy: 0.45,
    /** Edifícios do jogador, por ordem de construção (é a ordem em que recebem trabalhadores). */
    buildings: [],
    nextId: 1,
    /** Casas onde um guarda-florestal plantou árvores (índices), para a gravação. */
    planted: [],
    /** Casas de colina que o jogador aplanou (índices), para a gravação. */
    flattened: [],
    /** Sobe sempre que uma estrada abre ou fecha: quem guarda caminhos pelas estradas refá-los. */
    roadsVersion: 0,
    market: { stock: {}, fair: null, nextFairDay: 3 },
    towns: [],
    questIndex: 0,
    stats: { harvested: 0, sold: 0, bought: 0, earned: 0, built: 0 },
    /** A melhor prosperidade já enviada ao quadro, para não enviar a mesma duas vezes. */
    bestSubmitted: 0,
    /** Cache dos números derivados, refeita a cada passo da economia. */
    derived: { residents: 0, workersUsed: 0, taxPerDay: 0, prosperity: 0, storage: 150, fedRatio: 0 }
};

/** Efeitos que não se guardam: caravanas, gente a andar, números a subir, pó da construção. */
export const fx = {
    caravans: [],
    walkers: [],
    floats: [],
    puffs: [],
    /** Relógio global em segundos reais — anima água, nuvens e moinhos mesmo em pausa. */
    time: 0
};

/** O que a interface está a fazer: modo de construção e casa selecionada. */
export const ui = {
    /** Id do edifício a construir, 'road' para abrir estradas, ou null. */
    placing: null,
    /** Em modo de estrada: a casa onde acabou o último troço (o próximo começa aí). */
    roadFrom: null,
    /** Em modo de estrada, com rato: o troço que se abriria (casas), se se pode pagar e para onde foi pedido. */
    roadPreview: null,
    roadPreviewOk: false,
    roadPreviewKey: '',
    /** Casa por baixo do ponteiro (rato), em modo de construção. */
    hover: null,
    /**
     * Ao toque, o sítio escolhido à espera de ✓ ou ✕: o canto do bloco de um
     * edifício, ou a casa onde acaba o troço de estrada.
     */
    pending: null,
    selected: null
};

export const castleInfo = () => CASTLE_LEVELS[game.castleLevel];
