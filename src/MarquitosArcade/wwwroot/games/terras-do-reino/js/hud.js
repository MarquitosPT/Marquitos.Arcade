// O HUD: o dia, o povo, o contentamento, os bens e o objetivo do momento.
//
// Os chips dos bens montam-se uma vez e depois só se lhes muda o texto — o
// HUD atualiza-se quatro vezes por segundo e reconstruir o HTML de cada vez
// fazia o browser recalcular o layout à toa.
//
// Um bem só aparece depois de o reino o ter tido: no começo vê-se moedas,
// madeira e pedra, e o resto vai-se juntando à medida que o reino cresce.

import { RESOURCES, SPEEDS } from './config.js';
import { fmtShort, pct } from './format.js';
import { currentQuest } from './quests.js';
import { game } from './state.js';
import { els } from './ui.js';

const ALWAYS = new Set(['coins', 'wood', 'stone']);
const chips = new Map();
const seen = new Set(ALWAYS);
let lastValues = {};

function chipFor(res) {
    let chip = chips.get(res.id);
    if (chip) return chip;
    const el = document.createElement('span');
    el.className = `resChip${res.id === 'coins' ? ' is-coins' : ''}`;
    el.title = res.name;
    el.innerHTML = `<span class="resEmoji" aria-hidden="true">${res.emoji}</span><span class="resValue"></span>`;
    chip = { el, value: el.querySelector('.resValue') };
    chips.set(res.id, chip);
    return chip;
}

/** Recomeça do zero (partida nova ou outra gravação). */
export function resetHud() {
    seen.clear();
    for (const id of ALWAYS) seen.add(id);
    lastValues = {};
    els.resRow.textContent = '';
    chips.clear();
}

export function updateHud() {
    const d = game.derived;
    els.dayPill.textContent = `☀️ Dia ${game.day}`;
    els.popPill.textContent = `👥 ${d.workersUsed}/${d.residents}`;
    const face = game.happy >= 0.8 ? '😄' : game.happy >= 0.6 ? '🙂' : '😐';
    els.happyPill.textContent = `${face} ${pct(game.happy)}`;
    els.speedBtn.textContent = `⏩ ${game.speed}x`;
    els.speedBtn.setAttribute('aria-label', `Velocidade do tempo: ${game.speed}x (de ${SPEEDS.join(', ')})`);

    let order = 0;
    for (const res of RESOURCES) {
        const value = game.res[res.id] || 0;
        if (value >= 1) seen.add(res.id);
        if (!seen.has(res.id)) continue;
        const chip = chipFor(res);
        if (chip.el.parentNode !== els.resRow || els.resRow.children[order] !== chip.el) {
            els.resRow.insertBefore(chip.el, els.resRow.children[order] || null);
        }
        order++;
        const shown = Math.floor(value);
        chip.value.textContent = fmtShort(value);
        chip.el.classList.toggle('is-full', res.id !== 'coins' && value >= d.storage);
        // Um brilho curto quando um bem sobe — vê-se o reino a produzir.
        if (lastValues[res.id] !== undefined && shown > lastValues[res.id]) {
            chip.el.classList.add('flash');
            clearTimeout(chip.timer);
            chip.timer = setTimeout(() => chip.el.classList.remove('flash'), 350);
        }
        lastValues[res.id] = shown;
    }

    els.questText.textContent = currentQuest().text;
}

/** Destaca o cartão do objetivo quando um é cumprido. */
export function flashQuest() {
    els.questCard.classList.remove('done');
    void els.questCard.offsetWidth;
    els.questCard.classList.add('done');
}
