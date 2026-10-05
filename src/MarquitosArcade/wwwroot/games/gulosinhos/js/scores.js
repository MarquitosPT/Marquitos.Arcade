// Cliente do leaderboard deste jogo.

import { createScoreClient } from '/lib/arcade/scores.js';
import { GAME_ID } from './config.js';

export const scores = createScoreClient(GAME_ID);
