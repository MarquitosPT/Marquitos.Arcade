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

    single: {
        paddleWidth: 0.22,      // x W
        paddleHeight: 0.012,    // x H (mínimo 10px)
        ballRadius: 0.018,      // x W (mínimo 6px)
        paddleMargin: 0.06,     // x H, distância da raquete ao bordo
        ballSpeed: 0.006,       // x W
        aiSpeed: 0.012,         // x W, antes do multiplicador de dificuldade
        /** Zona morta da IA: abaixo disto não corrige, senão trema à volta da bola. */
        aiDeadZone: 4
    },

    two: {
        paddleLength: 0.24,     // x H
        paddleThickness: 0.012, // x W (mínimo 10px)
        ballRadius: 0.025,      // x H (mínimo 6px)
        paddleMargin: 0.03,     // x W, distância da raquete ao bordo
        ballSpeed: 0.009        // x H
    },

    /** Margem de tolerância da colisão, em px, para a bola não atravessar a raquete. */
    hitTolerance: 10
};
