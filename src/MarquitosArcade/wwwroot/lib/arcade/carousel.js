// Carrossel de páginas de cartões, partilhado pela arcada (ver o menu de
// níveis do Maze Run, que usa a mesma receita).
//
// Quantos cartões cabem numa página não se decide aqui: lê-se do CSS, nas
// variáveis `--page-cols` e `--page-rows` do elemento raiz. Quem sabe o
// tamanho do ecrã é o CSS, e assim há um sítio só a dizer quantos cartões
// cabem num telemóvel e num computador — em vez de uma regra no CSS e outra,
// a repeti-la, em JavaScript.
//
// Passa-se de página de três maneiras: pelas setas, arrastando (o dedo ou o
// rato) e com as setas do teclado. O arrasto é feito à mão, com eventos de
// ponteiro, e não com o scroll horizontal do browser — quem usa este
// carrossel dentro de uma caixa que já rola verticalmente precisa de travar
// aí o gesto lateral (`touch-action: pan-y`), senão essa trava alcançaria
// também um scroll nativo cá dentro.

/** Parte da largura que é preciso arrastar para a página virar. */
const SWIPE_THRESHOLD = 0.22;

/** Arrasto mais curto do que isto ainda conta, se for rápido (px/ms). */
const FLICK_VELOCITY = 0.45;

/** Antes disto, um arrasto ainda não decidiu se é horizontal ou vertical. */
const DIRECTION_LOCK = 8;

/**
 * @param {object} elements
 * @param {HTMLElement} elements.root Onde vivem as variáveis de página.
 * @param {HTMLElement} elements.viewport A janela por onde se vê uma página.
 * @param {HTMLElement} elements.track As páginas, lado a lado.
 * @param {HTMLElement} elements.prev
 * @param {HTMLElement} elements.next
 * @param {HTMLElement} elements.dots
 * @param {object} [options]
 * @param {string} [options.pageClass='carouselPage'] Classe de cada página.
 * @param {(page: number, pageCount: number) => void} [options.onPageChange]
 */
export function createCarousel({ root, viewport, track, prev, next, dots }, { pageClass = 'carouselPage', onPageChange = null } = {}) {
    /** Os cartões, em HTML, tal como quem usa o carrossel os entregou. */
    let cards = [];
    let page = 0;
    let pageCount = 1;
    let perPage = 1;

    // ---------- Páginas ----------

    /** Quantos cartões cabem numa página, segundo o CSS. */
    function readPageSize() {
        const style = getComputedStyle(root);
        const cols = parseInt(style.getPropertyValue('--page-cols'), 10) || 1;
        const rows = parseInt(style.getPropertyValue('--page-rows'), 10) || 1;
        return Math.max(1, cols * rows);
    }

    /**
     * Reconstrói as páginas. `keepCard` é o índice de um cartão que tem de
     * continuar à vista — ao rodar o aparelho, o número por página muda e o
     * cartão que estava escolhido não pode desaparecer.
     */
    function render(keepCard = page * perPage) {
        perPage = readPageSize();
        pageCount = Math.max(1, Math.ceil(cards.length / perPage));

        const pages = [];
        for (let i = 0; i < cards.length; i += perPage) {
            pages.push(`<div class="${pageClass}">${cards.slice(i, i + perPage).join('')}</div>`);
        }
        track.innerHTML = pages.join('');

        renderDots();
        root.classList.toggle('is-single', pageCount <= 1);
        goTo(Math.floor(keepCard / perPage), { animate: false });
    }

    function renderDots() {
        if (!dots) return;
        dots.innerHTML = Array.from({ length: pageCount }, (_, i) =>
            `<button type="button" class="carouselDot" data-page="${i}" role="tab"
                aria-label="Página ${i + 1} de ${pageCount}"></button>`).join('');
    }

    // ---------- Navegação ----------

    function goTo(index, { animate = true } = {}) {
        const target = Math.max(0, Math.min(pageCount - 1, index));
        const changed = target !== page;
        page = target;

        track.style.transition = animate ? '' : 'none';
        setOffset(-page * 100, '%');
        if (!animate) {
            // Força o browser a assentar a posição antes de devolver a transição,
            // senão o próximo salto anima a partir do sítio errado.
            void track.offsetWidth;
            track.style.transition = '';
        }

        if (prev) prev.disabled = page === 0;
        if (next) next.disabled = page >= pageCount - 1;
        for (const dot of dots ? dots.querySelectorAll('.carouselDot') : []) {
            const active = Number(dot.dataset.page) === page;
            dot.classList.toggle('active', active);
            dot.setAttribute('aria-selected', String(active));
        }

        if (changed && onPageChange) onPageChange(page, pageCount);
    }

    const setOffset = (value, unit) => {
        track.style.transform = `translate3d(${value}${unit}, 0, 0)`;
    };

    /** Leva à vista a página onde está um cartão. */
    const showCard = (index, options) => goTo(Math.floor(Math.max(0, index) / perPage), options);

    // ---------- Arrasto ----------

    let drag = null;
    /**
     * Arrastar acaba sempre com o dedo em cima de alguma coisa — e essa coisa é
     * quase sempre um cartão. Sem isto, virar a página ativava o cartão que
     * calhasse estar por baixo do dedo.
     */
    let swallowClick = false;

    function onPointerDown(event) {
        // Só o botão principal do rato, e nunca em cima de um botão do carrossel.
        if (event.button !== undefined && event.button !== 0) return;
        if (pageCount <= 1) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), axis: null };
    }

    function onPointerMove(event) {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;

        if (!drag.axis) {
            if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
            // O primeiro movimento decide de quem é o gesto: às direitas é do
            // carrossel, a subir ou a descer é do painel a rolar.
            drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (drag.axis === 'x') {
                track.style.transition = 'none';
                viewport.setPointerCapture?.(drag.id);
            }
        }
        if (drag.axis !== 'x') return;

        event.preventDefault();
        swallowClick = true;
        // Nas pontas o arrasto fica pesado, em vez de descolar: sente-se que
        // não há mais páginas daquele lado.
        const width = viewport.clientWidth || 1;
        const atEdge = (dx > 0 && page === 0) || (dx < 0 && page >= pageCount - 1);
        const moved = (atEdge ? dx * 0.32 : dx) / width * 100;
        setOffset(-page * 100 + moved, '%');
    }

    function onPointerUp(event) {
        if (!drag || event.pointerId !== drag.id) return;
        const { axis, x, t } = drag;
        drag = null;
        if (axis !== 'x') return;

        viewport.releasePointerCapture?.(event.pointerId);
        track.style.transition = '';

        const dx = event.clientX - x;
        const velocity = Math.abs(dx) / Math.max(1, performance.now() - t);
        const enough = Math.abs(dx) > viewport.clientWidth * SWIPE_THRESHOLD || velocity > FLICK_VELOCITY;

        if (enough && dx < 0) goTo(page + 1);
        else if (enough && dx > 0) goTo(page - 1);
        else goTo(page);
    }

    function onPointerCancel() {
        if (drag?.axis === 'x') {
            track.style.transition = '';
            goTo(page);
        }
        drag = null;
    }

    // Em fase de captura, para chegar antes de quem estiver à escuta nos cartões.
    viewport.addEventListener('click', (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.stopPropagation();
        event.preventDefault();
    }, true);

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove, { passive: false });
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerCancel);
    // Um arrasto que comece aqui e acabe fora não pode deixar a página a meio.
    window.addEventListener('pointerup', onPointerUp);

    prev?.addEventListener('click', () => goTo(page - 1));
    next?.addEventListener('click', () => goTo(page + 1));
    dots?.addEventListener('click', (event) => {
        const dot = event.target.closest('.carouselDot');
        if (dot) goTo(Number(dot.dataset.page));
    });

    // Rodar o aparelho muda quantos cabem por página; o cartão que estava à
    // vista tem de continuar à vista.
    window.addEventListener('resize', () => {
        if (!cards.length) return;
        const first = page * perPage;
        if (readPageSize() !== perPage) render(first);
    });

    return {
        /** Os cartões, em HTML. Reparte-os por páginas e mostra a primeira. */
        setCards(html, { show = 0 } = {}) {
            cards = html;
            render(show);
        },
        goTo,
        showCard,
        get page() { return page; },
        get pageCount() { return pageCount; },
        get perPage() { return perPage; },
        /** As setas do teclado, para quem navega sem rato nem dedo. */
        handleKey(key) {
            if (key === 'ArrowRight') { goTo(page + 1); return true; }
            if (key === 'ArrowLeft') { goTo(page - 1); return true; }
            return false;
        }
    };
}
