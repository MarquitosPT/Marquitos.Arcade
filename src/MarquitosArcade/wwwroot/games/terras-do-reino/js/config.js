// Constantes de afinação do Terras do Reino.
//
// Tudo o que é número de economia vive aqui: custos, receitas, tempos, preços.
// O resto do código só sabe ler estas tabelas — acrescentar um edifício novo é
// acrescentar uma entrada a `BUILDINGS` (e o desenho dele em sprites.js).
//
// Tempos em segundos de jogo. Crescer e produzir leva o seu tempo de
// propósito: um campo de trigo leva mais de dois dias a amadurecer, e cada
// oficina faz uma peça a cada quarto de minuto, mais ou menos — um reino
// constrói-se devagar. O relógio do jogo anda à velocidade escolhida
// (1x, 2x, 3x) e só anda com o jogo aberto: fora dele o reino fica em pausa,
// e ao voltar continua exatamente de onde ficou.

export const GAME_ID = 'terras-do-reino';

/**
 * O que a janela "Acerca" mostra (ver /lib/arcade/about.js). Os autores e o
 * titular do copyright são os da arcada; o ano do © é o da publicação.
 */
export const ABOUT = {
    title: 'Terras do Reino',
    emoji: '🏰',
    tagline: 'Campos · Minas · Mercados',
    version: '0.9.0',
    status: 'Em testes',
    published: '2026-09-24'
};
export const NAME_STORAGE_KEY = 'terrasDoReinoPlayerName_v1';
export const PROGRESS_STORAGE_KEY = 'terrasDoReinoSave_v1';

/** Teto do servidor para uma pontuação (ScoresEndpoints.cs): a prosperidade vai ao quadro limitada a isto. */
export const MAX_BOARD_SCORE = 999999;

/** Etiqueta de quem não deu nome. Nunca é guardada nem enviada ao quadro (ver lib/arcade/scores.js). */
export const PLAYER_FALLBACK = 'Senhor(a) do Reino';

export const FONT_DISPLAY = "'Outfit', 'Segoe UI', system-ui, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// ---------- Mapa ----------

/**
 * Lado do mapa, em casas. Uma casa é a peça mais pequena do tabuleiro: é o
 * que ocupa uma árvore, um rochedo ou um troço de estrada. Os edifícios
 * ocupam 2x2 casas (o castelo 4x4) — assim cabem estradas entre eles.
 */
export const MAP_SIZE = 88;

/**
 * Tamanho de uma casa em píxeis de mundo, com zoom 1. A proporção 2:1 é a da
 * perspetiva isométrica clássica — a do tabuleiro visto de cima e de lado. Um
 * edifício (2x2 casas) ocupa 64x32, a medida para que os desenhos foram feitos.
 */
export const TILE_W = 32;
export const TILE_H = 16;
/** Lado, em casas, de um edifício normal. */
export const BUILDING_SIZE = 2;
/** Quanto sobe uma casa por cada nível de relevo (colinas) ou desce (lagos). */
export const ELEV_PX = 7;
/** Espessura da "placa" de terra que se vê nas bordas do mapa. */
export const SLAB_PX = 26;

export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 2.6;
export const ZOOM_START = 1.25;

// ---------- Tempo ----------

/** Um dia do reino, em segundos de jogo. É ao fim do dia que o povo come. */
export const DAY_SECONDS = 45;

/** Velocidades do relógio que o botão ⏩ percorre. */
export const SPEEDS = [1, 2, 3];

/** Grava de x em x segundos reais enquanto se joga. */
export const AUTOSAVE_SECONDS = 10;

// ---------- Recursos ----------

/**
 * Os bens do reino. `price` é o preço de referência no mercado (o preço do
 * dia varia à volta dele, ver market.js) e também o que o bem vale para a
 * prosperidade. As moedas não são um bem: são a medida de todos.
 */
export const RESOURCES = [
    { id: 'coins', name: 'Moedas', emoji: '💰', price: 1, tradable: false },
    { id: 'wood', name: 'Madeira', emoji: '🪵', price: 3, tradable: true },
    { id: 'stone', name: 'Pedra', emoji: '🪨', price: 4, tradable: true },
    { id: 'wheat', name: 'Trigo', emoji: '🌾', price: 3, tradable: true },
    { id: 'flour', name: 'Farinha', emoji: '🥣', price: 7, tradable: true },
    { id: 'bread', name: 'Pão', emoji: '🍞', price: 10, tradable: true, meals: 2 },
    { id: 'milk', name: 'Leite', emoji: '🥛', price: 5, tradable: true, meals: 1 },
    { id: 'cheese', name: 'Queijo', emoji: '🧀', price: 16, tradable: true, meals: 3 },
    { id: 'fish', name: 'Peixe', emoji: '🐟', price: 8, tradable: true, meals: 2 },
    { id: 'meat', name: 'Carne', emoji: '🍖', price: 11, tradable: true, meals: 2 },
    { id: 'eggs', name: 'Ovos', emoji: '🥚', price: 4, tradable: true, meals: 1 },
    { id: 'planks', name: 'Tábuas', emoji: '🪚', price: 9, tradable: true },
    { id: 'gold', name: 'Ouro', emoji: '✨', price: 30, tradable: true },
    { id: 'wool', name: 'Lã', emoji: '🧶', price: 6, tradable: true },
    { id: 'cloth', name: 'Rolos de tecido', emoji: '🧵', price: 24, tradable: true },
    { id: 'grapes', name: 'Uvas', emoji: '🍇', price: 4, tradable: true },
    { id: 'wine', name: 'Vinho', emoji: '🍷', price: 20, tradable: true },
    { id: 'cotton', name: 'Algodão', emoji: '☁️', price: 5, tradable: true },
    { id: 'suits', name: 'Fatos', emoji: '🧥', price: 55, tradable: true },
    { id: 'dresses', name: 'Vestidos', emoji: '👗', price: 55, tradable: true },
    { id: 'sugarcane', name: 'Cana-de-açúcar', emoji: '🎋', price: 4, tradable: true },
    { id: 'sugar', name: 'Açúcar', emoji: '🍬', price: 14, tradable: true },
    { id: 'rice', name: 'Arroz', emoji: '🍚', price: 7, tradable: true, meals: 2 },
    { id: 'cakes', name: 'Bolos', emoji: '🎂', price: 45, tradable: true, meals: 3 },
    { id: 'jewels', name: 'Joias', emoji: '💍', price: 100, tradable: true }
];

export const RESOURCE = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

/** Por onde o povo come: primeiro o que mais alimenta. */
export const FOODS = ['cakes', 'cheese', 'bread', 'meat', 'rice', 'fish', 'eggs', 'milk'];

export const START_RESOURCES = { coins: 160, wood: 30, stone: 12 };

// ---------- Povo ----------

/** Moradores que o castelo já traz, antes de haver casas. */
export const CASTLE_RESIDENTS = 4;
/** Moedas de imposto por morador a trabalhar e por dia, com o povo 100% contente. */
export const TAX_PER_RESIDENT = 4;
/**
 * Quem não tem trabalho paga só esta parte do imposto. Sem isto, encher o mapa
 * de casas era a melhor maneira de enriquecer — e um reino é feito de
 * oficinas e campos, não só de telhados.
 */
export const IDLE_TAX_SHARE = 0.25;
/**
 * O contentamento vai de `HAPPY_BASE` (ninguém come nada de jeito) a 1 (todos
 * bem alimentados, com variedade, com taberna e teatro para todos e joias ao
 * pescoço). Nunca chega a zero: um reino sem pão é pobre, não é um reino em
 * revolta — isto não é um jogo de guerra.
 *
 * A comida chega aos 90%; os últimos 10% são o convívio e o luxo
 * (`HAPPY_LEISURE`): cada edifício com `serves` (a taberna, o teatro, a
 * joalharia) dá a sua parte, na proporção dos moradores que consegue servir.
 */
export const HAPPY_BASE = 0.4;
export const HAPPY_FED = 0.4;
export const HAPPY_VARIETY = 0.1;
export const HAPPY_LEISURE = { tavern: 0.04, theatre: 0.03, jewelry: 0.03 };

// ---------- Castelo ----------

/**
 * Os níveis do castelo. Cada um alarga o território onde se pode construir,
 * aumenta o armazém e abre um novo escalão de edifícios (`tier`).
 *
 * Os níveis 3, 4 e 5 são a meta de um reino a sério: além do custo (que já pede
 * pão, e depois queijo e ouro — as cadeias de produção todas a andar), `needs`
 * exige um reino grande e bem tratado — `residents` moradores e o povo pelo
 * menos `happy` contente. Não se paga: tem de se ter.
 */
export const CASTLE_LEVELS = [
    null,
    { level: 1, radius: 13, storage: 150, tier: 1, residents: 4 },
    { level: 2, radius: 18, storage: 400, tier: 2, residents: 8, cost: { coins: 250, wood: 60, stone: 40 } },
    {
        level: 3, radius: 23, storage: 1000, tier: 3, residents: 12,
        cost: { coins: 1500, planks: 120, stone: 220, bread: 60 },
        needs: { residents: 40, happy: 0.6 }
    },
    {
        level: 4, radius: 28, storage: 2500, tier: 4, residents: 20,
        cost: { coins: 5000, planks: 250, stone: 450, gold: 80, cheese: 60 },
        needs: { residents: 80, happy: 0.75 }
    },
    {
        // O território já não cresce: logo a seguir começam as terras das vilas vizinhas.
        level: 5, radius: 28, storage: 5000, tier: 5, residents: 30,
        cost: { coins: 12000, planks: 400, stone: 700, gold: 150, wine: 80, cloth: 60 },
        needs: { residents: 120, happy: 0.85 }
    }
];

export const CASTLE_MAX_LEVEL = CASTLE_LEVELS.length - 1;

// ---------- Edifícios ----------

/**
 * `site` diz onde se pode pôr: 'land' é terra livre (relva ou prado), 'ore' é
 * uma colina com uma veia de ouro debaixo. `near` exige vizinhos: um lenhador
 * sem árvores perto não corta nada, uma cabana de pesca sem água não pesca. Os
 * raios contam-se em casas, a partir do centro do edifício; `feature` é um
 * elemento do mapa ('tree', 'rock') ou 'water', que conta as casas de lago.
 *
 * `recipe` é o que o edifício faz a cada ciclo de `time` segundos, com todos
 * os trabalhadores (`workers`). Sem trabalhadores fica parado; sem o que
 * consome, espera.
 *
 * `crop` é uma cultura (trigo, vinha, algodão): semeia-se, cresce `grow`
 * segundos e colhe-se `yield` de `res` — à mão ou pelo celeiro.
 *
 * `serves` é convívio e luxo (taberna, teatro, joalharia): ao fim de cada dia
 * serve até `residents` moradores e deixa-os mais contentes (`HAPPY_LEISURE`).
 * Com `uses`, gasta 1 desse bem por cada `per` moradores servidos (o vinho da
 * taberna, as joias que a joalharia vende ao povo).
 *
 * `lodges` é o hotel: ao fim de cada dia recebe até `guests` visitantes
 * (mais quanto mais contente estiver o povo — um reino feliz tem fama), que
 * comem uma refeição do que sobrar na despensa e pagam `fee` moedas cada um.
 *
 * `service` é um serviço do reino (escola, centro de saúde, correios): serve
 * até `residents` moradores, sempre que tem gente a trabalhar, e dá o seu
 * efeito na proporção do povo servido — `tax` sobe os impostos, `work` põe as
 * oficinas a trabalhar mais depressa, `trade` melhora os preços no mercado.
 */
export const BUILDINGS = [
    {
        id: 'house', name: 'Casa', emoji: '🏠', tier: 1,
        cost: { coins: 15, wood: 10, stone: 4 },
        residents: 4,
        desc: 'Mais quatro moradores: mais mãos para trabalhar e mais impostos.'
    },
    {
        id: 'field', name: 'Campo de trigo', emoji: '🌾', tier: 1,
        cost: { coins: 12 },
        crop: { res: 'wheat', grow: 100, yield: 5 },
        desc: 'Toca para semear e, quando estiver dourado, toca outra vez para colher.'
    },
    {
        id: 'market', name: 'Mercado', emoji: '⚖️', tier: 1, unique: true,
        cost: { coins: 40, wood: 15 },
        desc: 'Abre o comércio com as vilas vizinhas: vende o que sobra, compra o que falta.'
    },
    {
        id: 'woodcutter', name: 'Lenhador', emoji: '🪓', tier: 1,
        cost: { coins: 35 }, workers: 2,
        near: { feature: 'tree', radius: 4.5, min: 2, full: 8 },
        recipe: { out: { wood: 1 }, time: 12 },
        desc: 'Corta madeira nas árvores à volta. Quantas mais árvores perto, mais depressa.'
    },
    {
        id: 'quarry', name: 'Pedreira', emoji: '⛏️', tier: 1,
        cost: { coins: 25, wood: 15 }, workers: 2,
        near: { feature: 'rock', radius: 4.5, min: 2, full: 6 },
        recipe: { out: { stone: 1 }, time: 18 },
        desc: 'Tira pedra das rochas à volta. Tem de ficar perto de rochedos.'
    },
    {
        id: 'forester', name: 'Guarda-florestal', emoji: '🌲', tier: 1,
        cost: { coins: 30, wood: 5 }, workers: 1,
        plants: { radius: 4.5, time: 30 },
        desc: 'Planta árvores nas casas livres à volta, para os lenhadores nunca ficarem sem nada.'
    },
    {
        id: 'mill', name: 'Moinho', emoji: '🌬️', tier: 2,
        cost: { coins: 60, wood: 20, stone: 10 }, workers: 1,
        recipe: { in: { wheat: 2 }, out: { flour: 1 }, time: 15 },
        desc: 'Mói o trigo em farinha.'
    },
    {
        id: 'bakery', name: 'Padaria', emoji: '🍞', tier: 2,
        cost: { coins: 70, wood: 15, stone: 15 }, workers: 2,
        recipe: { in: { flour: 1 }, out: { bread: 2 }, time: 20 },
        desc: 'Coze pão com a farinha do moinho. Pão na mesa é povo contente.'
    },
    {
        id: 'pasture', name: 'Vacaria', emoji: '🐄', tier: 2,
        cost: { coins: 80, wood: 20 }, workers: 1,
        recipe: { in: { wheat: 1 }, out: { milk: 2 }, time: 25 },
        desc: 'Vacas alimentadas a trigo dão leite todos os dias.'
    },
    {
        id: 'carpentry', name: 'Carpintaria', emoji: '🪚', tier: 2,
        cost: { coins: 90, wood: 25, stone: 10 }, workers: 2,
        recipe: { in: { wood: 2 }, out: { planks: 1 }, time: 18 },
        desc: 'A primeira fábrica do reino: transforma madeira em tábuas.'
    },
    {
        id: 'barn', name: 'Celeiro', emoji: '🛖', tier: 2,
        cost: { coins: 60, wood: 30, stone: 10 }, workers: 1,
        farms: { radius: 5, time: 4 },
        desc: 'Os trabalhadores do celeiro semeiam e colhem sozinhos os campos à volta.'
    },
    {
        id: 'dairy', name: 'Leitaria', emoji: '🧀', tier: 3,
        cost: { coins: 150, planks: 15, stone: 20 }, workers: 2,
        recipe: { in: { milk: 2 }, out: { cheese: 1 }, time: 25 },
        desc: 'Faz queijo com o leite da vacaria. Vale ouro nas feiras.'
    },
    {
        id: 'goldmine', name: 'Mina de ouro', emoji: '⛰️', tier: 3,
        cost: { coins: 200, planks: 20, stone: 30 }, workers: 3,
        site: 'ore',
        recipe: { out: { gold: 1 }, time: 35 },
        desc: 'Escava a veia de ouro de uma colina. Só se constrói numa colina com uma veia.'
    },
    {
        // No fim da lista: a gravação guarda o índice do edifício (ver save.js).
        id: 'fishery', name: 'Cabana de pesca', emoji: '🎣', tier: 1,
        cost: { coins: 45, wood: 20 }, workers: 2,
        near: { feature: 'water', radius: 3.5, min: 4, full: 12 },
        recipe: { out: { fish: 1 }, time: 14 },
        desc: 'Os pescadores saem de barco para o lago e pescam à cana. Tem de ficar à beira de água: quanto mais lago perto, mais peixe.'
    },
    {
        id: 'pigsty', name: 'Pocilga', emoji: '🐖', tier: 2,
        cost: { coins: 75, wood: 25 }, workers: 1,
        recipe: { in: { wheat: 1 }, out: { meat: 1 }, time: 22 },
        desc: 'Porcos criados a trigo, no chiqueiro com lama: dão carne para a mesa do povo.'
    },
    {
        id: 'coop', name: 'Galinheiro', emoji: '🐔', tier: 1,
        cost: { coins: 40, wood: 15 }, workers: 1,
        recipe: { in: { wheat: 1 }, out: { eggs: 2 }, time: 20 },
        desc: 'Galinhas a debicar trigo no terreiro: põem ovos todos os dias.'
    },
    {
        id: 'sheepfold', name: 'Curral de ovelhas', emoji: '🐑', tier: 3,
        cost: { coins: 160, planks: 20, wood: 20 }, workers: 2,
        recipe: { in: { wheat: 1 }, out: { wool: 2 }, time: 28 },
        desc: 'Ovelhas alimentadas a trigo: os pastores tosquiam-nas e juntam a lã.'
    },
    {
        id: 'weaving', name: 'Centro de tecelagem', emoji: '🧵', tier: 3,
        cost: { coins: 180, planks: 25, stone: 20 }, workers: 3,
        recipe: { in: { wool: 3 }, out: { cloth: 1 }, time: 30 },
        desc: 'Os teares fiam a lã do curral e tecem-na em rolos de tecido.'
    },
    {
        id: 'vineyard', name: 'Vinha', emoji: '🍇', tier: 3,
        cost: { coins: 30, wood: 8 },
        crop: { res: 'grapes', grow: 140, yield: 6 },
        desc: 'Toca para podar e, quando os cachos estiverem roxos, toca outra vez para vindimar.'
    },
    {
        id: 'distillery', name: 'Destilaria', emoji: '🛢️', tier: 3,
        cost: { coins: 170, planks: 20, stone: 25 }, workers: 2,
        recipe: { in: { grapes: 3 }, out: { wine: 1 }, time: 30 },
        desc: 'Pisa as uvas da vinha e guarda o vinho em pipas de carvalho.'
    },
    {
        id: 'tavern', name: 'Taberna', emoji: '🍺', tier: 3,
        cost: { coins: 200, planks: 30, stone: 30 }, workers: 2,
        serves: { residents: 40, uses: 'wine', per: 10 },
        desc: 'O povo junta-se ao fim do dia para um copo de vinho e dois dedos de conversa. Povo mais contente.'
    },
    {
        id: 'cottonfield', name: 'Campo de algodão', emoji: '🌿', tier: 4,
        cost: { coins: 45, wood: 10 },
        crop: { res: 'cotton', grow: 150, yield: 5 },
        desc: 'Toca para semear e, quando as cápsulas abrirem brancas, toca outra vez para colher.'
    },
    {
        id: 'tailor', name: 'Alfaiataria', emoji: '🪡', tier: 4,
        cost: { coins: 400, planks: 40, stone: 40, cloth: 10 }, workers: 3,
        recipe: { in: { cotton: 2, cloth: 1 }, out: { suits: 1, dresses: 1 }, time: 40 },
        desc: 'Os alfaiates cortam e cosem fatos e vestidos com algodão e os rolos de tecido de lã. Os mais caros das feiras.'
    },
    {
        id: 'theatre', name: 'Teatro', emoji: '🎭', tier: 4,
        cost: { coins: 900, planks: 80, stone: 120, gold: 20 }, workers: 4,
        serves: { residents: 80 },
        desc: 'Comédias e tragédias todas as noites: a cultura do reino. Povo mais contente.'
    },
    {
        id: 'canefield', name: 'Canavial', emoji: '🎋', tier: 5,
        cost: { coins: 70, wood: 15 },
        crop: { res: 'sugarcane', grow: 160, yield: 6 },
        desc: 'Toca para plantar e, quando a cana estiver alta e amarela, toca outra vez para cortar.'
    },
    {
        id: 'sugarmill', name: 'Engenho de açúcar', emoji: '🍬', tier: 5,
        cost: { coins: 500, planks: 50, stone: 60 }, workers: 3,
        recipe: { in: { sugarcane: 3 }, out: { sugar: 1 }, time: 30 },
        desc: 'Mói a cana e ferve a calda até cristalizar em açúcar.'
    },
    {
        id: 'paddy', name: 'Arrozal', emoji: '🍚', tier: 5,
        cost: { coins: 70, wood: 10, stone: 10 },
        near: { feature: 'water', radius: 3.5, min: 2, full: 2 },
        crop: { res: 'rice', grow: 150, yield: 6 },
        desc: 'Um campo alagado à beira de água. Toca para plantar e, quando o arroz amarelar, toca outra vez para colher. É comida.'
    },
    {
        id: 'patisserie', name: 'Pastelaria', emoji: '🧁', tier: 5,
        cost: { coins: 700, planks: 60, stone: 60, sugar: 10 }, workers: 3,
        recipe: { in: { eggs: 2, flour: 1, sugar: 1, milk: 1 }, out: { cakes: 1 }, time: 35 },
        desc: 'Bolos com ovos, farinha, açúcar e leite: o povo adora-os e as feiras pagam-nos a peso de ouro.'
    },
    {
        id: 'inn', name: 'Hotel', emoji: '🛎️', tier: 4,
        cost: { coins: 700, planks: 70, stone: 80 }, workers: 3,
        lodges: { guests: 12, fee: 12 },
        desc: 'Quartos para quem vem visitar o reino. Os visitantes comem do que sobra na despensa e pagam a estadia: quanto mais contente o povo, mais fama tem o reino e mais visitas chegam.'
    },
    {
        id: 'jewelry', name: 'Joalharia', emoji: '💍', tier: 5,
        cost: { coins: 1200, planks: 60, stone: 90, gold: 30 }, workers: 3,
        recipe: { in: { gold: 2 }, out: { jewels: 1 }, time: 30 },
        serves: { residents: 80, uses: 'jewels', per: 40 },
        desc: 'Os ourives transformam o ouro das minas em anéis e colares. As joias valem uma fortuna nas feiras, e o povo que as usa anda mais contente.'
    },
    {
        id: 'school', name: 'Escola', emoji: '🏫', tier: 4,
        cost: { coins: 600, planks: 60, stone: 50 }, workers: 3,
        service: { residents: 80, tax: 0.2 },
        desc: 'Os mestres ensinam o povo a ler, a escrever e a fazer contas. Povo instruído ganha melhor e paga mais impostos.'
    },
    {
        id: 'clinic', name: 'Centro de saúde', emoji: '🏥', tier: 4,
        cost: { coins: 800, planks: 50, stone: 80, cloth: 10 }, workers: 3,
        service: { residents: 80, work: 0.15 },
        desc: 'Médicos e enfermeiros tratam das maleitas do povo. Gente saudável falta menos ao trabalho: as oficinas produzem mais depressa.'
    },
    {
        id: 'post', name: 'Posto de correios', emoji: '📮', tier: 4,
        cost: { coins: 500, planks: 40, stone: 40 }, workers: 2,
        service: { residents: 80, trade: 0.1 },
        desc: 'Os carteiros levam e trazem a correspondência do reino. Com cartas a correr entre o reino e as vilas vizinhas, fazem-se melhores negócios no mercado.'
    }
];

/** Como se fala do efeito de cada serviço (`service`): no guia, na ficha e no painel do castelo. */
export const SERVICE_EFFECTS = {
    tax: { icon: '💰', text: 'de impostos' },
    work: { icon: '⚙️', text: 'de rapidez nas oficinas' },
    trade: { icon: '⚖️', text: 'nos preços do mercado' }
};

export const BUILDING = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/** Como se fala do que um edifício precisa à volta (`near.feature`): no cartão, na ficha e no balão. */
export const NEAR_FEATURES = {
    tree: { icon: '🌲', need: 'Precisa de árvores perto', count: 'árvore(s)' },
    rock: { icon: '🪨', need: 'Precisa de rochas perto', count: 'rocha(s)' },
    water: { icon: '💧', need: 'Tem de ficar à beira de água', count: 'casa(s) de água' }
};

/**
 * Os barcos da cabana de pesca: um por trabalhador. Só se veem — o peixe sai
 * da receita, como nas outras oficinas —, mas vão remando pelo lago até um
 * sítio, pescam à cana um bocado e voltam ao cais.
 */
export const BOAT_SPEED = 0.9;
/** Até onde um barco se afasta do cais, em casas. */
export const BOAT_RANGE = 6;
/** Segundos a pescar em cada sítio (entre um e outro). */
export const BOAT_FISH_MIN = 5;
export const BOAT_FISH_MAX = 11;

/**
 * Aplanar uma colina: os trabalhadores cavam um bocado de 2x2 casas até ao
 * nível do chão e fica terra livre. Das pedras que saem da terra aproveitam-se
 * `FLATTEN_STONE`. As veias de ouro não se aplanam — são o que as colinas têm
 * de melhor.
 */
export const FLATTEN_COST = { coins: 45, wood: 10 };
export const FLATTEN_STONE = 4;

/**
 * Limpar uma casa: cortar uma árvore ou partir um rochedo para deixar terra
 * livre. Paga-se o trabalho e não se aproveita nada — a madeira e a pedra vêm
 * dos lenhadores e das pedreiras, que precisam delas à volta.
 */
export const CLEAR_COST = { tree: { coins: 8 }, rock: { coins: 20 } };

/**
 * Estradas de pedra: um troço por casa. Ligam os edifícios e é por elas que o
 * povo anda de um lado para o outro. Levantar um troço devolve a pedra.
 */
export const ROAD_COST = { coins: 2, stone: 1 };
/** Quantos moradores por cada pessoa que se vê a andar nas estradas. */
export const RESIDENTS_PER_WALKER = 3;
export const MAX_WALKERS = 28;
/** Casas por segundo, a pé. */
export const WALK_SPEED = 1.3;

/** Parte do custo devolvida ao demolir. */
export const DEMOLISH_REFUND = 0.5;

// ---------- Mercado ----------

/** Quanto o preço de compra fica acima do de venda. */
export const BUY_MARKUP = 1.3;
/** O preço do dia fica entre estes dois múltiplos do preço de referência. */
export const PRICE_MIN = 0.45;
export const PRICE_MAX = 1.8;
/** Stock de referência de cada bem nas vilas: com esta quantidade, o preço é o de referência. */
export const MARKET_TARGET = 80;
/** A que ritmo as vilas consomem (ou produzem) até voltarem ao equilíbrio, por segundo. */
export const MARKET_DRIFT = 1 / 90;
/** Uma feira dura dois dias e aparece mais ou menos de três em três. */
export const FAIR_DAYS = 2;
export const FAIR_EVERY_DAYS = 3;

// ---------- Vilas vizinhas (CPU) ----------

/**
 * As vilas vizinhas não fazem guerra: crescem, produzem e comerciam. O que
 * produzem fica mais barato no mercado; o que procuram, mais caro. E crescem
 * sozinhas, o que as torna rivais na tabela da prosperidade.
 */
export const TOWNS = [
    {
        id: 'rosa', name: 'Vila Rosa', roof: '#d8587b', emoji: '🌸',
        supplies: ['wheat', 'milk', 'eggs'], demands: ['wood', 'planks', 'stone', 'wine', 'cakes', 'jewels'],
        kinds: ['house', 'field', 'field', 'pasture', 'house', 'mill']
    },
    {
        id: 'pedralva', name: 'Pedralva', roof: '#5f7fca', emoji: '🪨',
        supplies: ['stone', 'gold'], demands: ['bread', 'cheese', 'wheat', 'fish', 'meat', 'suits'],
        kinds: ['house', 'quarry', 'house', 'carpentry', 'quarry']
    },
    {
        id: 'carvalhal', name: 'Carvalhal', roof: '#c98434', emoji: '🌳',
        supplies: ['wood', 'planks'], demands: ['flour', 'milk', 'bread', 'cloth', 'dresses', 'sugar'],
        kinds: ['house', 'woodcutter', 'house', 'carpentry', 'field']
    }
];

/** Uma vila começa com isto de prosperidade e ganha `TOWN_PROSPERITY_PER_BUILDING` por edifício. */
export const TOWN_BASE_PROSPERITY = 500;
export const TOWN_PROSPERITY_PER_BUILDING = 160;
/**
 * O que cada edifício de uma vila lhe rende por segundo, em prosperidade. Sem
 * isto uma vila parava de subir quando parava de crescer, e ao fim de meia hora
 * deixava de ser rival de ninguém.
 */
export const TOWN_WEALTH_PER_BUILDING = 0.08;
export const TOWN_MAX_BUILDINGS = 34;
/** Segundos entre dois edifícios novos de uma vila; cresce com o tamanho dela. */
export const TOWN_GROWTH_SECONDS = 70;
export const TOWN_GROWTH_PER_BUILDING = 6;
/** Uma caravana leva isto a atravessar o mapa, em segundos. */
export const CARAVAN_SECONDS = 14;
