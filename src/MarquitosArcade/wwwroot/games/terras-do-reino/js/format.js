// Números e tempos como se leem em português.

const INT = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
const ONE = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Inteiro, com separador de milhares. */
export const fmt = (n) => INT.format(Math.floor(n + 1e-6));

/** Curto, para os chips do HUD: 12 345 passa a 12,3 mil. */
export function fmtShort(n) {
    const v = Math.floor(n + 1e-6);
    if (v < 10000) return INT.format(v);
    if (v < 1e6) return `${ONE.format(v / 1000)} mil`;
    return `${ONE.format(v / 1e6)} M`;
}

/** Preço: com uma casa decimal enquanto for pequeno. */
export const fmtPrice = (p) => (p < 10 ? ONE.format(p) : INT.format(Math.round(p)));

export function fmtDuration(seconds) {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h} h ${m} min`;
    if (m) return `${m} min`;
    return `${s} s`;
}

export const pct = (x) => `${Math.round(x * 100)}%`;
