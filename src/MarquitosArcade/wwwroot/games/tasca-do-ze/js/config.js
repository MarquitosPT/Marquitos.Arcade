// Afinação da Tasca do Zé: dificuldade, pontuação e chaves de armazenamento.
//
// O turno vai apertando à medida que se servem pratos — a paciência dos clientes
// encurta e os pedidos chegam mais depressa — até aos valores mínimos, que é onde
// o jogo estabiliza no seu ponto mais difícil.

export const GAME_ID = 'tasca-do-ze';

/**
 * O que a janela "Acerca" mostra (ver /lib/arcade/about.js). Os autores e o
 * titular do copyright são os da arcada; o ano do © é o da publicação.
 */
export const ABOUT = {
    title: 'Tasca do Zé',
    emoji: '🍽️',
    tagline: 'O teu turno na cozinha',
    version: '1.0.0',
    published: '2026-09-06'
};

/** Cache local do leaderboard. Só cópia de reserva: a verdade está no servidor. */
export const BOARD_CACHE_KEY = 'tascaDoZeLeaderboardCache_v1';
export const NAME_STORAGE_KEY = 'tascaDoZePlayerName_v1';

export const DEFAULT_PLAYER_NAME = 'Cozinheiro(a) Anónimo';

export const TUNING = {
    lives: 3,
    /** Pedidos à espera antes de a fila deixar de aceitar mais. */
    maxQueue: 5,

    /** Paciência de um cliente, em ms, no início do turno. */
    startPatienceMs: 22000,
    patienceFloorMs: 11000,
    patienceStepMs: 1500,

    /** Intervalo entre pedidos, em ms, no início do turno. */
    startSpawnIntervalMs: 6500,
    spawnIntervalFloorMs: 3200,
    spawnIntervalStepMs: 350,

    /** De quantos em quantos pratos servidos o turno aperta. */
    rampEveryServed: 4,

    /** Pontos base por prato, antes do bónus de segundos que sobraram. */
    pointsPerDish: 10,
    /** Castigo, em ms de paciência, por pôr um ingrediente errado. */
    wrongIngredientPenaltyMs: 1400,

    /** Probabilidade de o próximo pedido ser um prato principal (o resto é sobremesa). */
    mainDishChance: 0.72,

    toastMs: 1400
};

/** Cores da barra de paciência, do descansado ao quase a ir embora. */
export const PATIENCE_COLORS = { calm: '#4c8c4a', hurried: '#d69b2c', angry: '#c1442e' };
export const PATIENCE_THRESHOLDS = { calm: 50, hurried: 22 };
