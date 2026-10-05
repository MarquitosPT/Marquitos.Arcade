// Gerador de números aleatórios com semente (mulberry32).
//
// Os níveis saem de uma semente (ver world.js): o mesmo número dá sempre o
// mesmo percurso, em qualquer aparelho. Por isso aqui não se usa Math.random —
// esse muda a cada visita, e o nível 3 de hoje tinha de ser o nível 3 de amanhã.

export function createRng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    return {
        next,
        /** Inteiro entre `lo` e `hi`, os dois incluídos. */
        int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
        /** Verdadeiro com probabilidade `p`. */
        chance: (p) => next() < p,
        pick: (list) => list[Math.floor(next() * list.length)],
        /** Escolhe por pesos: `[[valor, peso], ...]`. */
        weighted(entries) {
            const total = entries.reduce((sum, [, w]) => sum + w, 0);
            let roll = next() * total;
            for (const [value, w] of entries) {
                roll -= w;
                if (roll < 0) return value;
            }
            return entries[entries.length - 1][0];
        }
    };
}
