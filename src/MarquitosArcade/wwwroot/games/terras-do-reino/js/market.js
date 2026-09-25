// O mercado: o que as vilas vizinhas pagam e cobram por cada bem.
//
// Cada bem tem um "stock" nas vilas. Com o stock no ponto de referência
// (`MARKET_TARGET`) o preço é o de referência; com pouco, sobe; com muito,
// desce. Vender enche o stock (e baixa o preço), comprar esvazia-o — por isso
// despejar cem trigos de uma vez rende menos do que vender aos poucos.
//
// Com o tempo o stock volta ao seu equilíbrio, que depende das vilas: o que
// elas produzem acumula-se (fica barato), o que procuram escasseia (fica
// caro). As feiras fazem de um bem, durante dois dias, o mais procurado.

import {
    BUY_MARKUP, FAIR_DAYS, FAIR_EVERY_DAYS, MARKET_DRIFT, MARKET_TARGET,
    PRICE_MAX, PRICE_MIN, RESOURCE, RESOURCES, TOWNS
} from './config.js';
import { game } from './state.js';

export const TRADABLE = RESOURCES.filter((r) => r.tradable).map((r) => r.id);

/** O stock para onde cada bem tende, conforme as vilas e a feira do momento. */
export function equilibrium(good) {
    let factor = 1;
    game.towns.forEach((town, k) => {
        const def = TOWNS[k];
        const weight = 0.5 + town.n / 24;
        if (def.supplies.includes(good)) factor += 0.45 * weight;
        if (def.demands.includes(good)) factor -= 0.3 * weight;
    });
    if (game.market.fair?.good === good) factor *= 0.3;
    return MARKET_TARGET * Math.max(0.15, factor);
}

function multiplierFor(stock) {
    const r = Math.max(0, stock) / MARKET_TARGET;
    return Math.min(PRICE_MAX, Math.max(PRICE_MIN, 1 / (0.35 + 0.65 * r)));
}

/** O que os correios fazem aos preços: com cartas a correr, vende-se mais caro e compra-se mais barato. */
const tradeBoost = () => game.derived.boost?.trade || 0;

/** Preço de venda de uma unidade, com o stock atual. */
export function sellPrice(good, stock = game.market.stock[good]) {
    return RESOURCE[good].price * multiplierFor(stock) * (1 + tradeBoost());
}

export function buyPrice(good, stock = game.market.stock[good]) {
    return RESOURCE[good].price * multiplierFor(stock) * BUY_MARKUP * (1 - tradeBoost());
}

/** Tendência do preço face ao de referência: -1 barato, 0 normal, 1 caro. */
export function priceTrend(good) {
    const m = multiplierFor(game.market.stock[good]);
    return m > 1.12 ? 1 : m < 0.88 ? -1 : 0;
}

export function initMarket() {
    game.market.stock = {};
    for (const good of TRADABLE) game.market.stock[good] = equilibrium(good);
    game.market.fair = null;
    game.market.nextFairDay = 3;
}

/**
 * Quanto se recebe por vender `amount` unidades agora. O preço vai caindo à
 * medida que se vende, por isso conta-se pelo preço a meio do caminho.
 */
export function quoteSell(good, amount) {
    const stock = game.market.stock[good];
    return amount * sellPrice(good, stock + amount / 2);
}

export function quoteBuy(good, amount) {
    const stock = game.market.stock[good];
    return amount * buyPrice(good, Math.max(0, stock - amount / 2));
}

/** Vende e devolve as moedas recebidas (0 se não havia nada para vender). */
export function sell(good, amount) {
    const n = Math.min(Math.floor(amount), Math.floor(game.res[good]));
    if (n <= 0) return 0;
    const coins = quoteSell(good, n);
    game.res[good] -= n;
    game.res.coins += coins;
    game.market.stock[good] += n;
    game.stats.sold += n;
    game.stats.earned += coins;
    creditTowns(good, coins);
    return coins;
}

/** Compra e devolve o número de unidades compradas. */
export function buy(good, amount, storage) {
    let n = Math.min(Math.floor(amount), Math.floor(storage - game.res[good]));
    while (n > 0 && quoteBuy(good, n) > game.res.coins) n--;
    if (n <= 0) return 0;
    const coins = quoteBuy(good, n);
    game.res.coins -= coins;
    game.res[good] += n;
    game.market.stock[good] = Math.max(0, game.market.stock[good] - n);
    game.stats.bought += n;
    creditTowns(good, coins);
    return n;
}

/** O comércio com o jogador também faz as vilas prosperar: vai para quem procura (ou produz) o bem. */
function creditTowns(good, coins) {
    const partner = townFor(good);
    if (partner >= 0) game.towns[partner].trade += coins;
}

/** A vila que mais se interessa por este bem: quem o procura, senão quem o faz, senão a primeira. */
export function townFor(good) {
    const demand = TOWNS.findIndex((t) => t.demands.includes(good));
    if (demand >= 0) return demand;
    const supply = TOWNS.findIndex((t) => t.supplies.includes(good));
    return supply >= 0 ? supply : 0;
}

/** O stock volta devagar ao equilíbrio — as vilas consomem e produzem. */
export function driftMarket(dt) {
    const k = Math.min(1, MARKET_DRIFT * dt);
    for (const good of TRADABLE) {
        const stock = game.market.stock[good];
        game.market.stock[good] = stock + (equilibrium(good) - stock) * k;
    }
}

/**
 * Ao virar o dia: acaba a feira que já passou e, de tempos a tempos, abre uma
 * nova numa das vilas, sobre um dos bens que ela procura.
 * @returns {object|null} A feira que acabou de abrir, para o jogo a anunciar.
 */
export function marketNewDay(random = Math.random) {
    const market = game.market;
    if (market.fair && game.day > market.fair.until) market.fair = null;
    if (market.fair || game.day < market.nextFairDay) return null;

    const town = Math.floor(random() * TOWNS.length);
    const wants = TOWNS[town].demands;
    const good = wants[Math.floor(random() * wants.length)];
    market.fair = { good, town, until: game.day + FAIR_DAYS - 1 };
    market.nextFairDay = game.day + FAIR_DAYS + FAIR_EVERY_DAYS;
    return market.fair;
}
