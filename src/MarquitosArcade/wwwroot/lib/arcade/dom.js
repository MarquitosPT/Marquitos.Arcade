// Ajudas de DOM partilhadas pelos jogos.

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Procura vários elementos por id de uma vez: byId('a','b') -> { a, b }. */
export const byId = (...ids) =>
    Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

/**
 * Texto seguro para interpolar em innerHTML. Usa o próprio DOM para escapar, por
 * isso cobre tudo o que o browser considera markup — nomes do leaderboard vêm de
 * outros jogadores e não são de confiança.
 */
export function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

/**
 * Grupo de ecrãs sobrepostos (menu, pausa, fim de jogo) em que só um está visível.
 * @param {Record<string, HTMLElement>} overlays
 * @param {string} [display='flex'] O `display` a usar ao mostrar.
 */
export function createOverlays(overlays, display = 'grid') {
    const entries = Object.entries(overlays).filter(([, el]) => el);

    function hideAll() {
        for (const [, el] of entries) el.style.display = 'none';
    }

    return {
        hideAll,
        show(name) {
            hideAll();
            const el = overlays[name];
            if (el) el.style.display = display;
        },
        hide(name) {
            const el = overlays[name];
            if (el) el.style.display = 'none';
        },
        isVisible(name) {
            const el = overlays[name];
            return !!el && el.style.display !== 'none';
        }
    };
}

/**
 * Grupo de botões em que um está "active", ligado por data-attribute.
 * @param {HTMLElement} container Elemento pai; delega o clique.
 * @param {string} selector Selector dos botões (ex. '.diffBtn').
 * @param {(value: string, button: HTMLElement) => void} onSelect
 */
export function createButtonGroup(container, selector, onSelect) {
    if (!container) return { select() {} };

    function select(button) {
        if (!button) return;
        for (const sibling of container.querySelectorAll(selector)) {
            sibling.classList.toggle('active', sibling === button);
        }
    }

    container.addEventListener('click', (event) => {
        const button = event.target.closest(selector);
        if (!button || !container.contains(button)) return;
        select(button);
        onSelect(button.dataset.value ?? button.dataset.mode ?? button.dataset.lvl, button);
    });

    return { select };
}
