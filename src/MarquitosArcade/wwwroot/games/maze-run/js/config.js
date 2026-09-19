// Constantes de afinação do Maze Run.
//
// Tudo em unidades de célula: uma célula do labirinto é a unidade de distância e
// as velocidades são células por segundo. O tamanho em píxeis é decidido no
// desenho (render.js), conforme o labirinto e o ecrã — assim o jogo comporta-se
// da mesma maneira num telemóvel e num monitor.

export const GAME_ID = 'maze-run';
export const NAME_STORAGE_KEY = 'mazeRunPlayerName_v1';
export const PROGRESS_STORAGE_KEY = 'mazeRunProgress_v1';

/** Etiqueta de quem não deu nome. Nunca é guardada nem enviada ao quadro (ver lib/arcade/scores.js). */
export const PLAYER_FALLBACK = 'Tu';

/**
 * Tipos de letra do HUD desenhado no canvas — os mesmos do menu (ver css/theme.css),
 * para o jogo não ter uma cara dentro e outra fora do labirinto.
 */
export const FONT_DISPLAY = "'Outfit', 'Segoe UI', system-ui, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// ---------- Movimento ----------

/** Velocidade do jogador, em células por segundo. */
export const PLAYER_SPEED = 5.4;

/**
 * Velocidade base dos guardas. Cada nível multiplica-a pelo seu próprio fator
 * (ver levels.js) — é esse fator, e não este número, que se afina por nível.
 *
 * Fica deliberadamente abaixo da do jogador: um guarda mais rápido do que quem
 * foge transforma qualquer erro numa perda certa, e o jogo passa a ser sobre
 * adivinhar em vez de conduzir.
 */
export const ENEMY_BASE_SPEED = 4.2;

/** Distância (em células) a que um guarda apanha o jogador. */
export const CATCH_RADIUS = 0.62;

/** Distância (em células) a que o jogador apanha um cristal ou chega à saída. */
export const PICKUP_RADIUS = 0.5;

// ---------- Ritmo dos guardas ----------

/**
 * Os guardas alternam entre perseguir e dispersar, como nos jogos de labirinto
 * de sempre. A dispersão é a janela em que se pode respirar e ir buscar o
 * cristal que ficou para trás; sem ela, um labirinto com laços é uma corrida
 * sem fim e o jogador nunca escolhe o caminho, só foge.
 */
export const CHASE_SECONDS = 12;
export const SCATTER_SECONDS = 5;

/** Células à frente do jogador que o guarda "emboscador" toma por alvo. */
export const AMBUSH_LOOKAHEAD = 4;

// ---------- Ritmo do nível ----------

/** Contagem decrescente antes de arrancar o nível. */
export const COUNTDOWN_FROM = 3;

/**
 * Contagem depois de uma vida perdida. Mais curta do que a do arranque de
 * propósito: quem já conhece o nível e acabou de ser apanhado quer voltar ao
 * jogo, não assistir outra vez à mesma contagem.
 */
export const RESPAWN_COUNTDOWN = 1;

/** Tempo parado depois de ser apanhado, antes de toda a gente voltar ao sítio. */
export const CAUGHT_PAUSE = 1.2;

/** Tempo entre chegar à saída e o ecrã de resultados — para se ver o portal fechar-se. */
export const CLEAR_PAUSE = 1.1;

/** Vidas por tentativa, quando o nível não disser outra coisa. */
export const DEFAULT_LIVES = 3;

// ---------- Pontuação ----------

export const CRYSTAL_POINTS = 100;
/** Pontos por cada segundo que sobra no relógio. */
export const TIME_POINTS = 10;
/** Pontos por cada vida que ficou por gastar. */
export const LIFE_POINTS = 250;
/** Pontos de base por concluir o nível, multiplicados pelo número do nível. */
export const LEVEL_POINTS = 250;

/**
 * As três estrelas de um nível:
 *   1 — concluído;
 *   2 — concluído dentro do tempo-alvo do nível (`par`);
 *   3 — concluído sem perder uma única vida.
 * São condições e não escalões de pontuação de propósito: quem vê o cartão
 * percebe logo o que lhe falta fazer.
 */
export const MAX_STARS = 3;
