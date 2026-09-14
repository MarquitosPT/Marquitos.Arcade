// Constantes de afinação do Pixel Racing.
//
// Tudo em unidades do mundo (px/segundo, radianos/segundo) e independente do
// tamanho do ecrã: a câmara é que aproxima ou afasta. Assim o carro comporta-se
// da mesma maneira num telemóvel e num monitor.

export const GAME_ID = 'pixel-racing';
export const NAME_STORAGE_KEY = 'pixelRacingPlayerName_v1';
export const COLOR_STORAGE_KEY = 'pixelRacingPlayerColor_v1';

/**
 * Paleta do jogo. O jogador escolhe a sua cor no ecrã de preparação e os
 * adversários ficam com três das restantes — daí ser uma paleta só, e não uma
 * lista para o jogador e outra para os CPU: assim nunca há dois carros da mesma
 * cor na pista, que é o que faz falta para se perceber quem é quem de relance.
 */
export const CAR_COLORS = [
    { name: 'Ciano', value: '#00e5ff' },
    { name: 'Lima', value: '#7cff2f' },
    { name: 'Laranja', value: '#ff6a1a' },
    { name: 'Rosa', value: '#ff2fa0' },
    { name: 'Violeta', value: '#a07cff' },
    { name: 'Dourado', value: '#ffc14d' },
    { name: 'Vermelho', value: '#ff4d4d' },
    { name: 'Branco', value: '#f2f6ff' }
];

/** Cor por omissão do carro do jogador, enquanto não escolher outra. */
export const PLAYER_COLOR = CAR_COLORS[0].value;

/**
 * Tipos de letra do HUD desenhado no canvas — os mesmos do menu (ver css/theme.css),
 * para o jogo não ter uma cara dentro e outra fora da corrida. Se as fontes do
 * Google não carregarem, o canvas cai na alternativa do sistema como o CSS.
 */
export const FONT_DISPLAY = "'Outfit', 'Segoe UI', system-ui, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

export const CPU_NAMES = ['Raio', 'Fúria', 'Trovão', 'Faísca', 'Nitro', 'Sombra', 'Foguete', 'Turbo', 'Relâmpago', 'Cobra', 'Ciclone', 'Fantasma'];

export const MODE_QUICK = 'quick';
export const MODE_TOURNAMENT = 'tournament';
/** Pistas do torneio, pela ordem em que se correm. */
export const TOURNAMENT_TRACKS = [0, 1, 2];

export const LAPS_REQUIRED = 3;
/**
 * Tamanho do carro em unidades do mundo. `CAR_RADIUS` é o raio usado nas
 * colisões (com as paredes e entre carros) e anda de mãos dadas com os outros
 * dois: mexer no comprimento sem mexer no raio dá carros que se encostam sem se
 * tocarem, ou que embatem no ar.
 */
export const CAR_LEN = 57, CAR_W = 30, CAR_RADIUS = 26;
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
/**
 * Aproximação da câmara. Quanto maior, mais perto da ação e menos pista à vista.
 *
 * Em ecrãs estreitos afasta-se: o telemóvel tem menos pixels, e com a mesma
 * aproximação do monitor via-se um pedaço de pista pequeno de mais para
 * antecipar as curvas. O limiar é o mesmo que o HUD usa para encolher.
 */
export const ZOOM = 0.7;
export const ZOOM_NARROW = 0.6;
/**
 * Até onde o fundo do menu se pode afastar para mostrar a pista toda. Abaixo
 * disto a pista ficava um risco no meio do ecrã, e num telemóvel ao alto vale
 * mais ver bem um pedaço do que mal o traçado inteiro.
 */
export const MENU_ZOOM_MIN = 0.3;
export const NARROW_WIDTH = 520;
export const RACE_POINTS = [30, 20, 12, 6];
