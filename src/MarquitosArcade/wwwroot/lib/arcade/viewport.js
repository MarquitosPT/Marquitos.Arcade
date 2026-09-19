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
        /**
         * Áreas de sistema do aparelho (`env(safe-area-inset-*)`), em px lógicos:
         * o notch e a barra de estado, e a barra de gestos no fundo. Em paisagem
         * o notch passa para um dos lados, e é por isso que os quatro lados
         * contam — um jogo que desenhe até ao bordo põe peças por baixo deles.
         */
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        /** True em orientação retrato. */
        get isPortrait() {
            return viewport.width < viewport.height;
        },
        measure,
        /** Remove os listeners de window. Para jogos embebidos noutra página. */
        dispose() {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', onOrientationChange);
            safeProbe?.remove();
            safeProbe = null;
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

    /*
     * As áreas de sistema só existem em CSS, no `env()`. Esta sonda é a forma de
     * as ler em JS: um elemento fora de vista com as quatro como `padding`, que
     * o `getComputedStyle` devolve já resolvidas em px. Fica no DOM e é relida a
     * cada medição, porque o valor muda ao rodar o aparelho.
     */
    let safeProbe = null;

    function readSafeArea() {
        if (!safeProbe) {
            safeProbe = document.createElement('div');
            safeProbe.setAttribute('aria-hidden', 'true');
            safeProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;'
                + 'visibility:hidden;pointer-events:none;'
                + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) '
                + 'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
            document.body.appendChild(safeProbe);
        }
        const css = getComputedStyle(safeProbe);
        return {
            top: parseFloat(css.paddingTop) || 0,
            right: parseFloat(css.paddingRight) || 0,
            bottom: parseFloat(css.paddingBottom) || 0,
            left: parseFloat(css.paddingLeft) || 0
        };
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
        viewport.safeArea = readSafeArea();

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
