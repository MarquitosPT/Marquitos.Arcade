// Ciclo de jogo em requestAnimationFrame, com delta-time limitado.
//
// O limite (`maxDelta`) é o que impede o "túnel" quando o separador esteve em
// segundo plano: ao voltar, o browser entrega um salto de vários segundos e, sem
// limite, a bola atravessaria a raquete num só passo.

/**
 * @param {(dt: number, timestamp: number) => void} step Avança e desenha um frame.
 * @param {object} [options]
 * @param {number} [options.scale=1000] Divisor do delta em ms. 1000 => dt em
 *   segundos; 16.67 => dt em "frames a 60fps" (1.0 = um frame).
 * @param {number} [options.maxDelta=0.05] Teto do dt, já na escala escolhida.
 * @param {boolean} [options.stepWhilePaused=false] Se true, `step` continua a ser
 *   chamado em pausa (para o jogo poder redesenhar o overlay).
 */
export function createLoop(step, { scale = 1000, maxDelta = 0.05, stepWhilePaused = false } = {}) {
    let running = false;
    let paused = false;
    let lastTs = 0;
    let frame = 0;

    function tick(ts) {
        if (!running) return;
        frame = requestAnimationFrame(tick);

        if (!lastTs) lastTs = ts;
        const dt = Math.min(maxDelta, (ts - lastTs) / scale);
        lastTs = ts;

        if (paused && !stepWhilePaused) return;
        step(paused ? 0 : dt, ts);
    }

    return {
        start() {
            if (running) return;
            running = true;
            paused = false;
            lastTs = 0;
            frame = requestAnimationFrame(tick);
        },
        stop() {
            running = false;
            paused = false;
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
        },
        /** Descarta o tempo acumulado — chamar ao retomar, senão salta um frame gigante. */
        resetDelta() {
            lastTs = 0;
        },
        get running() {
            return running;
        },
        get paused() {
            return paused;
        },
        set paused(value) {
            const next = !!value;
            if (!next && paused) lastTs = 0;
            paused = next;
        }
    };
}
