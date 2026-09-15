// Canvas em ecrã inteiro, nítido em ecrãs Retina e por baixo do notch.
//
// O canvas tem dois tamanhos: o de CSS (pixels lógicos, o que o jogo desenha) e o
// de buffer (pixels físicos = lógicos x devicePixelRatio). Sem isto, um iPhone com
// DPR 3 desenha tudo esborratado. A transformação fica montada de forma a que o
// jogo possa continuar a desenhar em coordenadas lógicas.

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {HTMLElement} [options.topBar] Barra de topo a evitar. Quando presente,
 *   `topInset` fica com o fundo da barra e o jogo não desenha por baixo dos botões.
 * @param {number} [options.topBarGap=10] Folga extra abaixo da barra de topo.
 * @param {(viewport: object) => void} [options.onResize] Chamado depois de cada
 *   remedição, incluindo a inicial.
 */
export function createViewport(canvas, { topBar = null, topBarGap = 10, onResize = null } = {}) {
    const ctx = canvas.getContext('2d');

    const viewport = {
        ctx,
        canvas,
        /** Largura lógica (px CSS). */
        width: 0,
        /** Altura lógica (px CSS). */
        height: 0,
        /** devicePixelRatio em uso. */
        dpr: 1,
        /** Y lógico abaixo do qual é seguro desenhar sem tapar a barra de topo. */
        topInset: 0,
        /** True em orientação retrato. */
        get isPortrait() {
            return viewport.width < viewport.height;
        },
        measure,
        /** Remove os listeners de window. Para jogos embebidos noutra página. */
        dispose() {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', onOrientationChange);
        }
    };

    // Numa app afixada em iOS o viewport de layout é mais curto do que o ecrã
    // pela altura da barra de estado; lib/arcade/standalone-fit.js mede essa
    // folga e publica-a em `--viewport-gap`. Sem a somar aqui, o canvas ficava
    // pelo fim do viewport e sobrava uma faixa no fundo do ecrã. Fora desse
    // caso vale 0 e o canvas continua a medir o viewport.
    function viewportGap() {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue('--viewport-gap');
        return parseFloat(value) || 0;
    }

    function measure() {
        viewport.dpr = window.devicePixelRatio || 1;
        viewport.width = window.innerWidth;
        viewport.height = window.innerHeight + viewportGap();

        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.width = viewport.width * viewport.dpr;
        canvas.height = viewport.height * viewport.dpr;
        // Repor a transformação: mudar canvas.width já limpou o contexto.
        ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);

        viewport.topInset = topBar ? topBar.getBoundingClientRect().bottom + topBarGap : 0;

        if (onResize) onResize(viewport);
    }

    // O iOS reporta as dimensões antigas durante a animação de rotação, daí o atraso.
    function onOrientationChange() {
        setTimeout(measure, 200);
    }

    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', onOrientationChange);
    measure();

    return viewport;
}
