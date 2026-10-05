// Formatação de números para os ecrãs.

/** Tempo em m:ss, a partir de segundos. */
export function fmtClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Tempo em m:ss.d, a partir de milissegundos — para as marcas dos níveis. */
export function fmtTime(ms) {
    const total = Math.max(0, ms);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const d = Math.floor((total % 1000) / 100);
    return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

/** Pontos com separador de milhares à portuguesa. */
export const fmtPoints = (value) => Math.round(value).toLocaleString('pt-PT');
