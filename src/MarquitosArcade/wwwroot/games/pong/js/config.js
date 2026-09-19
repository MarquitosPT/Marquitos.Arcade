// Constantes de afinação do Pong Retro.
//
// Quase tudo é relativo às dimensões do ecrã (frações de W ou H) em vez de pixels
// fixos: o jogo corre desde um iPhone em retrato até um monitor grande, e as
// proporções têm de aguentar os dois.

export const GAME_ID = 'pong';

/** Chave de localStorage com o nome do jogador. O sufixo _v1 permite mudar o formato. */
export const NAME_STORAGE_KEY = 'pongPlayerName_v1';

export const MODE_SINGLE = 'single';
export const MODE_TWO = 'two';

/** Níveis do adversário (multiplicador da velocidade de perseguição). */
export const AI_LEVELS = { easy: 0.6, medium: 0.85, hard: 1.05 };
export const DEFAULT_AI_LEVEL = AI_LEVELS.medium;

export const TUNING = {
    /** Ganho de velocidade da bola a cada raquetada — é isto que faz o ralali subir. */
    ballSpeedup: 1.04,
    /** A bola nunca fica mais lenta do que isto, mesmo num ecrã pequeno. */
    minBallSpeed: 3.2,

    /*
     * Há dois campos, e quem os escolhe é a orientação do ecrã, não o modo (ver
     * field.js): ao alto joga-se de cima para baixo, ao comprido joga-se de um
     * lado ao outro. A dois jogadores só se joga ao comprido — em retrato as duas
     * raquetes ficariam em cima uma da outra —, mas contra o CPU servem os dois.
     */

    /** Ao alto: raquetes em cima e em baixo, a bola sobe e desce. */
    endField: {
        paddleWidth: 0.22,      // x W
        paddleHeight: 0.012,    // x H (mínimo 10px)
        ballRadius: 0.018,      // x W (mínimo 6px)
        paddleMargin: 0.06,     // x H, distância da raquete ao bordo
        ballSpeed: 0.006        // x W
    },

    /** Ao comprido: raquetes nos lados, a bola vai e vem. */
    sideField: {
        paddleLength: 0.24,     // x H
        paddleThickness: 0.012, // x W (mínimo 10px)
        ballRadius: 0.025,      // x H (mínimo 6px)
        paddleMargin: 0.03,     // x W, distância da raquete ao bordo
        ballSpeed: 0.009        // x H
    },

    /** Adversário, em qualquer um dos campos. */
    ai: {
        /** x o lado por onde a raquete dele corre, antes do multiplicador de dificuldade. */
        speed: 0.012,
        /** Zona morta: abaixo disto não corrige, senão trema à volta da bola. */
        deadZone: 4
    },

    /** Margem de tolerância da colisão, em px, para a bola não atravessar a raquete. */
    hitTolerance: 10,

    /*
     * Folga, em px, entre uma raquete e a área de sistema mais próxima (o notch
     * ou a barra de gestos). Não chega a raquete não ficar por baixo delas: o
     * dedo que a arrasta também não pode acabar em cima da barra, senão o gesto
     * vai para o iOS em vez de ir para o jogo.
     */
    safeGap: 10
};
