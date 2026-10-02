// Menu: quem corre, o que se corre e onde.
//
// São dois ecrãs em vez de um só. O primeiro pergunta o mínimo — o nome (só a
// quem não tem sessão iniciada) e o modo; o segundo, já sabendo o modo, mostra
// as pistas e a dificuldade. Assim quem quer só dar uma volta não passa por uma
// parede de opções, e o campeonato não obriga a escolher uma pista que vai
// correr as três — aí escolhe-se a taça, e as três pistas dela mostram-se pela
// ordem em que se correm.
//
// O segundo ecrã tem duas páginas no mesmo painel: a pista e, a seguir, a
// garagem (carro e cor). São páginas e não janelas: o painel fica onde está e
// só o conteúdo desliza, com os passos no cabeçalho a dizer onde se vai. Abrir
// a garagem por cima da escolha da pista dava a sensação de janelas empilhadas.
//
// A pista selecionada passa a ser a que o ciclo de desenho pinta por trás do
// vidro: o menu é uma janela para a pista, não um cartaz.

import { escapeHtml } from '/lib/arcade/index.js';
import { readText, writeText } from '/lib/arcade/storage.js';

import {
    CAR_COLORS, CAR_TYPE_STORAGE_KEY, CAR_TYPES, COLOR_STORAGE_KEY, LAPS_REQUIRED,
    MODE_TOURNAMENT, TOURNAMENT_CUPS
} from './config.js';
import { drawCarSide } from './carsprites.js';
import { menuZoom } from './race.js';
import { race, session } from './state.js';
import { THEME_INFO, TRACKS } from './tracks.js';
import { els, overlays } from './ui.js';

/** Caixa do desenho da pista nos cartões, em unidades do viewBox do SVG. */
const PREVIEW = { w: 120, h: 76, pad: 12 };

/**
 * Metros "de pista" a partir do comprimento em unidades do mundo. Não há escala
 * oficial no jogo; 10 unidades por metro dá números na ordem de um kartódromo,
 * que é o que se quer mostrar no cartão.
 */
const WORLD_UNITS_PER_METRE = 10;

/** Quantos pontinhos tem a escala de perícia (ver `corneringProfile`). */
const GRADE_STEPS = 4;

/**
 * Desenho da pista para o cartão: a linha central levada a dois traços — um
 * largo para o asfalto, um fino por cima — mais a linha de partida. As
 * coordenadas são as da própria pista, normalizadas para a caixa do cartão, por
 * isso o cartão mostra mesmo a forma que se vai correr.
 */
function trackPreviewSvg(track) {
    const scale = Math.min(
        (PREVIEW.w - PREVIEW.pad * 2) / track.bbox.w,
        (PREVIEW.h - PREVIEW.pad * 2) / track.bbox.h
    );
    const offsetX = (PREVIEW.w - track.bbox.w * scale) / 2 - track.bbox.minX * scale;
    const offsetY = (PREVIEW.h - track.bbox.h * scale) / 2 - track.bbox.minY * scale;
    const toBox = (p) => `${(p.x * scale + offsetX).toFixed(1)},${(p.y * scale + offsetY).toFixed(1)}`;

    const points = [];
    for (let i = 0; i < track.N; i += 4) points.push(toBox(track.pts[i]));

    // Um pouco mais curta do que a pista para a linha ficar dentro do asfalto.
    const p0 = track.pts[0], n0 = track.norm[0], half = track.halfWidth * 0.82;
    const start = [
        toBox({ x: p0.x + n0.x * half, y: p0.y + n0.y * half }),
        toBox({ x: p0.x - n0.x * half, y: p0.y - n0.y * half })
    ].map((pair) => pair.split(','));

    return `<svg class="trackShape" viewBox="0 0 ${PREVIEW.w} ${PREVIEW.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <polygon class="trackEdge" points="${points.join(' ')}"></polygon>
        <polygon class="trackLine" points="${points.join(' ')}"></polygon>
        <line class="trackStart" x1="${start[0][0]}" y1="${start[0][1]}" x2="${start[1][0]}" y2="${start[1][1]}"></line>
    </svg>`;
}

function trackMeta(track) {
    const theme = THEME_INFO[track.theme] || { emoji: '🏁', label: '' };
    const metres = Math.round(track.total / WORLD_UNITS_PER_METRE);
    return `${theme.emoji} ${theme.label} · ${metres} m`;
}

/**
 * O grau de perícia da pista, em pontinhos. O número vem da geometria (ver
 * `corneringProfile`), portanto o cartão diz mesmo o que a pista exige — quem
 * escolhe sabe de antemão se vai poder passar a fundo ou se vai ter de travar.
 */
function trackGrade(track) {
    const dots = Array.from({ length: GRADE_STEPS }, (_, i) => `<i class="${i < track.grade ? '' : 'off'}"></i>`).join('');
    return `<span class="trackGrade" role="img" aria-label="Perícia ${track.grade} de ${GRADE_STEPS}">${dots}</span>`;
}

function trackCard(track, { index, order = null }) {
    const tag = order === null ? 'button' : 'div';
    const attrs = order === null
        ? ` type="button" class="trackCard" data-value="${index}"`
        : ' class="trackCard is-static"';
    const badge = order === null ? '' : `<span class="trackOrder">Corrida ${order}</span>`;
    return `<${tag}${attrs}>
        ${trackPreviewSvg(track)}
        <span class="trackInfo">
            ${badge}
            <span class="trackName">${escapeHtml(track.name)}</span>
            <span class="trackMeta">${trackMeta(track)}</span>
            <span class="trackMeta">Perícia ${trackGrade(track)}</span>
        </span>
    </${tag}>`;
}

/**
 * Amostras de cor. Ficam na garagem, ao lado do carro: a cor vê-se logo nas
 * miniaturas, tal como vai aparecer na pista.
 */
function colorSwatches() {
    return CAR_COLORS.map((color) => `<button type="button" class="colorBtn" data-value="${color.value}"
        style="--swatch: ${color.value}" title="${color.name}" aria-label="Cor ${color.name}"></button>`).join('');
}

/** As barras dos cartões da garagem, pela ordem em que aparecem. */
const CAR_RATINGS = [
    ['speed', 'Velocidade'],
    ['accel', 'Aceleração'],
    ['handling', 'Curvas'],
    ['offroad', 'Fora de pista']
];
const RATING_STEPS = 5;

/**
 * Resolução da miniatura do carro, em pixels do canvas. O CSS encolhe-a para a
 * largura do cartão; o dobro do que se vê chega para ficar nítida num ecrã de
 * alta densidade.
 */
const CAR_PREVIEW = { w: 360, h: 156 };

function carCard(type) {
    const bars = CAR_RATINGS.map(([key, label]) => {
        const value = type.rating[key];
        const dots = Array.from({ length: RATING_STEPS }, (_, i) => `<i class="${i < value ? '' : 'off'}"></i>`).join('');
        return `<span class="carStat"><span class="carStatLabel">${label}</span>
            <span class="carStatBar" role="img" aria-label="${label} ${value} de ${RATING_STEPS}">${dots}</span></span>`;
    }).join('');
    return `<button type="button" class="carCard" data-value="${type.id}" aria-label="${escapeHtml(type.name)}">
        <canvas class="carPreview" width="${CAR_PREVIEW.w}" height="${CAR_PREVIEW.h}" aria-hidden="true"></canvas>
        <span class="carName">${escapeHtml(type.name)}</span>
        <span class="carBlurb">${escapeHtml(type.blurb)}</span>
        <span class="carStats">${bars}</span>
    </button>`;
}

/**
 * Desenha a miniatura de perfil, na cor escolhida. Na pista o carro vê-se de
 * cima, mas para escolher é o perfil que diz que carro é — um 911 conhece-se
 * pelo tejadilho a descer em fastback, não pela planta.
 */
function drawCarPreview(canvas, typeId, color) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    drawCarSide(c, typeId, color, canvas.width, canvas.height);
}

/** A pista que se vê por trás do vidro enquanto se escolhe. */
function previewTrack(index) {
    race.track = TRACKS[index];
    race.camera.x = race.track.cx;
    race.camera.y = race.track.cy;
    race.zoom = menuZoom();
}

export function createMenu({ playerName }) {
    /**
     * Quem tem sessão iniciada corre com o nome da conta — é esse que o servidor
     * guarda no quadro de pontuações, portanto pedir outro seria mentir ao
     * jogador. A visitantes mostra-se o campo.
     */
    function bindAccount() {
        playerName.account.then((displayName) => {
            const signedIn = !!displayName;
            els.nameRow.hidden = signedIn;
            els.accountRow.hidden = !signedIn;
            if (signedIn) {
                els.accountName.textContent = displayName;
                els.accountInitial.textContent = [...displayName][0].toUpperCase();
            }
            els.nameSlot.classList.remove('is-pending');
        });
    }

    /**
     * A cor escolhida fica guardada neste aparelho, como o nome: quem gosta de
     * correr de verde não quer voltar a escolher verde a cada visita.
     */
    function bindColors() {
        const stored = readText(COLOR_STORAGE_KEY);
        if (CAR_COLORS.some((color) => color.value === stored)) session.playerColor = stored;

        els.colorRow.innerHTML = colorSwatches();
        markColor();

        els.colorRow.addEventListener('click', (event) => {
            const swatch = event.target.closest('.colorBtn');
            if (!swatch) return;
            session.playerColor = swatch.dataset.value;
            writeText(COLOR_STORAGE_KEY, session.playerColor);
            markColor();
            paintCarPreviews();
        });
    }

    function markColor() {
        for (const swatch of els.colorRow.querySelectorAll('.colorBtn')) {
            swatch.classList.toggle('active', swatch.dataset.value === session.playerColor);
        }
    }

    /** O tipo de carro fica guardado neste aparelho, como a cor. */
    function bindCars() {
        const stored = readText(CAR_TYPE_STORAGE_KEY);
        if (CAR_TYPES.some((type) => type.id === stored)) session.playerCarType = stored;

        els.carRow.innerHTML = CAR_TYPES.map(carCard).join('');
        markCar();
        paintCarPreviews();

        els.carRow.addEventListener('click', (event) => {
            const card = event.target.closest('.carCard');
            if (!card) return;
            session.playerCarType = card.dataset.value;
            writeText(CAR_TYPE_STORAGE_KEY, session.playerCarType);
            markCar();
        });
    }

    function markCar() {
        for (const card of els.carRow.querySelectorAll('.carCard')) {
            const active = card.dataset.value === session.playerCarType;
            card.classList.toggle('active', active);
            card.setAttribute('aria-pressed', String(active));
        }
    }

    function paintCarPreviews() {
        for (const card of els.carRow.querySelectorAll('.carCard')) {
            drawCarPreview(card.querySelector('.carPreview'), card.dataset.value, session.playerColor);
        }
    }

    /**
     * Mostra uma das páginas do painel de preparação. `forward` diz para que
     * lado desliza o conteúdo novo: a avançar entra pela direita, a recuar pela
     * esquerda — o mesmo sentido dos passos no cabeçalho.
     */
    let page = 'track';
    function showPage(name, { forward = true } = {}) {
        page = name;
        const garage = name === 'garage';
        els.trackPage.hidden = garage;
        els.garagePage.hidden = !garage;
        els.setupPanel.dataset.dir = forward ? 'forward' : 'back';
        // Recomeça a animação de entrada mesmo que a página já tenha estado à vista.
        const shown = garage ? els.garagePage : els.trackPage;
        shown.style.animation = 'none';
        void shown.offsetWidth;
        shown.style.animation = '';

        for (const step of els.setupSteps.querySelectorAll('.step')) {
            const current = step.dataset.step === name;
            step.classList.toggle('is-current', current);
            step.classList.toggle('is-done', garage && step.dataset.step === 'track');
            if (current) step.setAttribute('aria-current', 'step');
            else step.removeAttribute('aria-current');
        }
        els.setupSub.textContent = garage ? 'Escolhe o carro e a cor' : trackSubtitle();
        els.backBtn.setAttribute('aria-label', garage ? 'Voltar à pista' : 'Voltar ao menu');
        els.setupScreen.scrollTop = 0;
    }

    function trackSubtitle() {
        return session.mode === MODE_TOURNAMENT
            ? `Três pistas seguidas, ${LAPS_REQUIRED} voltas cada`
            : `Escolhe a pista · ${LAPS_REQUIRED} voltas`;
    }

    function showGarage() {
        showPage('garage');
    }

    /** O botão de voltar recua uma página; da primeira, volta ao menu. */
    function back() {
        if (page === 'garage') showPage('track', { forward: false });
        else showMenu();
    }

    function showMenu() {
        overlays.show('start');
    }

    /** Segundo ecrã: taça ou pista (conforme o modo), dificuldade e arranque. */
    function showSetup(mode) {
        session.mode = mode;
        const tournament = mode === MODE_TOURNAMENT;

        els.setupTitle.textContent = tournament ? 'Campeonato' : 'Corrida simples';

        els.cupField.hidden = !tournament;
        if (tournament) {
            els.cupRow.innerHTML = TOURNAMENT_CUPS
                .map((cup, index) => `<button type="button" class="cupBtn" data-value="${index}">${escapeHtml(cup.name)}</button>`)
                .join('');
            selectCup(session.cupIdx);
        } else {
            els.trackRow.innerHTML = TRACKS.map((track, index) => trackCard(track, { index })).join('');
            selectTrack(session.trackIdx);
        }

        overlays.show('setup');
        showPage('track');
    }

    /**
     * No campeonato não se escolhe pista: escolhe-se a taça, e as três pistas
     * dela ficam à vista pela ordem em que se correm. Por trás do vidro mostra-se
     * a primeira, que é por onde a coisa começa.
     */
    function selectCup(index) {
        session.cupIdx = index;
        const cup = TOURNAMENT_CUPS[index];
        for (const button of els.cupRow.querySelectorAll('.cupBtn')) {
            button.classList.toggle('active', Number(button.dataset.value) === index);
        }
        els.trackRow.innerHTML = cup.tracks
            .map((trackIdx, order) => trackCard(TRACKS[trackIdx], { index: trackIdx, order: order + 1 }))
            .join('');
        previewTrack(cup.tracks[0]);
    }

    function selectTrack(index) {
        session.trackIdx = index;
        for (const card of els.trackRow.querySelectorAll('.trackCard[data-value]')) {
            card.classList.toggle('active', Number(card.dataset.value) === index);
        }
        previewTrack(index);
    }

    els.trackRow.addEventListener('click', (event) => {
        const card = event.target.closest('.trackCard[data-value]');
        if (card) selectTrack(Number(card.dataset.value));
    });

    els.cupRow.addEventListener('click', (event) => {
        const button = event.target.closest('.cupBtn');
        if (button) selectCup(Number(button.dataset.value));
    });

    bindAccount();
    bindColors();
    bindCars();
    previewTrack(session.trackIdx);

    return { showMenu, showSetup, showGarage, back };
}
