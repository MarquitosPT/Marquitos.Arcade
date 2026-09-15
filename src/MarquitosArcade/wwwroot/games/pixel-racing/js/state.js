// Estado da sessão e da corrida em curso.
//
// Duas coisas diferentes com tempos de vida diferentes: a `session` dura desde o
// menu até se voltar ao menu (é ela que guarda os pontos do torneio entre
// corridas); a `race` é reposta a cada arranque de corrida.

import { MODE_QUICK, PLAYER_COLOR, ZOOM } from './config.js';
import { TRACKS } from './tracks.js';

export const session = {
    mode: MODE_QUICK,
    /** Pista escolhida no modo corrida rápida. */
    trackIdx: 0,
    /** Taça escolhida no modo campeonato (índice em TOURNAMENT_CUPS). */
    cupIdx: 0,
    /** Pistas desta sessão: uma na corrida rápida, três no torneio. */
    tracks: [0],
    /** Índice da corrida atual dentro de `tracks`. */
    raceIndex: 0,
    /** Cor do carro do jogador, escolhida no ecrã de preparação. */
    playerColor: PLAYER_COLOR,
    /** Multiplicador de velocidade dos adversários. */
    difficulty: 0.95,
    /** [{ key, name, color }] — o jogador é sempre o índice 0. */
    participants: [],
    /** Pontos de campeonato por `key` de participante. */
    tournamentPoints: {},
    /** Pontuação acumulada do jogador, a que vai para o leaderboard. */
    playerScore: 0
};

export const race = {
    /** Viewport do SDK (dimensões lógicas, DPR, topInset). Preenchido pelo main.js. */
    view: null,

    /** menu | countdown | racing | finishOverlay | result */
    phase: 'menu',
    paused: false,

    // Começa na primeira pista para o menu ter fundo: o ciclo de desenho corre
    // desde o carregamento da página e pinta a pista por trás do ecrã inicial.
    track: TRACKS[0],
    cars: [],
    player: null,

    /** Tempo de corrida em segundos, desde o GO!. */
    clock: 0,
    countdownValue: 3,
    countdownTimer: 0,
    /** Segundos que faltam do ecrã "CHEGASTE!" antes dos resultados. */
    finishTimer: 0,
    /** Classificação congelada no momento da meta. */
    finishSnapshot: null,

    camera: { x: 800, y: 600 },
    zoom: ZOOM,
    /** Tremor do ecrã em embates; `amount` decai sozinho. */
    shake: { x: 0, y: 0, amount: 0 },
    /** Relógio contínuo, também fora da corrida: alimenta as animações pulsantes. */
    globalClock: 0
};

/** Soma tremor ao ecrã, com teto para um encontrão múltiplo não enjoar ninguém. */
export function bumpShake(amount) {
    race.shake.amount = Math.min(14, race.shake.amount + amount);
}
