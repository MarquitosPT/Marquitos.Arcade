// Formatação de texto do jogo.

/** Ordinal em português: 1º, 2º, ... */
export const ordinal = (n) => `${n}º`;

/** Tempo de corrida como m:ss.cc. */
export function fmtTime(ms) {
    if (ms == null) return '--:--.--';
    const total = Math.max(0, ms);
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const centis = Math.floor((total % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
