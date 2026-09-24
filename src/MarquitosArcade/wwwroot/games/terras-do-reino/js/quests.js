// Objetivos: o fio que ensina o jogo sem tutorial.
//
// São uma lista por ordem — um de cada vez, cada um com a sua recompensa —,
// que leva de uma casa e um campo até ao castelo no nível máximo. Depois da
// lista, o jogo continua sem fim: os objetivos passam a ser marcos de
// prosperidade, cada um o dobro do anterior.

import { CASTLE_MAX_LEVEL } from './config.js';
import { countOf } from './buildings.js';
import { game } from './state.js';
import { townProsperity } from './towns.js';

const built = (kind, n = 1) => () => countOf(kind) >= n;

export const QUESTS = [
    { text: 'Constrói uma casa', hint: 'Toca em 🔨 Construir e escolhe a Casa.', done: built('house'), reward: { coins: 40 } },
    { text: 'Lavra um campo de trigo', hint: 'Depois de construído, toca no campo para semear.', done: built('field'), reward: { coins: 20 } },
    { text: 'Colhe 10 de trigo', hint: 'Quando o campo estiver dourado, toca-lhe para colher.', done: () => game.stats.harvested >= 10, reward: { coins: 30 } },
    { text: 'Constrói o mercado', hint: 'Sem mercado não há comércio com as vilas vizinhas.', done: built('market'), reward: { wood: 15 } },
    { text: 'Vende 10 bens no mercado', hint: 'Toca em ⚖️ Mercado. O preço desce quando se vende muito de uma vez.', done: () => game.stats.sold >= 10, reward: { coins: 40 } },
    { text: 'Constrói um lenhador perto de árvores', hint: 'Quantas mais árvores à volta, mais depressa corta.', done: built('woodcutter'), reward: { coins: 30 } },
    { text: 'Constrói uma pedreira perto de rochas', hint: 'As rochas cinzentas dão pedra para o castelo.', done: built('quarry'), reward: { coins: 30 } },
    { text: 'Tem 16 moradores', hint: 'Cada casa traz quatro. Mais gente, mais trabalho e mais impostos.', done: () => game.derived.residents >= 16, reward: { coins: 60 } },
    { text: 'Sobe o castelo ao nível 2', hint: 'Toca em 🏰 Castelo. Alarga o território e abre novos edifícios.', done: () => game.castleLevel >= 2, reward: { coins: 100 } },
    { text: 'Constrói um moinho e uma padaria', hint: 'Trigo → farinha → pão. Pão na mesa é povo contente.', done: () => countOf('mill') >= 1 && countOf('bakery') >= 1, reward: { wheat: 30 } },
    { text: 'Constrói uma vacaria', hint: 'As vacas comem trigo e dão leite.', done: built('pasture'), reward: { coins: 80 } },
    { text: 'Constrói uma carpintaria', hint: 'Tábuas para os edifícios grandes.', done: built('carpentry'), reward: { wood: 40 } },
    { text: 'Constrói um celeiro junto aos campos', hint: 'O celeiro semeia e colhe sozinho à volta dele.', done: built('barn'), reward: { coins: 120 } },
    { text: 'Deixa o povo 80% contente', hint: 'Pão, leite e queijo: comida que chegue, e variada.', done: () => game.happy >= 0.8, reward: { coins: 150 } },
    { text: 'Sobe o castelo ao nível 3', hint: 'As tábuas vêm da carpintaria.', done: () => game.castleLevel >= 3, reward: { coins: 250 } },
    { text: 'Constrói uma leitaria', hint: 'Leite → queijo, o bem mais caro das feiras.', done: built('dairy'), reward: { coins: 200 } },
    { text: 'Abre uma mina de ouro', hint: 'Procura as veias douradas nas colinas.', done: built('goldmine'), reward: { planks: 20 } },
    { text: 'Ultrapassa as três vilas vizinhas', hint: 'Toca em 👑 Reinos para ver a tabela.', done: () => game.derived.prosperity > Math.max(...game.towns.map((_, k) => townProsperity(k))), reward: { coins: 400 } },
    { text: `Sobe o castelo ao nível ${CASTLE_MAX_LEVEL}`, hint: 'O ouro das minas é o que falta.', done: () => game.castleLevel >= CASTLE_MAX_LEVEL, reward: { coins: 1000 } }
];

/** Depois da lista: marcos de prosperidade, cada um o dobro do anterior. */
function milestone(index) {
    const target = 10000 * 2 ** (index - QUESTS.length);
    return {
        text: `Chega a ${target.toLocaleString('pt-PT')} de prosperidade`,
        hint: 'O reino não tem fim: continua a crescer.',
        done: () => game.derived.prosperity >= target,
        reward: { coins: Math.round(target / 20) },
        target
    };
}

export function currentQuest() {
    const i = game.questIndex;
    return i < QUESTS.length ? QUESTS[i] : milestone(i);
}

/**
 * Se o objetivo do momento está cumprido, dá a recompensa e passa ao seguinte.
 * @returns {object|null} O objetivo cumprido (para o jogo o anunciar).
 */
export function checkQuest(addResource) {
    const quest = currentQuest();
    if (!quest.done()) return null;
    for (const [res, amount] of Object.entries(quest.reward)) addResource(res, amount);
    game.questIndex++;
    return quest;
}
