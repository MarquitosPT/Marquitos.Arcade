// Cliente do leaderboard deste jogo, já com as chaves de cache certas.

import { createScoreClient, fetchAccountDisplayName } from '/lib/arcade/scores.js';
import { BOARD_CACHE_KEY, GAME_ID } from './config.js';

export const scores = createScoreClient(GAME_ID, { cacheKey: BOARD_CACHE_KEY });

/**
 * Nome da conta autenticada, para sugerir no campo do nome. Fica em cache porque
 * o ecrã de preparação pode ser aberto várias vezes no mesmo carregamento.
 */
let accountDisplayName = '';
fetchAccountDisplayName().then((name) => {
    accountDisplayName = name;
});

export const getAccountDisplayName = () => accountDisplayName;
