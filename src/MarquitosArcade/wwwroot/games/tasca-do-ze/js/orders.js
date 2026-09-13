// Fila de pedidos: aparecer, mostrar, servir e perder clientes.

import { pick } from '/lib/arcade/math.js';
import { PATIENCE_COLORS, PATIENCE_THRESHOLDS, TUNING } from './config.js';
import { CUSTOMERS, DESSERTS, INGREDIENTS, MAINS } from './data.js';
import { sfxLoseLife, sfxServe, sfxWrong } from './audio.js';
import { state } from './state.js';
import { els, renderHearts, replayAnimation, renderScore, toast } from './ui.js';

/** Chamado quando acaba a última vida. Registado pelo main.js (evita import circular). */
let onShiftOver = () => {};
export function setShiftOverHandler(handler) {
    onShiftOver = handler;
}

const newOrderId = () => Math.random().toString(36).slice(2, 9);

export function spawnOrder() {
    if (state.orders.length >= TUNING.maxQueue) return;

    const dish = pick(Math.random() < TUNING.mainDishChance ? MAINS : DESSERTS);
    const customer = pick(CUSTOMERS);

    state.orders.push({
        id: newOrderId(),
        dishId: dish.id,
        name: dish.name,
        emoji: dish.emoji,
        req: dish.req.slice(),
        sweet: !!dish.sweet,
        /** Ingredientes já postos no prato. */
        added: new Set(),
        customer,
        patienceMax: state.patienceMax,
        patienceLeft: state.patienceMax
    });
    renderQueue();
}

/** Percentagem e cor da barra de paciência de um pedido. */
function patienceBar(order) {
    const percent = Math.max(0, (order.patienceLeft / order.patienceMax) * 100);
    const color = percent > PATIENCE_THRESHOLDS.calm
        ? PATIENCE_COLORS.calm
        : percent > PATIENCE_THRESHOLDS.hurried
            ? PATIENCE_COLORS.hurried
            : PATIENCE_COLORS.angry;
    return { percent, color };
}

export function renderQueue() {
    els.queue.innerHTML = '';
    state.orders.forEach((order, index) => {
        const active = index === 0;
        const ticket = document.createElement('div');
        ticket.className = `ticket${active ? ' active' : ''}${active && order.sweet ? ' sweet' : ''}`;

        const { percent, color } = patienceBar(order);
        ticket.innerHTML =
            `<div class="dish-emoji">${order.emoji}</div>`
            + `<div class="cust">${order.customer.e}</div>`
            + `<div class="name">${order.customer.name}</div>`
            // Só o pedido a ser preparado mostra a barra: os que estão atrás ainda não contam.
            + (active ? `<div class="patience-track"><div class="patience-fill" style="width:${percent}%; background:${color};"></div></div>` : '');

        els.queue.appendChild(ticket);
    });

    els.orderCard.style.display = state.orders.length ? 'block' : 'none';
    if (state.orders.length) renderActiveOrder();
}

export function renderActiveOrder() {
    const order = state.orders[0];
    if (!order) return;

    els.orderCard.classList.toggle('sweet', !!order.sweet);
    els.orderEmoji.textContent = order.emoji;
    els.orderName.textContent = order.name;
    els.orderFor.textContent = `para ${order.customer.e} ${order.customer.name}`;

    els.reqList.innerHTML = '';
    for (const key of order.req) {
        const ingredient = INGREDIENTS[key];
        const done = order.added.has(key);
        const chip = document.createElement('div');
        chip.className = `req-chip${done ? ' done' : ''}`;
        chip.innerHTML = `<span class="ico">${ingredient.ico}</span>${ingredient.lbl}${done ? ' <span class="tick">✔️</span>' : ''}`;
        els.reqList.appendChild(chip);
    }

    const ready = order.added.size === order.req.length;
    els.bellBtn.classList.toggle('ready', ready);
    els.bellBtn.classList.toggle('sweet', ready && order.sweet);
}

/** Atualiza só a largura/cor da barra — a fila inteira redesenhada a 60fps piscava. */
export function updatePatienceBar(order) {
    const fill = els.queue.querySelector('.ticket.active .patience-fill');
    if (!fill) return;
    const { percent, color } = patienceBar(order);
    fill.style.width = `${percent}%`;
    fill.style.background = color;
}

/** Campainha: entrega o prato se estiver completo, senão protesta. */
export function ringBell() {
    if (!state.running || state.paused) return;
    const order = state.orders[0];
    if (!order) return;

    if (order.added.size !== order.req.length) {
        replayAnimation(els.bellBtn, 'shake');
        sfxWrong();
        toast('Faltam ingredientes no prato!');
        return;
    }

    // Quanto mais depressa se serve, mais pontos: o bónus são os segundos que sobraram.
    const bonusSeconds = Math.floor(order.patienceLeft / 1000);
    const points = TUNING.pointsPerDish + bonusSeconds;
    state.score += points;
    state.served += 1;
    renderScore();
    sfxServe();
    toast(`Servido! +${points} pontos 🎉`);

    state.orders.shift();
    renderQueue();
    rampDifficulty();
}

/** De X em X pratos servidos, o turno aperta até chegar aos mínimos. */
function rampDifficulty() {
    if (state.served <= 0 || state.served % TUNING.rampEveryServed !== 0) return;
    state.patienceMax = Math.max(TUNING.patienceFloorMs, state.patienceMax - TUNING.patienceStepMs);
    state.spawnInterval = Math.max(TUNING.spawnIntervalFloorMs, state.spawnInterval - TUNING.spawnIntervalStepMs);
}

export function loseLife(reason) {
    state.lives -= 1;
    renderHearts();
    sfxLoseLife();
    if (state.lives <= 0) onShiftOver(reason);
    else toast(reason);
}
