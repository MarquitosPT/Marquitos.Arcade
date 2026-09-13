// Bancada de ingredientes, em dois separadores: salgados e doces.
//
// As duas grelhas são construídas uma vez e ficam as duas no DOM; trocar de
// separador só muda a classe `active`. Reconstruir a grelha a cada toque perdia
// a posição do scroll e piscava.

import { TUNING } from './config.js';
import { INGREDIENTS } from './data.js';
import { sfxTap, sfxWrong } from './audio.js';
import { state } from './state.js';
import { renderActiveOrder } from './orders.js';
import { els, replayAnimation, toast } from './ui.js';

export const SAVORY = 'savory';
export const SWEET = 'sweet';

let category = SAVORY;

export function buildBench() {
    els.benchWrap.innerHTML = '';
    const keys = Object.keys(INGREDIENTS);
    els.benchWrap.appendChild(buildCategory(SAVORY, keys.filter((k) => !INGREDIENTS[k].sweet)));
    els.benchWrap.appendChild(buildCategory(SWEET, keys.filter((k) => INGREDIENTS[k].sweet)));
}

function buildCategory(name, keys) {
    const wrapper = document.createElement('div');
    wrapper.className = `bench-category${category === name ? ' active' : ''}`;
    wrapper.dataset.cat = name;
    wrapper.appendChild(buildGrid(keys));
    return wrapper;
}

function buildGrid(keys) {
    const grid = document.createElement('div');
    grid.className = 'bench';
    for (const key of keys) {
        const ingredient = INGREDIENTS[key];
        const button = document.createElement('div');
        button.className = 'ing-btn';
        button.dataset.key = key;
        button.innerHTML = `<div class="ico">${ingredient.ico}</div><div class="lbl">${ingredient.lbl}</div>`;
        button.addEventListener('click', () => onIngredientTap(key, button));
        grid.appendChild(button);
    }
    return grid;
}

export function setBenchCategory(name) {
    category = name;
    for (const el of els.benchWrap.querySelectorAll('.bench-category')) {
        el.classList.toggle('active', el.dataset.cat === name);
    }
    els.tabSavory.classList.toggle('active', name === SAVORY);
    els.tabSweet.classList.toggle('active', name === SWEET);
}

function onIngredientTap(key, button) {
    if (!state.running || state.paused) return;
    const order = state.orders[0];
    if (!order) return;

    const wanted = order.req.includes(key) && !order.added.has(key);
    if (wanted) {
        order.added.add(key);
        sfxTap();
        renderActiveOrder();
        return;
    }

    // Ingrediente errado (ou repetido): o cliente perde paciência.
    replayAnimation(button, 'wrong');
    sfxWrong();
    order.patienceLeft = Math.max(0, order.patienceLeft - TUNING.wrongIngredientPenaltyMs);
    toast(`Isso não leva no ${order.name}!`);
}
