// Constantes de afinação do Pixel Racing.
//
// Tudo em unidades do mundo (px/segundo, radianos/segundo) e independente do
// tamanho do ecrã: a câmara é que aproxima ou afasta. Assim o carro comporta-se
// da mesma maneira num telemóvel e num monitor.

export const GAME_ID = 'pixel-racing';
export const NAME_STORAGE_KEY = 'pixelRacingPlayerName_v1';

export const PLAYER_COLOR = '#00e5ff';

/**
 * Tipos de letra do HUD desenhado no canvas — os mesmos do menu (ver css/theme.css),
 * para o jogo não ter uma cara dentro e outra fora da corrida. Se as fontes do
 * Google não carregarem, o canvas cai na alternativa do sistema como o CSS.
 */
export const FONT_DISPLAY = "'Outfit', 'Segoe UI', system-ui, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

export const CPU_COLORS = ['#ff6a1a', '#ff2fa0', '#7cff2f'];
export const CPU_NAMES = ['Raio', 'Fúria', 'Trovão', 'Faísca', 'Nitro', 'Sombra', 'Foguete', 'Turbo', 'Relâmpago', 'Cobra', 'Ciclone', 'Fantasma'];

export const MODE_QUICK = 'quick';
export const MODE_TOURNAMENT = 'tournament';
/** Pistas do torneio, pela ordem em que se correm. */
export const TOURNAMENT_TRACKS = [0, 1, 2];

export const LAPS_REQUIRED = 3;
export const CAR_LEN = 30, CAR_W = 16, CAR_RADIUS = 14;
export const MAX_SPEED = 380;
export const BOOST_MULT = 1.5;
export const ACCEL = 320;
export const BRAKE_DECEL = 460;
export const OFFTRACK_DAMP = 0.5;
export const GRIP_NORMAL = 9, GRIP_DRIFT = 3.0;
export const TURN_RATE = 2.8;
export const DRIFT_TURN_MULT = 1.3;
export const DRIFT_MIN_SPEED = 80;
export const BOOST_DRAIN = 42, BOOST_REGEN = 7;
export const DRIFT_CHARGE_RATE = 60, DRIFT_TO_BOOST = 0.7, DRIFT_PERFECT = 60;
export const CAM_FOLLOW = 6;
export const ZOOM = 0.62;
export const RACE_POINTS = [30, 20, 12, 6];
