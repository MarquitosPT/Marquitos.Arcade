// Motor de áudio partilhado: ciclo de vida do AudioContext + bips sintetizados.
//
// Os browsers só deixam criar/retomar um AudioContext dentro de um gesto do
// utilizador, por isso `resume()` tem de ser chamado no primeiro toque/clique de
// cada jogo (tipicamente no botão JOGAR). Antes disso `beep()` é um no-op
// silencioso em vez de atirar.
//
// Não há ficheiros de áudio: as ondas são geradas com osciladores. Mantém o jogo
// leve e evita licenças de samples.

/**
 * @param {object} [options]
 * @param {OscillatorType} [options.defaultType='square'] Forma de onda por omissão.
 * @param {number} [options.defaultVolume=0.15] Ganho de pico por omissão.
 * @param {number} [options.attack=0] Subida do envelope em segundos. 0 = ataque
 *   seco (a nota arranca no volume de pico), o som retro dos jogos de canvas.
 *   Um valor pequeno (ex. 0.01) tira o "click" do arranque.
 */
export function createAudio({ defaultType = 'square', defaultVolume = 0.15, attack = 0 } = {}) {
    let ctx = null;
    let muted = false;

    function resume() {
        if (!ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) ctx = new Ctx();
        }
        if (ctx && ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function beep(freq, duration, type, volume, delay) {
        if (muted || !ctx) return;
        const peak = volume === undefined ? defaultVolume : volume;
        const t0 = ctx.currentTime + (delay || 0);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || defaultType;
        osc.frequency.setValueAtTime(freq, t0);

        if (attack > 0) {
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(peak, t0 + attack);
        } else {
            gain.gain.setValueAtTime(peak, t0);
        }
        // exponentialRampToValueAtTime nunca chega a zero, daí o 0.0001.
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.03);
    }

    return {
        resume,
        beep,
        /** O AudioContext, ou null enquanto não houver gesto do utilizador. */
        get context() {
            return ctx;
        },
        get muted() {
            return muted;
        },
        set muted(value) {
            muted = !!value;
        },
        toggleMuted() {
            muted = !muted;
            return muted;
        }
    };
}
