// Progresso de um jogo — o que o jogador já desbloqueou e as marcas que fez.
//
// Fala com o endpoint genérico `/api/progress/:gameId` (ver
// Progress/ProgressEndpoints.cs) e guarda sempre uma cópia no aparelho. É essa
// cópia que faz o jogo funcionar sem conta e sem rede: o servidor é a memória
// que anda com o jogador de aparelho para aparelho, não a condição para jogar.
//
// O conteúdo é do jogo. Aqui só se sabe que é um objeto JSON, que se junta com
// `merge` quando as duas cópias discordam e que não pode passar dos 8 kB (o
// teto do servidor). A regra de junção é do jogo porque só ele sabe o que é
// "melhor": num jogo de níveis é o nível mais alto e o melhor tempo, noutro
// pode ser outra coisa.

import { readJson, writeJson } from './storage.js';

/** Teto do servidor (GameProgressEntry.MaxDataLength), para falhar aqui e não lá. */
const MAX_JSON_LENGTH = 8 * 1024;

/**
 * @param {string} gameId Slug do jogo, igual ao da pasta em wwwroot/games/.
 * @param {object} [options]
 * @param {string} [options.storageKey] Chave de localStorage da cópia local.
 * @param {() => object} [options.empty] Progresso de quem nunca jogou.
 * @param {(local: object, remote: object) => object} [options.merge] Junta as duas
 *   cópias. Sem ela, a da conta ganha.
 * @param {number} [options.saveDelay=800] Espera antes de gravar no servidor, em ms.
 *   Junta várias mudanças seguidas num só pedido.
 */
export function createProgressClient(gameId, {
    storageKey = `arcade.progress.${gameId}`,
    empty = () => ({}),
    merge = null,
    saveDelay = 800
} = {}) {
    const endpoint = `/api/progress/${gameId}`;

    let data = readLocal();
    /** True quando o progresso está guardado numa conta (e não só neste aparelho). */
    let stored = false;
    /** Há mudanças locais por enviar — por o servidor estar em baixo ou por ainda não ter passado o `saveDelay`. */
    let pending = false;
    let timer = 0;
    let inFlight = null;

    function readLocal() {
        const value = readJson(storageKey, null);
        return isObject(value) ? value : empty();
    }

    function writeLocal() {
        writeJson(storageKey, data);
    }

    /**
     * Lê o progresso da conta e junta-o ao deste aparelho. Chamar uma vez, no
     * arranque — quem tem sessão iniciada noutro aparelho recebe aqui o nível
     * mais alto que já abriu.
     * @returns {Promise<{ data: object, stored: boolean }>}
     */
    async function load() {
        let remote = null;
        try {
            const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
            if (res.ok) {
                const body = await res.json();
                stored = !!(body && body.stored);
                remote = isObject(body && body.data) ? body.data : null;
            }
        } catch {
            // Sem rede joga-se na mesma, com o que está no aparelho.
        }

        if (remote) {
            data = merge ? merge(data, remote) : remote;
            writeLocal();
            // A junção só volta ao servidor se este aparelho trouxer alguma coisa
            // que lá não estava — senão cada arranque escrevia por escrever.
            if (JSON.stringify(data) !== JSON.stringify(remote)) save();
        } else if (stored) {
            // Conta sem progresso guardado: o que está neste aparelho é o começo
            // dela. Quem nunca jogou não escreve nada — a linha na base de dados
            // nasce com o primeiro nível feito, não com a primeira visita.
            writeLocal();
            if (JSON.stringify(data) !== JSON.stringify(empty())) save();
        }

        return { data, stored };
    }

    /**
     * Muda o progresso e grava-o. O aparelho fica logo em dia; o servidor recebe
     * a seguir, com um atraso curto para várias mudanças seguidas irem juntas.
     * @param {(data: object) => object|void} mutator
     */
    function update(mutator) {
        const next = mutator(data);
        if (isObject(next)) data = next;
        writeLocal();
        save();
        return data;
    }

    /** Agenda a gravação no servidor. Sem sessão iniciada não há nada a agendar. */
    function save() {
        pending = true;
        if (!stored) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { timer = 0; flush(); }, saveDelay);
    }

    /**
     * Envia agora o que estiver por enviar. Nunca rejeita: se falhar, o `pending`
     * fica de pé e a próxima mudança (ou o próximo `flush`) tenta outra vez.
     * @returns {Promise<boolean>} Se o servidor ficou com a versão mais recente.
     */
    function flush() {
        if (timer) { clearTimeout(timer); timer = 0; }
        if (!stored || !pending) return Promise.resolve(!pending);
        if (inFlight) return inFlight;

        const body = JSON.stringify(data);
        if (body.length > MAX_JSON_LENGTH) {
            // Um progresso que não cabe no servidor é um bug do jogo, não do
            // jogador: fica no aparelho e não se insiste com o endpoint.
            console.warn(`[arcade] progresso de ${gameId} grande de mais (${body.length} bytes); fica só neste aparelho`);
            pending = false;
            return Promise.resolve(false);
        }

        inFlight = fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body
        })
            .then((res) => {
                if (!res.ok) throw new Error(`status ${res.status}`);
                // Só se limpa se nada mudou entretanto — senão perdia-se a
                // mudança que entrou enquanto este pedido estava no ar.
                if (JSON.stringify(data) === body) pending = false;
                return true;
            })
            .catch(() => false)
            .finally(() => { inFlight = null; });

        return inFlight;
    }

    // Fechar o separador a meio de um nível não pode custar o nível: a saída da
    // página é a última oportunidade de gravar o que ficou por enviar.
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush();
        });
        window.addEventListener('pagehide', () => flush());
    }

    return {
        gameId,
        endpoint,
        get data() { return data; },
        /** True quando o progresso está guardado na conta. Só depois do `load()`. */
        get stored() { return stored; },
        get pending() { return pending; },
        load,
        update,
        flush,
        /** Volta ao progresso de quem nunca jogou. Não pergunta nada — quem pergunta é o jogo. */
        reset() {
            data = empty();
            writeLocal();
            save();
            return data;
        }
    };
}

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
