// A economia do reino, passo a passo.
//
// A cada passo: contam-se os moradores, distribuem-se os trabalhadores pelos
// edifícios (por ordem de construção — o primeiro a ser feito é o primeiro a
// ter gente), cada edifício avança o seu ciclo, os campos crescem e cobram-se
// os impostos. Ao fim de cada dia o povo come, e o contentamento acompanha o
// que houve na mesa.

import {
    BUILDING, CASTLE_LEVELS, DAY_SECONDS, FOODS, HAPPY_BASE, HAPPY_FED, HAPPY_VARIETY, IDLE_TAX_SHARE, RESOURCE,
    TAX_PER_RESIDENT
} from './config.js';
import { centerOf, costValue } from './buildings.js';
import { driftMarket, marketNewDay } from './market.js';
import { castleInfo, fx, game } from './state.js';
import { stepCaravans, stepTowns } from './towns.js';
import { countFeatureNear, forEachInRadius, idx, isFreeLand } from './world.js';

/** Acrescenta um bem, sem passar do armazém. Devolve quanto entrou de facto. */
export function addResource(res, amount) {
    if (res === 'coins') {
        game.res.coins += amount;
        return amount;
    }
    const room = Math.max(0, game.derived.storage - game.res[res]);
    const added = Math.min(room, amount);
    game.res[res] += added;
    return added;
}

function float(b, text, quiet) {
    if (quiet) return;
    const c = centerOf(b);
    fx.floats.push({ gx: c.x, gy: c.y, text, t: 0 });
}

/** Os números que se mostram e que o resto do jogo lê: moradores, armazém, impostos. */
export function refreshDerived() {
    const d = game.derived;
    const houses = game.buildings.filter((b) => b.kind === 'house').length;
    d.residents = castleInfo().residents + houses * BUILDING.house.residents;
    d.storage = castleInfo().storage;
    d.prosperity = prosperity();
    updateTax();
}

/** Impostos por dia: quem trabalha paga por inteiro, quem está parado paga uma parte. */
function updateTax() {
    const d = game.derived;
    const idle = Math.max(0, d.residents - d.workersUsed);
    d.taxPerDay = (d.workersUsed + idle * IDLE_TAX_SHARE) * TAX_PER_RESIDENT * game.happy;
}

/** A pontuação: moedas, bens ao preço de referência, edifícios e o castelo. */
export function prosperity() {
    let total = game.res.coins;
    for (const [res, amount] of Object.entries(game.res)) {
        if (res !== 'coins') total += amount * (RESOURCE[res]?.price || 0);
    }
    for (const b of game.buildings) total += costValue(BUILDING[b.kind].cost);
    for (let level = 2; level <= game.castleLevel; level++) {
        total += costValue(CASTLE_LEVELS[level].cost);
    }
    return Math.max(0, Math.round(total));
}

function assignWorkers() {
    let free = game.derived.residents;
    for (const b of game.buildings) {
        const need = BUILDING[b.kind].workers || 0;
        if (b.paused) {
            b.staffed = false;
            continue;
        }
        if (!need) {
            b.staffed = true;
            continue;
        }
        b.staffed = free >= need;
        if (b.staffed) free -= need;
    }
    game.derived.workersUsed = game.derived.residents - free;
    updateTax();
}

/**
 * Parar ou retomar um edifício. Serve para gerir as cadeias: uma carpintaria
 * come a madeira toda, e às vezes quer-se a madeira para construir.
 */
export function togglePaused(b) {
    if (!b || b.owner !== 'player' || !BUILDING[b.kind].workers) return false;
    b.paused = !b.paused;
    b.progress = Math.min(b.progress, 0.99);
    // O estado certo já, sem esperar pelo passo seguinte — a ficha mostra-o logo.
    b.status = b.paused ? 'paused' : 'ok';
    return true;
}

/** Semear um campo vazio. */
export function plantField(b) {
    if (b.kind !== 'field' || b.stage !== 'empty') return false;
    b.stage = 'growing';
    b.growth = 0;
    return true;
}

/** Colher um campo maduro. Devolve o trigo que entrou (0 se o armazém estava cheio). */
export function harvestField(b, { quiet = false } = {}) {
    if (b.kind !== 'field' || b.stage !== 'ripe') return 0;
    const got = addResource('wheat', BUILDING.field.yield);
    if (got <= 0) return 0;
    b.stage = 'empty';
    b.growth = 0;
    game.stats.harvested += got;
    float(b, `+${got} ${RESOURCE.wheat.emoji}`, quiet);
    return got;
}

function stepField(b, dt) {
    if (b.stage !== 'growing') return;
    b.growth += dt / BUILDING.field.grow;
    if (b.growth >= 1) {
        b.growth = 1;
        b.stage = 'ripe';
    }
}

function hasInputs(recipe) {
    return Object.entries(recipe.in || {}).every(([res, n]) => game.res[res] >= n);
}

function stepProducer(b, def, dt, quiet) {
    const recipe = def.recipe;
    if (!b.staffed) {
        b.status = 'noWorkers';
        return;
    }

    let efficiency = 1;
    if (def.near) {
        const found = countFeatureNear(game.world, b.x, b.y, b.size, def.near.feature, def.near.radius);
        if (found < def.near.min) {
            b.status = 'noNear';
            return;
        }
        efficiency = Math.min(1, found / def.near.full);
    }

    const full = Object.keys(recipe.out).every((res) => game.res[res] >= game.derived.storage);
    if (full) {
        b.status = 'full';
        return;
    }
    if (!hasInputs(recipe)) {
        b.status = 'noInput';
        return;
    }

    b.status = 'ok';
    b.progress += (dt * efficiency) / recipe.time;
    if (b.progress < 1) return;

    b.progress -= 1;
    for (const [res, n] of Object.entries(recipe.in || {})) game.res[res] -= n;
    const parts = [];
    for (const [res, n] of Object.entries(recipe.out)) {
        const got = addResource(res, n);
        if (got > 0) parts.push(`+${got} ${RESOURCE[res].emoji}`);
    }
    b.pulse = 0;
    if (parts.length) float(b, parts.join(' '), quiet);
}

/** Guarda-florestal: planta uma árvore numa casa livre à volta, de tempos a tempos (nunca nas estradas). */
function stepForester(b, def, dt) {
    if (!b.staffed) {
        b.status = 'noWorkers';
        return;
    }
    b.progress += dt / def.plants.time;
    if (b.progress < 1) {
        b.status = 'ok';
        return;
    }
    b.progress = 0;
    const free = [];
    const c = centerOf(b);
    forEachInRadius(c.x, c.y, def.plants.radius, (x, y) => {
        if (isFreeLand(game.world, x, y)) free.push(idx(x, y));
    });
    if (!free.length) {
        b.status = 'full';
        return;
    }
    const i = free[Math.floor(Math.random() * free.length)];
    game.world.feature[i] = 'tree';
    game.planted.push(i);
    b.pulse = 0;
    b.status = 'ok';
}

/** Celeiro: colhe os campos maduros à volta e volta a semeá-los. */
function stepBarn(b, def, dt, quiet) {
    if (!b.staffed) {
        b.status = 'noWorkers';
        return;
    }
    b.status = 'ok';
    b.progress += dt / def.farms.time;
    if (b.progress < 1) return;
    b.progress = 0;

    let empty = null;
    let ripe = null;
    const c = centerOf(b);
    for (const other of game.buildings) {
        if (other.kind !== 'field') continue;
        const o = centerOf(other);
        if (Math.hypot(o.x - c.x, o.y - c.y) > def.farms.radius) continue;
        if (!ripe && other.stage === 'ripe') ripe = other;
        if (!empty && other.stage === 'empty') empty = other;
    }

    if (ripe) {
        if (harvestField(ripe, { quiet }) > 0) {
            plantField(ripe);
            b.pulse = 0;
        } else {
            b.status = 'full';
        }
    } else if (empty) {
        plantField(empty);
        b.pulse = 0;
    }
}

/** O povo come ao fim do dia: primeiro o que mais alimenta. */
function eat() {
    const residents = game.derived.residents;
    let meals = 0;
    let kinds = 0;
    for (const food of FOODS) {
        const per = RESOURCE[food].meals;
        const wanted = Math.ceil((residents - meals) / per);
        if (wanted <= 0) break;
        const eaten = Math.min(wanted, Math.floor(game.res[food]));
        if (eaten > 0) kinds++;
        game.res[food] -= eaten;
        meals += eaten * per;
    }
    const fed = residents ? Math.min(1, meals / residents) : 0;
    game.derived.fedRatio = fed;
    const variety = kinds >= 2 ? HAPPY_VARIETY : 0;
    const target = HAPPY_BASE + HAPPY_FED * fed + variety;
    // O contentamento não salta de um dia para o outro: anda metade do caminho.
    game.happy += (target - game.happy) * 0.5;
}

/**
 * Um passo da economia.
 * @param {number} dt Segundos de jogo.
 * @param {object} [options]
 * @param {boolean} [options.quiet] Sem efeitos visuais: nem números a flutuar nem caravanas a sair.
 * @returns {{ newDay: boolean, fair: object|null }} O que aconteceu que o jogo possa querer anunciar.
 */
export function stepEconomy(dt, { quiet = false } = {}) {
    const events = { newDay: false, fair: null };
    game.played += dt;

    refreshDerived();
    assignWorkers();

    for (const b of game.buildings) {
        const def = BUILDING[b.kind];
        b.pulse += dt;
        if (b.paused) {
            b.status = 'paused';
            continue;
        }
        if (b.kind === 'field') stepField(b, dt);
        else if (def.recipe) stepProducer(b, def, dt, quiet);
        else if (def.plants) stepForester(b, def, dt);
        else if (def.farms) stepBarn(b, def, dt, quiet);
    }

    // Os impostos pingam ao longo do dia, não caem todos ao fim dele.
    game.res.coins += (game.derived.taxPerDay / DAY_SECONDS) * dt;

    driftMarket(dt);
    stepTowns(dt, { quiet });
    if (!quiet) stepCaravans(dt);

    game.clock += dt;
    if (game.clock >= DAY_SECONDS) {
        game.clock -= DAY_SECONDS;
        game.day++;
        eat();
        events.newDay = true;
        events.fair = marketNewDay();
    }

    return events;
}
