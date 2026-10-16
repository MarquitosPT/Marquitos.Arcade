import { createProgressClient } from '/lib/arcade/progress.js';

import { GAME_ID, PROGRESS_STORAGE_KEY } from './config.js';
import { levelCount } from './levels.js';

const VERSION = 1;

const emptyProgress = () => ({ v: VERSION, unlocked: 1, levels: {} });
const currentOrEmpty = (data) => (data && data.v === VERSION ? data : emptyProgress());

function bestMs(a, b) {
    const values = [a, b].filter((ms) => typeof ms === 'number' && ms > 0 && Number.isFinite(ms));
    return values.length ? Math.min(...values) : 0;
}

function normalize(entry) {
    return {
        score: entry?.score || 0,
        ms: bestMs(entry?.ms, null),
        stars: entry?.stars || 0,
        lives: entry?.lives || 0,
        bricks: entry?.bricks || 0,
        runs: entry?.runs || 0
    };
}

function betterOf(a, b) {
    if (!a) return normalize(b);
    if (!b) return normalize(a);
    return {
        score: Math.max(a.score || 0, b.score || 0),
        ms: bestMs(a.ms, b.ms),
        stars: Math.max(a.stars || 0, b.stars || 0),
        lives: Math.max(a.lives || 0, b.lives || 0),
        bricks: Math.max(a.bricks || 0, b.bricks || 0),
        runs: (a.runs || 0) + (b.runs || 0)
    };
}

function mergeProgress(rawLocal, rawRemote) {
    const local = currentOrEmpty(rawLocal);
    const remote = currentOrEmpty(rawRemote);
    const merged = emptyProgress();
    merged.unlocked = Math.max(1, local.unlocked || 1, remote.unlocked || 1);

    for (const source of [local, remote]) {
        for (const [id, entry] of Object.entries(source?.levels || {})) {
            if (!entry || typeof entry !== 'object') continue;
            merged.levels[id] = betterOf(merged.levels[id], entry);
        }
    }

    for (const id of Object.keys(merged.levels)) {
        merged.unlocked = Math.max(merged.unlocked, Math.min(levelCount(), Number(id) + 1));
    }

    return merged;
}

export const progress = createProgressClient(GAME_ID, {
    storageKey: PROGRESS_STORAGE_KEY,
    empty: emptyProgress,
    merge: mergeProgress,
    accept: currentOrEmpty
});

export const loadProgress = () => progress.load();
export const unlockedCount = () => Math.min(levelCount(), Math.max(1, progress.data.unlocked || 1));
export const isUnlocked = (levelId) => levelId <= unlockedCount();
export const bestOf = (levelId) => progress.data.levels?.[String(levelId)] || null;
export const isCleared = (levelId) => !!bestOf(levelId);
export const totalScore = () => Object.values(progress.data.levels || {}).reduce((sum, entry) => sum + (entry.score || 0), 0);
export const totalStars = () => Object.values(progress.data.levels || {}).reduce((sum, entry) => sum + (entry.stars || 0), 0);

export function recordClear(levelId, { score, ms, stars, lives, bricks }) {
    const key = String(levelId);
    const previous = bestOf(levelId);
    const nextLevel = Math.min(levelCount(), levelId + 1);
    const unlockedLevel = nextLevel > unlockedCount() ? nextLevel : null;
    const improved = !previous || score > (previous.score || 0);

    progress.update((data) => {
        data.levels = data.levels || {};
        data.levels[key] = {
            score: Math.max(score, previous?.score || 0),
            ms: bestMs(ms, previous?.ms),
            stars: Math.max(stars, previous?.stars || 0),
            lives: Math.max(lives, previous?.lives || 0),
            bricks: Math.max(bricks, previous?.bricks || 0),
            runs: (previous?.runs || 0) + 1
        };
        data.unlocked = Math.max(data.unlocked || 1, nextLevel);
        data.v = VERSION;
    });

    return { improved, unlockedLevel };
}

export const resetProgress = () => progress.reset();
