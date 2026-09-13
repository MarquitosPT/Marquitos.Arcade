// Cliente do leaderboard da arcada.
//
// Fala com o endpoint genérico `/api/scores/:gameId` (ver Scores/ScoresEndpoints.cs).
// Guarda sempre uma cópia local do quadro para o ecrã nunca ficar vazio quando o
// servidor está a acordar ou o telemóvel está sem rede.
//
// Nota sobre nomes: se o pedido vier de um utilizador autenticado, o servidor
// ignora o nome enviado e usa o da conta (evita spoofing). O nome que o jogo
// envia só conta para visitantes anónimos.

import { readText, writeText, readJson, writeJson } from './storage.js';

const ACCOUNT_ENDPOINT = '/api/account/me';

/**
 * Nome a mostrar da conta autenticada, ou '' se for visitante anónimo.
 * Nunca rejeita — sem sessão, sem rede ou com erro do servidor devolve ''.
 * @returns {Promise<string>}
 */
export function fetchAccountDisplayName() {
    return fetch(ACCOUNT_ENDPOINT)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data && data.displayName) || '')
        .catch(() => '');
}

/**
 * Liga um <input> de nome ao armazenamento local e à conta do jogador.
 * Preenche primeiro com o nome guardado neste aparelho e, se estiver vazio,
 * com o nome da conta quando a resposta chegar (sem pisar o que o jogador
 * já tenha começado a escrever entretanto).
 *
 * @returns {{ current(): string, remember(name?: string): string }}
 *   `current()` devolve o nome escrito, cortado, ou 'Anónimo' se vazio.
 *   `remember()` grava-o para a próxima visita e devolve-o.
 */
export function bindPlayerNameInput(input, storageKey, { fallback = 'Anónimo' } = {}) {
    if (input) {
        input.value = readText(storageKey) || '';
        fetchAccountDisplayName().then((displayName) => {
            if (displayName && !input.value) input.value = displayName;
        });
    }

    function current() {
        return ((input && input.value) || '').trim() || fallback;
    }

    return {
        current,
        remember(name) {
            const value = name === undefined ? current() : name;
            writeText(storageKey, value);
            return value;
        }
    };
}

/**
 * @param {string} gameId Slug do jogo, igual ao da pasta em wwwroot/games/.
 * @param {object} [options]
 * @param {string} [options.cacheKey] Chave de localStorage do quadro em cache.
 * @param {number} [options.limit=20] Entradas guardadas na cache offline.
 */
export function createScoreClient(gameId, { cacheKey = `arcade.board.${gameId}`, limit = 20 } = {}) {
    const endpoint = `/api/scores/${gameId}`;

    function readCachedBoard() {
        const board = readJson(cacheKey, []);
        return Array.isArray(board) ? board : [];
    }

    function cacheBoard(board) {
        writeJson(cacheKey, board);
        return board;
    }

    /**
     * Top do servidor. Em caso de falha devolve a última cópia local com ok:false,
     * para o jogo poder mostrar o quadro E avisar que está desatualizado.
     * @returns {Promise<{ ok: boolean, board: Array }>}
     */
    function fetchBoard() {
        return fetch(endpoint, { method: 'GET' })
            .then((res) => {
                if (!res.ok) throw new Error(`status ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (!Array.isArray(data)) throw new Error('resposta inválida');
                return { ok: true, board: cacheBoard(data) };
            })
            .catch(() => ({ ok: false, board: readCachedBoard() }));
    }

    /**
     * Envia uma pontuação e devolve o quadro atualizado. Se o envio falhar,
     * insere a pontuação só na cópia local e devolve ok:false.
     * @returns {Promise<{ ok: boolean, board: Array }>}
     */
    function submit(name, score) {
        return fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        })
            .then((res) => {
                if (!res.ok) throw new Error(`status ${res.status}`);
                return res.json();
            })
            .then((data) => ({ ok: true, board: cacheBoard(Array.isArray(data) ? data : readCachedBoard()) }))
            .catch(() => {
                const board = readCachedBoard();
                board.push({ name, score, ts: Date.now() });
                board.sort((a, b) => b.score - a.score);
                return { ok: false, board: cacheBoard(board.slice(0, limit)) };
            });
    }

    /**
     * Envio "dispara e esquece", para jogos que não mostram o quadro no fim.
     * Ignora pontuações não positivas e nunca rejeita.
     */
    function submitQuietly(name, score) {
        if (!(score > 0)) return Promise.resolve();
        return submit(name, score).then(() => undefined);
    }

    return { gameId, endpoint, fetchBoard, submit, submitQuietly, readCachedBoard, cacheBoard };
}
