// Menu: quem corre, o que se corre e onde.
//
// São dois ecrãs em vez de um só. O primeiro pergunta o mínimo — o nome (só a
// quem não tem sessão iniciada) e o modo; o segundo, já sabendo o modo, mostra
// as pistas e a dificuldade. Assim quem quer só dar uma volta não passa por uma
// parede de opções, e o campeonato não obriga a escolher uma pista que vai
// correr as três.
//
// A pista selecionada passa a ser a que o ciclo de desenho pinta por trás do
// vidro: o menu é uma janela para a pista, não um cartaz.

import { escapeHtml } from '/lib/arcade/index.js';
import { LAPS_REQUIRED, MODE_TOURNAMENT, TOURNAMENT_TRACKS } from './config.js';
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
        </span>
    </${tag}>`;
}

/** A pista que se vê por trás do vidro enquanto se escolhe. */
function previewTrack(index) {
    race.track = TRACKS[index];
    race.camera.x = race.track.cx;
    race.camera.y = race.track.cy;
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

    function showMenu() {
        overlays.show('start');
    }

    /** Segundo ecrã: pista (só na corrida rápida), dificuldade e arranque. */
    function showSetup(mode) {
        session.mode = mode;
        const tournament = mode === MODE_TOURNAMENT;

        els.setupTitle.textContent = tournament ? 'Campeonato' : 'Corrida simples';
        els.setupSub.textContent = tournament
            ? `Três pistas seguidas, ${LAPS_REQUIRED} voltas cada`
            : `Escolhe a pista · ${LAPS_REQUIRED} voltas`;

        els.trackRow.innerHTML = tournament
            ? TOURNAMENT_TRACKS.map((index, order) => trackCard(TRACKS[index], { index, order: order + 1 })).join('')
            : TRACKS.map((track, index) => trackCard(track, { index })).join('');

        if (tournament) previewTrack(TOURNAMENT_TRACKS[0]);
        else selectTrack(session.trackIdx);

        overlays.show('setup');
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

    bindAccount();
    previewTrack(session.trackIdx);

    return { showMenu, showSetup };
}
