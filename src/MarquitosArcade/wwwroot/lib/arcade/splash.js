// Ecrã de arranque da arcada: logótipo, "A carregar..." e a barra a crescer.
//
// A parte visível é toda do splash.css — este módulo só trata do tempo.
// O que ele resolve é a tensão entre duas coisas que se querem ao mesmo tempo:
//
//   - o ecrã tem de estar no ar um mínimo de tempo (por omissão 2s, contando
//     já com a pausa na barra cheia e o fade de saída), mesmo quando o jogo
//     já está pronto em 200ms. É de propósito: dá à arcada o
//     arranque de uma consola em vez de um salto seco para o menu;
//   - e não pode ficar preso quando alguma coisa demora ou rebenta.
//
// Daí os três relógios: `minDuration` é o chão, `ready()` é o sinal de que o
// conteúdo por baixo está montado, e `maxDuration` é o teto que desiste de
// esperar por um `ready()` que nunca vem.
//
// A barra reflete o mesmo: cresce com o tempo até 92% e pára aí enquanto não
// houver `ready()`. Uma barra que chega aos 100% e fica à espera é pior do que
// uma barra que assume que ainda falta alguma coisa.

import { readSessionText, writeSessionText } from './storage.js';

const DEFAULTS = {
    /**
     * Quanto tempo o ecrã fica no ar, no mínimo — do arranque até ter
     * desaparecido. A barra enche no que sobra depois da pausa e do fade.
     */
    minDuration: 2000,
    /** Teto absoluto: passado isto sai, com ou sem `ready()`. */
    maxDuration: 12000,
    /** Fração até onde a barra cresce sem `ready()`. */
    stallAt: 0.92,
    /** Pausa com a barra cheia, antes de desaparecer. */
    holdAtFull: 220,
    /** Duração do fade de saída — tem de bater certo com o .is-leaving do CSS. */
    fadeDuration: 420,
    /** 'session' mostra o ecrã uma vez por separador; null mostra-o sempre. */
    once: null
};

const SESSION_KEY = 'arcade:splash-seen';

// A nota de regresso que o splash-skip.js lê (a mesma chave de lá; a validade vive lá).
const SKIP_KEY = 'arcade:splash-skip';

/**
 * Pede que a próxima visita a `path` abra sem ecrã de arranque — para uma
 * página de um jogo (o guia) que vai devolver o jogador ao jogo. A nota é de
 * uso único e caduca em segundos, por isso uma visita mais tarde, ou a outra
 * página, arranca como sempre. Quem a lê é o splash-skip.js, no <head> do jogo.
 */
export function skipSplashOnNextVisit(path) {
    // Sem o `index.html`: o jogo abre por `/games/<slug>/` e por `.../index.html`.
    writeSessionText(SKIP_KEY, JSON.stringify({ path: path.replace(/index\.html$/, ''), at: Date.now() }));
}

/**
 * Prende um ecrã de arranque já presente no DOM.
 *
 * @param {HTMLElement} root O elemento do ecrã (`#arcadeSplash`).
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {{ready: () => void, dismiss: () => void, reapply: () => void, done: Promise<void>}}
 */
export function createSplash(root, options = {}) {
    const config = { ...DEFAULTS, ...options };

    let resolveDone;
    const done = new Promise((resolve) => { resolveDone = resolve; });

    if (!root) {
        resolveDone();
        return { ready() {}, dismiss() {}, reapply() {}, done };
    }

    const fill = root.querySelector('.arcade-splash-fill');
    const track = root.querySelector('.arcade-splash-track');
    const logo = root.querySelector('.arcade-splash-logo');

    let isReady = false;
    let isFinished = false;
    let progress = 0;
    let frame = 0;
    const startedAt = performance.now();
    // A pausa com a barra cheia e o fade também contam para o `minDuration`:
    // antes somavam-se a ele e os "2s" ficavam perto dos 3s no ecrã.
    const fillDuration = Math.max(1, config.minDuration - config.holdAtFull - config.fadeDuration);

    // Já se viu o arranque neste separador: some sem sequer pintar um frame.
    // É o que separa o portal (arranca uma vez) dos jogos (arrancam sempre).
    // O mesmo quando se volta ao jogo de uma página dele (splash-skip.js).
    const skipped = document.documentElement.classList.contains('arcade-splash-skip');
    if (skipped || (config.once === 'session' && readSessionText(SESSION_KEY) === '1')) {
        hideNow();
        return { ready() {}, dismiss() {}, reapply, done };
    }
    if (config.once === 'session') writeSessionText(SESSION_KEY, '1');

    document.documentElement.classList.add('arcade-splash-lock');

    // O logótipo entra com fade quando chegar (ver .arcade-splash-logo no CSS).
    // `complete` cobre o caso de já estar em cache antes deste módulo correr.
    if (logo) {
        if (logo.complete) logo.classList.add('is-loaded');
        else logo.addEventListener('load', () => logo.classList.add('is-loaded'), { once: true });
        // Uma imagem que não carrega não pode deixar o ecrã vazio para sempre.
        logo.addEventListener('error', () => logo.classList.add('is-loaded'), { once: true });
    }

    frame = requestAnimationFrame(tick);

    function tick(now) {
        const elapsed = now - startedAt;
        if (elapsed >= config.maxDuration) isReady = true;

        const byTime = elapsed / fillDuration;
        const target = isReady ? byTime : Math.min(byTime, config.stallAt);
        // Monotónica: a barra nunca anda para trás, nem quando o `ready()` chega
        // depois de o tempo já ter passado o chão.
        progress = Math.min(1, Math.max(progress, target));
        paint(progress);

        if (progress >= 1) finish();
        else frame = requestAnimationFrame(tick);
    }

    function paint(value) {
        const percent = Math.round(value * 100);
        if (fill) fill.style.width = `${percent}%`;
        if (track) track.setAttribute('aria-valuenow', String(percent));
    }

    function finish() {
        if (isFinished) return;
        isFinished = true;
        cancelAnimationFrame(frame);
        paint(1);

        setTimeout(() => {
            root.classList.add('is-leaving');
            setTimeout(hideNow, config.fadeDuration);
        }, config.holdAtFull);
    }

    function hideNow() {
        isFinished = true;
        cancelAnimationFrame(frame);
        root.hidden = true;
        root.classList.remove('is-leaving');
        document.documentElement.classList.remove('arcade-splash-lock');
        resolveDone();
    }

    /**
     * Volta a esconder o ecrã se ele reaparecer.
     *
     * A enhanced navigation do Blazor volta a sincronizar o <body> com o HTML
     * que o servidor mandou — e esse HTML traz sempre o ecrã de arranque. Sem
     * isto, ir de /  para /pontuacoes trazia o ecrã de volta, agora sem
     * ninguém para o tirar (o módulo só corre uma vez por documento).
     */
    function reapply() {
        if (!isFinished) return;
        const current = document.getElementById(root.id) || root;
        current.hidden = true;
        current.classList.remove('is-leaving');
        document.documentElement.classList.remove('arcade-splash-lock');
    }

    return {
        /** O conteúdo por baixo está pronto; a barra pode chegar ao fim. */
        ready() {
            isReady = true;
        },
        /** Fecha já, sem esperar pelo tempo mínimo (usado pelos testes). */
        dismiss: hideNow,
        reapply,
        /** Resolve quando o ecrã sai da frente. */
        done
    };
}
