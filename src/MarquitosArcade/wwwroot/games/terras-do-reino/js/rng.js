// Aleatório com semente e ruído suave para gerar o mapa.
//
// O mapa não é guardado: sai sempre igual da mesma semente, por isso a gravação
// só leva a semente e o que o jogador mudou. É isso que a mantém abaixo dos
// 8 kB do servidor (ver lib/arcade/progress.js).

/** Gerador mulberry32: rápido, com semente de 32 bits e bom o bastante para um mapa. */
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
        range: (min, max) => min + next() * (max - min),
        int: (min, max) => Math.floor(min + next() * (max - min + 1)),
        pick: (list) => list[Math.floor(next() * list.length)]
    };
}

/** Número pseudo-aleatório estável para uma casa — para variar cores sem guardar nada. */
export function hash2(x, y, seed = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Ruído de valor 2D, entre 0 e 1, com interpolação suave entre os nós da grelha. */
export function valueNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = hash2(x0, y0, seed);
    const b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed);
    const d = hash2(x0 + 1, y0 + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Várias oitavas de ruído somadas: manchas grandes com recortes pequenos. */
export function fbm(x, y, seed, octaves = 3) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 101) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}
