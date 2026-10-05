// Menu: quem joga, com que bicho, em que nível, e o que já se fez.
//
// Dois ecrãs, como no Maze Run: o primeiro pergunta o nome (só a quem não tem
// sessão iniciada) e o bicho, e propõe continuar de onde se ficou; o segundo
// mostra os níveis no carrossel do SDK (lib/arcade/carousel.js).
//
// Por trás do vidro está o início do nível apontado, com o bicho escolhido a
// saltitar na partida: o menu é uma janela para o nível, não um cartaz.

import { createCarousel, escapeHtml, readText, writeText } from '/lib/arcade/index.js';

import { ANIMALS, animalById, paintPortrait } from './animals.js';
import { layoutView, snapCamera } from './camera.js';
import { ANIMAL_STORAGE_KEY, MAX_STARS } from './config.js';
import { fmtPoints, fmtTime } from './format.js';
import { prepareWorld } from './level.js';
import { LEVELS, levelById, levelCount } from './levels.js';
import { bestOf, isUnlocked, progress, totalScore, totalStars, unlockedCount } from './progress.js';
import { game, session } from './state.js';
import { THEMES } from './themes.js';
import { els, overlays } from './ui.js';
import { groundProfile } from './world.js';

/** As etiquetas do que cada nível apresenta, nos cartões. */
const FEATURE_TAGS = {
    jelly: ['🍮', 'geleias'],
    hedgehog: ['🦔', 'ouriços'],
    bees: ['🐝', 'abelhas'],
    plants: ['🪴', 'plantas carnívoras'],
    bombs: ['💣', 'bombas relógio'],
    spikes: ['🔺', 'picos'],
    pillars: ['🏛️', 'pilares'],
    springs: ['🌀', 'molas'],
    lifts: ['🛗', 'elevadores'],
    movers: ['↔️', 'plataformas'],
    crumble: ['🍪', 'bolachas']
};

/** Os percursos do menu montam-se uma vez — são sempre os mesmos. */
const worlds = new Map();

function worldFor(level) {
    if (!worlds.has(level.id)) {
        const world = prepareWorld(level);
        world.level = level;
        worlds.set(level.id, world);
    }
    return worlds.get(level.id);
}

/**
 * O perfil do percurso no cartão: o chão de uma ponta à outra, com os buracos
 * à vista. É o percurso que se vai jogar, e não uma ilustração.
 */
function profileSvg(level, { locked }) {
    const world = worldFor(level);
    const profile = groundProfile(world);
    const rows = world.rows;
    let d = '';
    let open = false;
    profile.forEach((top, c) => {
        if (top >= rows) {
            if (open) d += `L${c} ${rows}Z`;
            open = false;
            return;
        }
        d += open ? `L${c} ${top}L${c + 1} ${top}` : `M${c} ${rows}L${c} ${top}L${c + 1} ${top}`;
        open = true;
    });
    if (open) d += `L${profile.length} ${rows}Z`;
    const theme = THEMES[level.theme];
    // Só a faixa de baixo do mundo interessa: lá em cima é céu.
    const top = 3;
    return `<svg class="routeShape${locked ? ' is-locked' : ''}" viewBox="0 ${top} ${world.cols} ${rows - top}"
        preserveAspectRatio="none" aria-hidden="true"
        style="--sky-a: ${theme.sky[0]}; --sky-b: ${theme.sky[1]}; --ground: ${theme.grass}; --level-accent: ${level.accent}">
        <path class="routeGround" d="${d}"></path>
    </svg>`;
}

function starRow(stars) {
    const filled = Math.max(0, Math.min(MAX_STARS, stars || 0));
    const dots = Array.from({ length: MAX_STARS }, (_, i) => `<i class="${i < filled ? '' : 'off'}">★</i>`).join('');
    return `<span class="levelStars" role="img" aria-label="${filled} de ${MAX_STARS} estrelas">${dots}</span>`;
}

/** O que o nível apresenta de novo. A linha existe mesmo vazia (altura dos cartões). */
function levelTags(level) {
    const chips = (level.focus || [])
        .map((feature) => {
            const [icon, label] = FEATURE_TAGS[feature];
            return `<span class="levelTag" title="${label}"><i aria-hidden="true">${icon}</i>${escapeHtml(label.split(' ')[0])}</span>`;
        })
        .join('');
    return `<span class="levelTags">${chips}</span>`;
}

/**
 * Um cartão de nível: sempre as mesmas cinco linhas, pela mesma ordem —
 * número, nome, novidades, estado e estrelas — para os cartões terem todos a
 * mesma altura (ver a nota do carrossel no README).
 */
function levelCard(level) {
    const unlocked = isUnlocked(level.id);
    const best = bestOf(level.id);
    const total = worldFor(level).candies.length;

    const state = !unlocked
        ? `Conclui o nível ${level.id - 1}`
        : best
            ? `${fmtTime(best.ms)} · ${best.candies || 0}/${total} 🍬`
            : `Por jogar · ${total} 🍬`;

    const label = unlocked
        ? `Nível ${level.id}, ${level.name}`
        : `Nível ${level.id}, ${level.name} — bloqueado, conclui o nível ${level.id - 1}`;

    return `<button type="button" class="levelCard${unlocked ? '' : ' is-locked'}"
        data-value="${level.id}" aria-label="${escapeHtml(label)}" style="--card-accent: ${level.accent}">
        <span class="levelShape">
            ${profileSvg(level, { locked: !unlocked })}
            ${unlocked ? '' : '<span class="levelLock" aria-hidden="true">🔒</span>'}
        </span>
        <span class="levelInfo">
            <span class="levelNumber">Nível ${level.id}</span>
            <span class="levelName">${escapeHtml(level.name)}</span>
            ${levelTags(level)}
            <span class="levelState">${escapeHtml(state)}</span>
            ${starRow(best?.stars)}
        </span>
    </button>`;
}

/** O início do nível apontado, por trás do vidro. */
export function previewLevel(levelId) {
    const level = levelById(levelId);
    if (!level) return;
    game.menuWorld = worldFor(level);
    layoutView();
    snapCamera(game.menuWorld, game.menuWorld.spawn.x, game.menuWorld.spawn.y, 1);
    document.documentElement.style.setProperty('--level-accent', level.accent);
}

export function createMenu({ playerName, onPlay }) {
    const carousel = createCarousel({
        root: els.levelsCarousel,
        viewport: els.levelViewport,
        track: els.levelGrid,
        prev: els.prevPageBtn,
        next: els.nextPageBtn,
        dots: els.levelDots
    }, { pageClass: 'levelPage', onRender: markSelected });

    // ---------- O bicho ----------

    session.animalId = animalById(readText(ANIMAL_STORAGE_KEY)).id;

    els.animalPicker.innerHTML = ANIMALS.map((animal) => `
        <button type="button" class="animalBtn" role="radio" data-value="${animal.id}"
                aria-label="${escapeHtml(`${animal.name}, ${animal.species}`)}" style="--animal-color: ${animal.fur}">
            <canvas class="animalPortrait" width="72" height="88" aria-hidden="true"></canvas>
            <span class="animalName">${escapeHtml(animal.name)}</span>
        </button>`).join('');

    function paintAnimals() {
        for (const btn of els.animalPicker.querySelectorAll('.animalBtn')) {
            const chosen = btn.dataset.value === session.animalId;
            btn.classList.toggle('active', chosen);
            btn.setAttribute('aria-checked', String(chosen));
            paintPortrait(btn.querySelector('canvas'), animalById(btn.dataset.value), { happy: chosen });
        }
    }

    els.animalPicker.addEventListener('click', (event) => {
        const btn = event.target.closest('.animalBtn');
        if (!btn) return;
        session.animalId = btn.dataset.value;
        writeText(ANIMAL_STORAGE_KEY, session.animalId);
        paintAnimals();
    });

    // ---------- A conta ----------

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

    // ---------- O progresso ----------

    function refreshProgress() {
        const open = unlockedCount();
        const total = levelCount();
        els.progressLine.textContent = `${open} de ${total} níveis · ${totalStars()} de ${total * MAX_STARS} estrelas`;
        els.progressBar.style.setProperty('--fill', `${Math.round((open / total) * 100)}%`);
        els.progressNote.hidden = progress.stored;
        const level = levelById(open);
        els.playBtn.textContent = `${bestOf(open) ? 'Repetir' : 'Jogar'} o nível ${open} · ${level.name}`;
    }

    function showMenu() {
        game.menuLevelId = unlockedCount();
        refreshProgress();
        previewLevel(game.menuLevelId);
        overlays.show('start');
        // Os retratos só se pintam com o ecrã à vista: antes disso o canvas não tem tamanho.
        requestAnimationFrame(paintAnimals);
    }

    function showLevels() {
        refreshProgress();
        els.levelsSub.textContent = `Escolhe por onde recomeçar · ${fmtPoints(totalScore())} pontos até agora`;
        overlays.show('levels');
        carousel.setCards(LEVELS.map(levelCard), { show: LEVELS.findIndex((level) => level.id === game.menuLevelId) });
    }

    function markSelected() {
        for (const card of els.levelGrid.querySelectorAll('.levelCard')) {
            card.classList.toggle('active', Number(card.dataset.value) === game.menuLevelId);
        }
    }

    window.addEventListener('keydown', (event) => {
        if (!overlays.isVisible('levels')) return;
        if (carousel.handleKey(event.key)) event.preventDefault();
    });

    els.levelGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.levelCard');
        if (!card) return;
        const levelId = Number(card.dataset.value);
        if (!isUnlocked(levelId)) {
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 400);
            return;
        }
        game.menuLevelId = levelId;
        markSelected();
        previewLevel(levelId);
        onPlay(levelId);
    });

    // Rodar o aparelho muda o tamanho dos retratos.
    window.addEventListener('resize', () => {
        if (overlays.isVisible('start')) paintAnimals();
    });

    bindAccount();

    return { showMenu, showLevels, refreshProgress };
}
