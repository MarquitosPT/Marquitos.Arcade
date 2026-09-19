// Cliente do leaderboard da arcada.
//
// Fala com o endpoint genérico `/api/scores/:gameId` (ver Scores/ScoresEndpoints.cs).
// Guarda sempre uma cópia local do quadro para o ecrã nunca ficar vazio quando o
// servidor está a acordar ou o telemóvel está sem rede.
//
// Nota sobre nomes: o servidor guarda o nome que o jogo enviar, seja quem for o
// jogador — só recorre ao nome da conta se vier vazio (ver ScoresEndpoints.cs).
// Quem tem de garantir que um jogador com sessão iniciada aparece no quadro com
// o nome da conta é este ficheiro, no `bindPlayerNameInput` aqui em baixo.

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
 *
 * Ordem de precedência do nome, da que manda para a que cede:
 *
 * 1. o que o jogador escrever agora no campo;
 * 2. o nome da conta, para quem tem sessão iniciada;
 * 3. o nome guardado neste aparelho de uma visita anterior;
 * 4. o `fallback`, que é só o que se mostra quando não há nome nenhum.
 *
 * O nome da conta ganhar ao que está guardado é o que evita o caso em que o
 * jogo diz "A correr como Fulano" e regista a pontuação com o nome antigo. Um
 * jogo que esconda o campo a quem tem sessão (como o Pixel Racing) depende
 * inteiramente disto.
 *
 * @returns {{ current(): string, remember(name?: string): string, account: Promise<string> }}
 *   `current()` devolve o nome a usar, cortado, ou o `fallback` se não houver.
 *   `remember()` grava-o para a próxima visita e devolve-o.
 *   `account` resolve com o nome da conta autenticada, ou '' se for visitante —
 *   é a mesma resposta que preenche o campo, partilhada para o jogo poder
 *   esconder o campo do nome a quem já tem sessão iniciada sem pedir duas vezes.
 */
export function bindPlayerNameInput(input, storageKey, { fallback = 'Anónimo' } = {}) {
    const account = fetchAccountDisplayName();

    if (input) {
        // O `fallback` não é um nome que alguém tenha escolhido. Versões
        // anteriores chegaram a guardá-lo (ver `remember` mais abaixo), por isso
        // aqui vale tanto como campo vazio — senão continuava a ganhar à conta.
        const stored = readText(storageKey);
        input.value = stored && stored !== fallback ? stored : '';

        // Se o jogador começar a escrever antes de a conta responder, o que ele
        // escreveu manda: a resposta chega depois e não lhe pisa as teclas.
        let typed = false;
        input.addEventListener('input', () => { typed = true; });

        account.then((displayName) => {
            if (displayName && !typed) input.value = displayName;
        });
    }

    function current() {
        return ((input && input.value) || '').trim() || fallback;
    }

    return {
        current,
        account,
        remember(name) {
            const value = name === undefined ? current() : name;
            // Guardar o `fallback` era o que estragava a visita seguinte: ficava
            // no armazenamento como se fosse um nome escolhido e ganhava ao nome
            // da conta. Quem joga sem escrever nada não deixa nome guardado.
            if (value !== fallback) writeText(storageKey, value);
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
