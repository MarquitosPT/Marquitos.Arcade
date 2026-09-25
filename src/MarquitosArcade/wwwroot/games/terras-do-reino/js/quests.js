// Objetivos: o fio que ensina o jogo sem tutorial.
//
// São uma lista por ordem — um de cada vez, cada um com a sua recompensa —,
// que leva de uma casa e um campo até ao castelo no nível máximo — e à joalharia. Depois da
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
    { text: 'Constrói uma cabana de pesca à beira de um lago', hint: 'Os pescadores saem de barco e pescam à cana. Peixe é comida para o povo.', done: built('fishery'), reward: { coins: 40 } },
    { text: 'Constrói um galinheiro', hint: 'As galinhas comem trigo e põem ovos: com o peixe, a mesa já tem variedade.', done: built('coop'), reward: { coins: 40 } },
    { text: 'Tem 16 moradores', hint: 'Cada casa traz quatro. Mais gente, mais trabalho e mais impostos.', done: () => game.derived.residents >= 16, reward: { coins: 60 } },
    { text: 'Sobe o castelo ao nível 2', hint: 'Toca em 🏰 Castelo. Alarga o território e abre novos edifícios.', done: () => game.castleLevel >= 2, reward: { coins: 100 } },
    { text: 'Constrói um moinho e uma padaria', hint: 'Trigo → farinha → pão. Pão na mesa é povo contente.', done: () => countOf('mill') >= 1 && countOf('bakery') >= 1, reward: { wheat: 30 } },
    { text: 'Constrói uma vacaria', hint: 'As vacas comem trigo e dão leite.', done: built('pasture'), reward: { coins: 80 } },
    { text: 'Constrói uma pocilga', hint: 'Os porcos comem trigo e dão carne: mais uma comida na mesa do povo.', done: built('pigsty'), reward: { coins: 80 } },
    { text: 'Constrói uma carpintaria', hint: 'Tábuas para os edifícios grandes.', done: built('carpentry'), reward: { wood: 40 } },
    { text: 'Constrói um celeiro junto aos campos', hint: 'O celeiro semeia e colhe sozinho à volta dele.', done: built('barn'), reward: { coins: 120 } },
    { text: 'Deixa o povo 80% contente', hint: 'Pão, carne, peixe, leite e queijo: comida que chegue, e variada.', done: () => game.happy >= 0.8, reward: { coins: 150 } },
    { text: 'Sobe o castelo ao nível 3', hint: 'Pede tábuas, pedra e pão — e um reino de 40 moradores, contente.', done: () => game.castleLevel >= 3, reward: { coins: 250 } },
    { text: 'Constrói uma leitaria', hint: 'Leite → queijo, o bem mais caro das feiras.', done: built('dairy'), reward: { coins: 200 } },
    { text: 'Abre uma mina de ouro', hint: 'Procura as veias douradas nas colinas.', done: built('goldmine'), reward: { planks: 20 } },
    { text: 'Constrói um curral de ovelhas e um centro de tecelagem', hint: 'Trigo → lã → rolos de tecido.', done: () => countOf('sheepfold') >= 1 && countOf('weaving') >= 1, reward: { coins: 250 } },
    { text: 'Planta uma vinha e constrói uma destilaria', hint: 'Toca na vinha para a podar e vindimar; a destilaria faz vinho com as uvas.', done: () => countOf('vineyard') >= 1 && countOf('distillery') >= 1, reward: { coins: 250 } },
    { text: 'Abre uma taberna', hint: 'Com vinho na adega, o povo convive ao fim do dia e fica mais contente.', done: built('tavern'), reward: { coins: 300 } },
    { text: 'Ultrapassa as três vilas vizinhas', hint: 'Toca em 👑 Reinos para ver a tabela.', done: () => game.derived.prosperity > Math.max(...game.towns.map((_, k) => townProsperity(k))), reward: { coins: 400 } },
    { text: 'Sobe o castelo ao nível 4', hint: 'Ouro das minas, queijo da leitaria e um reino grande e feliz.', done: () => game.castleLevel >= 4, reward: { coins: 1000 } },
    { text: 'Lavra um campo de algodão e abre uma alfaiataria', hint: 'Algodão e rolos de tecido de lã → fatos e vestidos, os mais caros das feiras.', done: () => countOf('cottonfield') >= 1 && countOf('tailor') >= 1, reward: { coins: 800 } },
    { text: 'Constrói um teatro', hint: 'A cultura do reino: com taberna e teatro para todos, o povo fica quase 100% contente — as jóias da joalharia, no nível 5, fazem o resto.', done: built('theatre'), reward: { coins: 1500 } },
    { text: `Sobe o castelo ao nível ${CASTLE_MAX_LEVEL}`, hint: 'Vinho, tecido, ouro e um reino de 120 moradores, 85% contente — taberna e teatro ajudam.', done: () => game.castleLevel >= CASTLE_MAX_LEVEL, reward: { coins: 3000 } },
    { text: 'Planta um canavial e constrói um engenho de açúcar', hint: 'Cana → açúcar.', done: () => countOf('canefield') >= 1 && countOf('sugarmill') >= 1, reward: { coins: 1500 } },
    { text: 'Planta um arrozal à beira de água', hint: 'O arroz é comida: mais variedade na mesa.', done: built('paddy'), reward: { coins: 1500 } },
    { text: 'Abre uma pastelaria', hint: 'Ovos, farinha, açúcar e leite → bolos, o doce do reino.', done: built('patisserie'), reward: { coins: 2500 } },
    // Os novos objetivos entram sempre no fim da lista: a gravação guarda o índice (ver save.js).
    { text: 'Abre uma hospedaria', hint: 'Os visitantes pagam a estadia e jantam do que sobra na despensa. Povo contente traz mais visitas.', done: built('inn'), reward: { coins: 2000 } },
    { text: 'Abre uma joalharia', hint: 'Ouro → jóias. Valem uma fortuna nas feiras, e o povo que as usa fica mais contente.', done: built('jewelry'), reward: { gold: 20 } }
];

/** Depois da lista: marcos de prosperidade, cada um o dobro do anterior. `index` conta a partir do início da lista. */
export function milestone(index) {
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
