// Constantes de afinação dos Gulosinhos.
//
// Tudo em unidades de tile: um tile é a unidade de distância e as velocidades
// são tiles por segundo. O tamanho em píxeis é decidido no desenho (camera.js),
// conforme o ecrã — assim o salto tem o mesmo alcance num telemóvel e num
// monitor, e os níveis gerados (world.js) podem contar com ele.

export const GAME_ID = 'gulosinhos';

/**
 * O que a janela "Acerca" mostra (ver /lib/arcade/about.js). Os autores e o
 * titular do copyright são os da arcada; o ano do © é o da publicação.
 */
export const ABOUT = {
    title: 'Gulosinhos',
    emoji: '🍭',
    tagline: 'Plataformas · Guloseimas · Corrida',
    version: '1.0.0',
    published: '2026-10-10'
};
export const NAME_STORAGE_KEY = 'gulosinhosPlayerName_v1';
export const PROGRESS_STORAGE_KEY = 'gulosinhosProgress_v1';
export const ANIMAL_STORAGE_KEY = 'gulosinhosAnimal_v1';
export const MUSIC_STORAGE_KEY = 'gulosinhosMusic_v1';

/** Etiqueta de quem não deu nome. Nunca é guardada nem enviada ao quadro (ver lib/arcade/scores.js). */
export const PLAYER_FALLBACK = 'Tu';

/** Tipos de letra do HUD desenhado no canvas — os mesmos do menu (ver css/theme.css). */
export const FONT_DISPLAY = "'Fredoka', 'Outfit', 'Segoe UI', system-ui, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// ---------- O mundo ----------

/** Altura de todos os níveis, em tiles. A largura sai do gerador (world.js). */
export const ROWS = 16;

/**
 * Quantos tiles se querem ver na vertical e, no mínimo, na horizontal. O
 * tamanho de um tile é o maior que respeita os dois (ver camera.js): ao alto
 * manda a largura, ao comprido manda a altura.
 */
export const VIEW_ROWS = 11.5;
export const VIEW_MIN_COLS = 11;
export const TILE_MIN = 22;
export const TILE_MAX = 56;

// ---------- O jogador ----------

/**
 * A física do salto. Com estes números o salto mais alto sobe ~2,8 tiles e,
 * a correr, vai ~4,8 tiles mais longe — é daí que saem os limites do gerador
 * (`MAX_STEP_UP` e `MAX_GAP`), com folga para quem não salta no último píxel.
 */
export const GRAVITY = 56;
export const JUMP_SPEED = 17.6;
/** Largar o botão a subir corta a velocidade: o salto curto é o salto de precisão. */
export const JUMP_CUT = 0.45;
export const MAX_FALL = 19;
export const RUN_SPEED = 7.6;
export const GROUND_ACCEL = 60;
export const AIR_ACCEL = 38;
export const GROUND_FRICTION = 70;

/**
 * As duas tolerâncias de quem salta: uns instantes depois de sair da borda
 * ainda dá para saltar (coyote), e um salto pedido um pouco antes de aterrar
 * fica guardado (buffer). Sem elas, o jogo parece que "come" saltos.
 */
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.13;

/** Caixa de colisão do bicho. A cabeça desenhada é maior: o que conta é o corpo. */
export const PLAYER_W = 0.7;
export const PLAYER_H = 0.9;

/** A mola atira ~6 tiles para cima: o dobro de um salto. */
export const SPRING_SPEED = 26;
/** Ressalto depois de saltar em cima de um guardião; com o botão carregado vai mais alto. */
export const STOMP_BOUNCE = 12;
export const STOMP_BOUNCE_HELD = 17;

// ---------- Vidas ----------

/** Corações por tentativa. */
export const HEARTS = 3;
/** Depois de uma pancada o bicho pisca e fica intocável por uns instantes. */
export const INVULNERABLE_SECONDS = 1.4;
/** Pausa entre cair num buraco e reaparecer na última bandeira. */
export const FALL_PAUSE = 0.8;

// ---------- Desafios ----------

/** Distância (em tiles) a que uma bomba-relógio começa a contar. */
export const BOMB_TRIGGER = 2.4;
/** Quanto tempo a bomba conta antes de rebentar. */
export const BOMB_FUSE = 2.4;
/** Raio da explosão: quem estiver lá dentro perde um coração. */
export const BOMB_RADIUS = 2.1;

/** O ciclo da planta carnívora: escondida, a sair, de boca aberta, a recolher. */
export const PLANT_HIDDEN = 1.2;
export const PLANT_RISE = 0.35;
export const PLANT_UP = 1.15;
export const PLANT_FALL = 0.35;

/** Uma plataforma que se desfaz: treme, cai e volta passado um bocado. */
export const CRUMBLE_DELAY = 0.45;
export const CRUMBLE_RESPAWN = 2.6;

// ---------- Ritmo do nível ----------

/** Contagem decrescente antes de arrancar o nível. */
export const COUNTDOWN_FROM = 3;
/** Tempo entre chegar à meta e o ecrã de resultados — para se ver a festa. */
export const CLEAR_PAUSE = 1.6;
/** Tempo entre perder o último coração e o ecrã de resultados. */
export const FAIL_PAUSE = 1.3;

// ---------- Pontuação ----------

export const CANDY_POINTS = 50;
/** A guloseima grande, guardada atrás de um desafio (caixotes, molas, plataformas altas). */
export const BIG_CANDY_POINTS = 250;
export const STOMP_POINTS = 100;
/** Pontos por cada coração que ficou por gastar. */
export const HEART_POINTS = 300;
/** Pontos por cada segundo abaixo do tempo-alvo. */
export const TIME_POINTS = 30;
/** Pontos de base por concluir o nível, multiplicados pelo número do nível. */
export const LEVEL_POINTS = 250;

/**
 * As três estrelas de um nível:
 *   1 — chegar à meta;
 *   2 — com todas as guloseimas;
 *   3 — dentro do tempo-alvo.
 * São condições e não escalões de pontuação de propósito: quem vê o cartão
 * percebe logo o que lhe falta fazer.
 */
export const MAX_STARS = 3;
