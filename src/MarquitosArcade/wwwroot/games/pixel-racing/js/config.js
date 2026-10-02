// Constantes de afinação do Pixel Racing.
//
// Tudo em unidades do mundo (px/segundo, radianos/segundo) e independente do
// tamanho do ecrã: a câmara é que aproxima ou afasta. Assim o carro comporta-se
// da mesma maneira num telemóvel e num monitor.

export const GAME_ID = 'pixel-racing';

/**
 * O que a janela "Acerca" mostra (ver /lib/arcade/about.js). Os autores e o
 * titular do copyright são os da arcada; o ano do © é o da publicação.
 */
export const ABOUT = {
    title: 'Pixel Racing',
    emoji: '🏎️',
    tagline: 'Boost · Drift · Campeonato',
    version: '1.0.0',
    published: '2026-09-12'
};
export const NAME_STORAGE_KEY = 'pixelRacingPlayerName_v1';
export const COLOR_STORAGE_KEY = 'pixelRacingPlayerColor_v1';
export const CAR_TYPE_STORAGE_KEY = 'pixelRacingCarType_v1';

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
 * Os tipos de carro, do mais lento ao mais rápido — é por esta ordem que a
 * garagem os mostra. Cada corrida é de um tipo só: os adversários correm com o
 * mesmo carro que o jogador escolheu, portanto escolher o carro é escolher a
 * categoria da corrida (e, no modo campeonato, qual dos campeonatos se corre:
 * `championship` é o nome que os resultados lhe dão). Dentro de cada tipo, cada um troca uma coisa por
 * outra — nenhum é melhor em tudo. Os números de `stats` são
 * multiplicadores das constantes de afinação lá de baixo (1 = como o carro de
 * sempre), e ficam perto de 1 de propósito: mudam a maneira de correr, não
 * decidem a corrida.
 *
 * - `top`: velocidade máxima (MAX_SPEED).
 * - `accel`: aceleração (ACCEL).
 * - `turn`: rapidez a virar (TURN_RATE).
 * - `grip`: aderência, a normal e a do drift (GRIP_NORMAL, GRIP_DRIFT).
 * - `offroad`: velocidade que aguenta fora do alcatrão (OFFROAD_SPEED).
 * - `drift`: rapidez a carregar o boost em drift (DRIFT_CHARGE_RATE).
 *
 * `rating` é o que o cartão da garagem mostra, de 1 a 5. Escreve-se à mão
 * para as barras dizerem o que se sente ao volante; quem mexer em `stats` tem
 * de olhar para elas também.
 */
export const CAR_TYPES = [
    {
        id: 'kart', championship: 'Campeonato de Karts', name: 'Kart', blurb: 'Arranca e vira como nenhum outro, mas a reta acaba-lhe cedo.',
        stats: { top: 0.92, accel: 1.25, turn: 1.15, grip: 1.1, offroad: 0.9, drift: 1.0 },
        rating: { speed: 2, accel: 5, handling: 5, offroad: 2 }
    },
    {
        id: 'jeep', championship: 'Campeonato de Jeeps', name: 'Jeep', blurb: 'Robusto: anda na terra quase tão bem como no alcatrão.',
        stats: { top: 0.96, accel: 0.95, turn: 0.95, grip: 0.95, offroad: 1.5, drift: 1.0 },
        rating: { speed: 3, accel: 2, handling: 3, offroad: 3 }
    },
    {
        id: 'gt', championship: 'Campeonato GT', name: '911 GT', blurb: 'Equilibrado, e o rei do drift: carrega o boost num instante.',
        stats: { top: 1.0, accel: 1.03, turn: 1.0, grip: 0.95, offroad: 1.0, drift: 1.3 },
        rating: { speed: 4, accel: 3, handling: 4, offroad: 2 }
    },
    {
        id: 'f1', championship: 'Campeonato de Fórmula 1', name: 'Fórmula 1', blurb: 'O mais rápido em reta. Fora do alcatrão, atola-se.',
        stats: { top: 1.07, accel: 1.0, turn: 0.95, grip: 1.1, offroad: 0.7, drift: 0.9 },
        rating: { speed: 5, accel: 3, handling: 3, offroad: 1 }
    }
];

/** Tipo de carro por omissão do jogador, enquanto não escolher outro. */
export const PLAYER_CAR_TYPE = 'f1';

export function carType(id) {
    return CAR_TYPES.find((type) => type.id === id) || CAR_TYPES.find((type) => type.id === PLAYER_CAR_TYPE);
}

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
/**
 * A escapatória: a faixa de terreno para lá do alcatrão onde ainda se pode
 * andar. Sair da pista deixou de ser bater numa parede invisível — passa a ser
 * atolar-se: a velocidade cai para `OFFROAD_SPEED` da máxima, mas cai com o
 * travão de `OFFROAD_DECEL` e não de repente, para se sentir o carro a enterrar.
 * Ao fim da escapatória há mesmo barreira (pneus, pedras, rails), e é aí que
 * `OFFTRACK_DAMP` entra.
 */
export const RUNOFF = 70;
export const OFFROAD_SPEED = 0.25;
export const OFFROAD_DECEL = 700;
/** Espaçamento das barreiras ao longo do limite da escapatória. */
export const BARRIER_SPACING = 88;

/**
 * Quanto da velocidade sobra depois de raspar na barreira do fim da escapatória. Um embate custa tempo
 * por atirar o carro para fora da trajetória, e não por lhe matar a velocidade:
 * ficar quase parado a cada toque castigava duas vezes a mesma asneira.
 */
export const OFFTRACK_DAMP = 0.82;
/**
 * Quanto é que o embate na barreira alinha o nariz do carro com ela. A 1 o
 * carro perdia por completo a direção que o jogador lhe estava a dar; a meio
 * caminho, raspa na berma e continua a apontar mais ou menos para onde queria.
 */
export const WALL_STEER_BLEND = 0.5;
/** Quanto da velocidade sobra a cada frame de encontrão com outro carro. */
export const BUMP_DAMP = 0.975;
export const GRIP_NORMAL = 9, GRIP_DRIFT = 3.0;
export const TURN_RATE = 2.8;
export const DRIFT_TURN_MULT = 1.3;
export const DRIFT_MIN_SPEED = 80;
export const BOOST_DRAIN = 42, BOOST_REGEN = 7;
export const DRIFT_CHARGE_RATE = 60, DRIFT_TO_BOOST = 0.7, DRIFT_PERFECT = 60;
/**
 * Poças de óleo: o contrário dos postos de turbo. Quem lhes passa por cima fica
 * sem aderência e com o carro a rodar para um dos lados, sorteado à entrada —
 * `OIL_SPIN` é a rotação no instante em que se entra, e vai-se desvanecendo até
 * `OIL_TIME` acabar. Ficam encostadas a um dos lados da pista, para serem um
 * obstáculo a contornar e não uma armadilha inevitável.
 */
export const OIL_RADIUS = 46;
/**
 * Rampas: quem lhes passa por cima com velocidade salta. No ar o carro segue a
 * direito, na direção com que entrou na rampa — o volante só lhe roda o nariz,
 * e é com esse nariz que aterra. O tempo de voo cresce com a velocidade, entre
 * `RAMP_AIR_MIN` e `RAMP_AIR_MAX` segundos; abaixo de `RAMP_MIN_SPEED` passa-se
 * por cima sem levantar.
 *
 * `AIR_SCALE` é quanto o carro cresce no ponto mais alto do salto (visto de
 * cima, subir é ficar maior), e `LAND_TIME` o tempo dos saltinhos da
 * suspensão depois de aterrar. Aterrar com o carro torto (mais de
 * `LAND_MISALIGN` radianos entre o nariz e a direção do voo) custa
 * `LAND_PENALTY` da velocidade.
 */
export const RAMP_MIN_SPEED = 140;
export const RAMP_AIR_MIN = 0.35, RAMP_AIR_MAX = 0.8;
export const AIR_SCALE = 0.5;
export const LAND_TIME = 0.5;
export const LAND_MISALIGN = 0.5, LAND_PENALTY = 0.82;
export const OIL_TIME = 1.0;
export const OIL_SPIN = 2.0;
export const GRIP_OIL = 1.2;

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
