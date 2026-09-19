// Formatação de números para o HUD e para os ecrãs.

/** Tempo em m:ss, a partir de segundos. */
export function fmtClock(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
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
