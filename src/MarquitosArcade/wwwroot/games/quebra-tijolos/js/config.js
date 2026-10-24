// Constantes de afinação do Quebra-Tijolos. Sem lógica: só números e nomes.
//
// Todas as medidas do campo estão em "unidades do campo", e não em píxeis do
// ecrã. O campo tem sempre o mesmo tamanho (FIELD_W × FIELD_H) e é o
// js/field.js que decide a escala com que ele se desenha: assim a física, os
// tijolos e a raquete nunca discordam uns dos outros, seja qual for o ecrã.

export const GAME_ID = 'quebra-tijolos';

/** Ficha da janela "Acerca" — a versão e a data têm de bater com o ArcadeCatalog.cs. */
export const ABOUT = {
    title: 'Quebra-Tijolos',
    emoji: '🧱',
    tagline: 'Bola · Raquete · Tijolos',
    version: '1.0.0',
    published: '2026-10-24'
};

export const NAME_STORAGE_KEY = 'quebraTijolosPlayerName_v1';
export const PROGRESS_STORAGE_KEY = 'quebraTijolosProgress_v1';
export const MUSIC_STORAGE_KEY = 'quebraTijolosMusic_v1';
export const PLAYER_FALLBACK = 'Tu';

export const FONT_DISPLAY = "'Fredoka', 'Outfit', 'Segoe UI', system-ui, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// ---------- O campo ----------

/** Colunas de tijolos: os níveis em js/levels.js são desenhados com esta largura. */
export const COLS = 13;
export const BRICK_W = 32;
export const BRICK_H = 16;
/** Interior do campo, onde a bola anda. */
export const FIELD_W = COLS * BRICK_W;
export const FIELD_H = 640;
/** Paredes à esquerda, à direita e no teto. Por baixo não há parede: é por lá que a bola se perde. */
export const WALL = 14;
/** Faixa do marcador, por cima do teto. */
export const HUD_H = 38;
/** Folga por baixo do campo, para o fundo da raquete não encostar ao fim do ecrã. */
export const FLOOR_PAD = 6;
/** Espaço entre o teto e a primeira fila de tijolos: é por aqui que a bola passa por trás deles. */
export const BRICKS_TOP = 48;
/** Margem do ecrã à volta do campo, em píxeis. */
export const SCREEN_MARGIN = 8;

// ---------- Raquete ----------

export const PADDLE_Y = FIELD_H - 44;
export const PADDLE_H = 14;
/** Largura no nível 1 e no último; os do meio ficam pelo caminho. */
export const PADDLE_W_FIRST = 80;
export const PADDLE_W_LAST = 60;
/** A raquete alargada (cápsula A). */
export const PADDLE_WIDE_FACTOR = 1.5;
/** Teclado: velocidade máxima e aceleração (unidades/s e unidades/s²). */
export const PADDLE_KEY_SPEED = 620;
export const PADDLE_KEY_ACCEL = 4200;
/** Até onde o ressalto pode inclinar a bola, a partir da vertical (radianos). */
export const PADDLE_MAX_ANGLE = (62 * Math.PI) / 180;

// ---------- Bola ----------

export const BALL_R = 6;
/** Velocidade da bola no nível 1 e no último (unidades/s). */
export const BALL_SPEED_FIRST = 300;
export const BALL_SPEED_LAST = 445;
/** Cada toque na raquete acelera um pouco, até ao teto. */
export const BALL_SPEEDUP = 1.012;
export const BALL_SPEED_CAP = 1.3;
/** A bola nunca anda quase na horizontal: fica presa a ricochetear de parede em parede. */
export const BALL_MIN_VY = 0.3;
/** Passo máximo da simulação, em unidades: menos do que o raio, para a bola não atravessar nada. */
export const BALL_SUBSTEP = 3;
/** Com a bola na raquete, larga-a sozinha ao fim deste tempo (s). */
export const AUTO_LAUNCH = 5;
export const TRAIL_LENGTH = 8;

// ---------- Vidas, tempos e pontos ----------

export const LIVES = 3;
export const MAX_LIVES = 5;
export const MAX_STARS = 3;
/** Quanto tempo o jogo espera depois de perder uma vida, de acabar o nível ou de ficar sem vidas (s). */
export const LIFE_LOST_HOLD = 1.1;
export const CLEAR_HOLD = 1.6;
export const GAME_OVER_HOLD = 1.4;
/** Quanto tempo se vê o nome do nível no arranque (s). */
export const BANNER_TIME = 2.2;

/** Tempo-alvo de um nível: um fixo e um tanto por golpe que os tijolos pedem (s). */
export const PAR_BASE = 40;
export const PAR_PER_HIT = 1.5;

/** Pontos por tijolo partido, além dos da cor (ver BRICK_KINDS em js/bricks.js). */
export const CHAIN_BONUS = 10;
export const CHAIN_CAP = 10;
/** Bónus de fim de nível. */
export const LIFE_BONUS = 500;
export const TIME_BONUS_PER_SECOND = 25;

// ---------- Cápsulas ----------

/** Probabilidade de um tijolo partido largar uma cápsula. */
export const CAPSULE_CHANCE = 0.13;
export const CAPSULE_MAX = 2;
export const CAPSULE_SPEED = 120;
export const CAPSULE_W = 28;
export const CAPSULE_H = 12;
/** Duração dos poderes com tempo (s). Os da raquete duram até se perder a bola. */
export const SLOW_TIME = 10;
export const SLOW_FACTOR = 0.68;
export const LASER_TIME = 9;
export const LASER_INTERVAL = 0.36;
export const LASER_SPEED = 720;
/** Com a cápsula C, a bola fica colada à raquete no máximo isto (s). */
export const CATCH_HOLD = 2.5;
/** Quantas bolas pode haver de uma vez (cápsula M). */
export const MAX_BALLS = 9;
export const SCORE_CAPSULE = 100;
