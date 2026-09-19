// Cliente do leaderboard deste jogo, já com as chaves de cache certas.

import { createScoreClient } from '/lib/arcade/scores.js';
import { BOARD_CACHE_KEY, GAME_ID } from './config.js';

export const scores = createScoreClient(GAME_ID, { cacheKey: BOARD_CACHE_KEY });
