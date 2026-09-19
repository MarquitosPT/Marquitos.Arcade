// O progresso do jogador neste jogo: que níveis abriu e o que fez em cada um.
//
// Quem tem sessão iniciada leva isto consigo de aparelho para aparelho — o
// cliente do SDK (lib/arcade/progress.js) trata da conta e do armazenamento
// local. Aqui fica só o que é do Maze Run: a forma do objeto e a regra de
// junção quando as duas cópias discordam.
//
// A forma:
//
//   {
//     v: 1,
//     unlocked: 3,                                   // nível mais alto aberto
//     levels: { '1': { score, ms, stars, runs } }    // a melhor marca de cada um
//   }
//
// O total de pontos não se guarda: soma-se a partir dos níveis (`totalScore`).
// Guardado, ficava a discordar de si próprio à primeira junção de duas cópias.

import { createProgressClient } from '/lib/arcade/progress.js';

import { GAME_ID, PROGRESS_STORAGE_KEY } from './config.js';
import { levelCount } from './levels.js';

/** Versão da forma do objeto. Subir isto obriga a pensar no que fazer ao antigo. */
const VERSION = 1;

const emptyProgress = () => ({ v: VERSION, unlocked: 1, levels: {} });

/**
 * Junta o que está no aparelho com o que está na conta. Ganha sempre o melhor
 * dos dois, nível a nível — jogar sem sessão iniciada e entrar depois não pode
 * custar o que se fez, e uma conta usada em dois aparelhos fica com o melhor
 * dos dois.
 */
function mergeProgress(local, remote) {
    const merged = emptyProgress();
    merged.unlocked = Math.max(1, local?.unlocked || 1, remote?.unlocked || 1);

    for (const source of [local, remote]) {
        for (const [id, entry] of Object.entries(source?.levels || {})) {
            if (!entry || typeof entry !== 'object') continue;
            merged.levels[id] = betterOf(merged.levels[id], entry);
        }
    }

    // O desbloqueio também se deduz do que está concluído: uma cópia que traga o
    // nível 3 feito abre o 4, mesmo que o `unlocked` dela tenha ficado para trás.
    for (const id of Object.keys(merged.levels)) {
        merged.unlocked = Math.max(merged.unlocked, Math.min(levelCount(), Number(id) + 1));
    }

    return merged;
}

/**
 * Junta duas marcas do mesmo nível campo a campo: os melhores pontos, o melhor
 * tempo, as melhores estrelas. Não se escolhe "a melhor das duas" em bloco
 * porque não há uma: quem fez mais pontos numa tentativa pode ter feito o
 * melhor tempo noutra, e as duas coisas são do jogador.
 */
function betterOf(a, b) {
    if (!a) return normalize(b);
    if (!b) return normalize(a);
    return {
        score: Math.max(a.score || 0, b.score || 0),
        ms: bestMs(a.ms, b.ms),
        stars: Math.max(a.stars || 0, b.stars || 0),
        runs: (a.runs || 0) + (b.runs || 0)
    };
}

const normalize = (entry) => ({
    score: entry.score || 0,
    ms: bestMs(entry.ms, null),
    stars: entry.stars || 0,
    runs: entry.runs || 0
});

/** O melhor de dois tempos. Zero quando não há nenhum — `Infinity` não sobrevive a um JSON. */
function bestMs(a, b) {
    const times = [a, b].filter((ms) => typeof ms === 'number' && ms > 0 && Number.isFinite(ms));
    return times.length ? Math.min(...times) : 0;
}

export const progress = createProgressClient(GAME_ID, {
    storageKey: PROGRESS_STORAGE_KEY,
    empty: emptyProgress,
    merge: mergeProgress
});

/** Carrega a conta e junta-a ao aparelho. Uma vez, no arranque. */
export const loadProgress = () => progress.load();

export const unlockedCount = () => Math.min(levelCount(), Math.max(1, progress.data.unlocked || 1));

export const isUnlocked = (levelId) => levelId <= unlockedCount();

/** A melhor marca deste nível, ou `null` se ainda não foi concluído. */
export const bestOf = (levelId) => progress.data.levels?.[String(levelId)] || null;

export const isCleared = (levelId) => !!bestOf(levelId);

/** Soma dos pontos do melhor resultado de cada nível — é isto que vai ao quadro. */
export function totalScore() {
    return Object.values(progress.data.levels || {})
        .reduce((sum, entry) => sum + (entry.score || 0), 0);
}

export function totalStars() {
    return Object.values(progress.data.levels || {})
        .reduce((sum, entry) => sum + (entry.stars || 0), 0);
}

/**
 * Regista o fim de um nível e abre o seguinte.
 * @returns {{ improved: boolean, unlockedLevel: number|null }} Se bateu a marca
 *   anterior e, se abriu um nível novo, qual.
 */
export function recordClear(levelId, { score, ms, stars }) {
    const key = String(levelId);
    const previous = bestOf(levelId);
    const improved = !previous || score > (previous.score || 0);
    const nextLevel = Math.min(levelCount(), levelId + 1);
    const unlockedLevel = nextLevel > unlockedCount() ? nextLevel : null;

    progress.update((data) => {
        data.levels = data.levels || {};
        data.levels[key] = {
            score: Math.max(score, previous?.score || 0),
            ms: bestMs(ms, previous?.ms),
            stars: Math.max(stars, previous?.stars || 0),
            runs: (previous?.runs || 0) + 1
        };
        data.unlocked = Math.max(data.unlocked || 1, nextLevel);
        data.v = VERSION;
    });

    return { improved, unlockedLevel };
}

/** Apaga o progresso. Quem pergunta se é mesmo isso que se quer é o menu. */
export const resetProgress = () => progress.reset();
