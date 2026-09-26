// Quantas colunas e de que tamanho: a grelha que dá os maiores cartões.
//
// Num telemóvel o espaço é pouco e muda com a rotação, por isso a grelha não
// é fixa por nível. A cada remedição experimentam-se todas as contagens de
// colunas e fica a que deixa os cartões maiores dentro da área livre. É assim
// que as 50 cartas do último nível ficam num 5 × 10 ao alto e num 13 × 4 ao
// comprido, sem ninguém ter escrito nenhum dos dois.
//
// A forma do cartão também se escolhe: um pouco mais alto do que largo, como
// as cartas de papel, quando sobra altura; quadrado quando é a altura que
// falta. Fica a que dá o cartão com mais área — num tabuleiro de 50 ao alto,
// o quadrado ganha uns 5px de largura, e é isso que deixa ver o animal.

/**
 * @param {object} options
 * @param {number} options.count Cartas a arrumar.
 * @param {number} options.width Largura livre, em píxeis.
 * @param {number} options.height Altura livre, em píxeis.
 * @param {number[]} options.ratios Formas possíveis do cartão (altura a dividir pela largura).
 * @param {number} options.maxWidth Teto da largura de um cartão — num
 *   computador, quatro cartas não precisam de ocupar o ecrã todo.
 * @returns {{ cols: number, rows: number, cardW: number, cardH: number, gap: number, ratio: number }}
 */
export function fitGrid({ count, width, height, ratios, maxWidth }) {
    let best = null;
    for (const ratio of ratios) {
        const grid = fitWithRatio({ count, width, height, ratio, maxWidth });
        if (!best || grid.cardW * grid.cardH > best.cardW * best.cardH) best = grid;
    }
    return best;
}

function fitWithRatio({ count, width, height, ratio, maxWidth }) {
    let best = null;

    for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        // Uma grelha com uma fila inteira vazia é uma grelha com colunas a mais.
        if (cols * (rows - 1) >= count) continue;

        const gap = gapFor(Math.min(width / cols, height / rows / ratio));
        const cardW = Math.min(
            (width - gap * (cols - 1)) / cols,
            (height - gap * (rows - 1)) / rows / ratio,
            maxWidth
        );
        if (cardW <= 0) continue;

        // Com cartões do mesmo tamanho, ganha a grelha com menos buracos na
        // última fila: 12 cartas em 4 × 3 e não em 5 × 3 com três em falta.
        const holes = cols * rows - count;
        if (!best || cardW > best.cardW + 0.5 || (Math.abs(cardW - best.cardW) <= 0.5 && holes < best.holes)) {
            best = { cols, rows, cardW, holes, gap };
        }
    }

    const cardW = Math.floor(best.cardW);
    return { cols: best.cols, rows: best.rows, cardW, cardH: Math.floor(cardW * ratio), gap: best.gap, ratio };
}

/** O espaço entre cartões acompanha o tamanho deles: 6px nos pequenos, até 14px nos grandes. */
function gapFor(cell) {
    return Math.round(Math.max(6, Math.min(14, cell * 0.08)));
}
