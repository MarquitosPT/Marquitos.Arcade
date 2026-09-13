// Ajudas de matemática partilhadas pelos jogos.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const lerp = (a, b, t) => a + (b - a) * t;

/** Normaliza um ângulo para o intervalo (-PI, PI]. */
export const normAngle = (a) => {
    a %= Math.PI * 2;
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
};

/** Interpola ângulos pelo caminho mais curto (sem dar a volta ao mundo em ±PI). */
export const lerpAngle = (a, b, t) => a + normAngle(b - a) * t;

export const rand = (a, b) => a + Math.random() * (b - a);

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Baralha uma cópia do array (Fisher-Yates). Não mexe no original. */
export function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
