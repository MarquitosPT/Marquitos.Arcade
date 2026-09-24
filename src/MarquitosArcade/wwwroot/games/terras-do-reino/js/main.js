// Terras do Reino — ponto de entrada.
//
// Monta o viewport e os controlos, liga os botões às ações e corre o ciclo
// principal. O ciclo arranca logo no carregamento, mesmo em menu: é ele que
// desenha o reino por trás do vidro.
//
// O jogo é contínuo — não há níveis nem fim de partida. "Sair" grava o reino
// e envia a prosperidade ao quadro; ao voltar, recupera-se o tempo em que o
// jogo esteve fechado (até três horas), e o reino continua de onde ficou.

import { createLoop, createViewport } from '/lib/arcade/index.js';
import { bindPlayerNameInput, createScoreClient } from '/lib/arcade/scores.js';

import {
    AUTOSAVE_SECONDS, BUILDING, GAME_ID, MAX_BOARD_SCORE, NAME_STORAGE_KEY, PLAYER_FALLBACK, RESOURCE, SPEEDS,
    TOWNS, ZOOM_START
} from './config.js';
import { resumeAudio, sfx } from './audio.js';
import { checkPlacement, demolish, flatten, place, upgradeCastle } from './buildings.js';
import { addResource, harvestField, plantField, refreshDerived, stepEconomy, togglePaused } from './economy.js';
import { fmt, fmtDuration } from './format.js';
import { flashQuest, resetHud, updateHud } from './hud.js';
import { attachControls, setInputHandlers } from './input.js';
import { camera, gridToWorld, lookAt, panBy, worldToScreen } from './iso.js';
import { buy, sell, townFor } from './market.js';
import { createMenu } from './menu.js';
import { checkQuest } from './quests.js';
import { initRenderer, render } from './render.js';
import { hasSave, loadSave, newGame, progress, resumeOffline, saveNow } from './save.js';
import { closeSheet, initSheets, openSheet, refreshSheet, sheetOpen } from './sheets.js';
import { fx, game, ui } from './state.js';
import { sendPlayerCaravan } from './towns.js';
import { els, overlays, toast, topBar, topBarEl } from './ui.js';
import { CASTLE_CENTER, idx } from './world.js';

const playerName = bindPlayerNameInput(els.playerNameInput, NAME_STORAGE_KEY, { fallback: PLAYER_FALLBACK });
const scores = createScoreClient(GAME_ID);
const menu = createMenu({ playerName });

// ---------- Viewport ----------

const viewport = createViewport(els.game, { topBar: topBarEl, topBarGap: 6 });
initRenderer(viewport);

// ---------- Ciclo principal ----------

const timers = { hud: 0, quest: 0, save: 0, sheet: 0 };

const loop = createLoop(
    (dt) => {
        fx.time += dt;

        if (game.phase === 'playing' && !game.paused) {
            const events = stepEconomy(dt * game.speed);
            if (events.fair) announceFair(events.fair);
            if (events.newDay) onNewDay();

            timers.quest += dt;
            if (timers.quest >= 0.5) {
                timers.quest = 0;
                const done = checkQuest(addResource);
                if (done) onQuestDone(done);
            }

            timers.save += dt;
            if (timers.save >= AUTOSAVE_SECONDS) {
                timers.save = 0;
                saveNow();
            }
        } else if (game.phase === 'menu') {
            // A câmara passeia devagar à volta do castelo.
            const a = fx.time * 0.04;
            lookAt(CASTLE_CENTER.x + Math.cos(a) * 5, CASTLE_CENTER.y + Math.sin(a) * 5);
        }

        timers.hud += dt;
        if (timers.hud >= 0.25 && game.phase === 'playing') {
            timers.hud = 0;
            refreshDerived();
            updateHud();
        }
        timers.sheet += dt;
        if (timers.sheet >= 1) {
            timers.sheet = 0;
            refreshSheet();
        }

        render(dt);
    },
    // dt em segundos. O teto de 100ms evita que um separador em segundo plano
    // devolva um salto enorme — o tempo fora do jogo é recuperado à parte.
    { scale: 1000, maxDelta: 0.1, stepWhilePaused: true }
);

// ---------- Acontecimentos ----------

let hungerWarnedDay = 0;

function onNewDay() {
    const d = game.derived;
    if (d.residents >= 12 && d.fedRatio < 0.5 && game.day - hungerWarnedDay >= 4) {
        hungerWarnedDay = game.day;
        toast('🍞 O povo come pouco: pão, leite ou queijo deixam-no contente — e pagam mais impostos.');
    }
}

function announceFair(fair) {
    const res = RESOURCE[fair.good];
    toast(`🎪 Feira em ${TOWNS[fair.town].name}: ${res.emoji} ${res.name.toLowerCase()} muito procurado!`, 'gold');
}

function onQuestDone(quest) {
    sfx.quest();
    flashQuest();
    const reward = Object.entries(quest.reward).map(([r, n]) => `+${fmt(n)} ${RESOURCE[r].emoji}`).join(' ');
    toast(`✅ ${quest.text} · ${reward}`, 'gold');
    saveNow();
}

function floatAtCastle(text) {
    fx.floats.push({ gx: CASTLE_CENTER.x, gy: CASTLE_CENTER.y, text, t: 0 });
}

// ---------- Construção ----------

function startPlacing(kind) {
    const check = checkPlacement(kind);
    if (!check.ok) {
        sfx.nope();
        toast(`${BUILDING[kind].emoji} ${BUILDING[kind].name}: ${check.reason.toLowerCase()}.`, 'bad');
        return;
    }
    closeSheet();
    ui.placing = kind;
    ui.hover = null;
    ui.selected = null;
    const def = BUILDING[kind];
    els.placeText.innerHTML = `${def.emoji} <b>${def.name}</b> · toca numa casa verde`;
    els.placeBanner.hidden = false;
}

function stopPlacing() {
    ui.placing = null;
    ui.hover = null;
    els.placeBanner.hidden = true;
}

/** Edifícios que se costumam pôr vários seguidos: o modo de construção fica ligado. */
const REPEATABLE = new Set(['field', 'house']);

function tryPlace(kind, x, y) {
    const check = checkPlacement(kind, x, y);
    if (!check.ok) {
        sfx.nope();
        toast(check.reason, 'bad');
        return false;
    }
    const b = place(kind, x, y);
    if (!b) return false;
    if (b.kind === 'field') plantField(b);
    sfx.build();
    refreshDerived();
    return true;
}

// ---------- Toques no mapa ----------

function tapTile({ x, y }) {
    resumeAudio();
    if (ui.placing) {
        const kind = ui.placing;
        if (tryPlace(kind, x, y) && (!REPEATABLE.has(kind) || !checkPlacement(kind).ok)) stopPlacing();
        return;
    }

    const b = game.world.building[idx(x, y)];
    if (b?.owner === 'player' && b.kind === 'field' && b.stage !== 'growing') {
        if (b.stage === 'empty') {
            plantField(b);
            sfx.plant();
        } else if (harvestField(b) > 0) {
            sfx.harvest();
        } else {
            sfx.nope();
            toast('📦 O armazém de trigo está cheio: vende ou faz farinha.', 'bad');
        }
        return;
    }

    if (b?.kind === 'castle') {
        ui.selected = null;
        openSheet('castle');
        return;
    }

    ui.selected = { x, y };
    sfx.click();
    openSheet('tile', `${x},${y}`);
    revealTile(x, y);
}

/**
 * Se a casa escolhida ficou por baixo do painel, anda-se com o mapa até ela se
 * ver: ao lado do painel num ecrã largo, por cima dele num telemóvel.
 */
function revealTile(x, y) {
    const r = els.sheet.getBoundingClientRect();
    const w = gridToWorld(x + 0.5, y + 0.5, Math.max(0, game.world.elev[idx(x, y)]));
    const s = worldToScreen(w.x, w.y);
    const margin = 36;
    const covered = s.x > r.left - margin && s.x < r.right + margin && s.y > r.top - margin * 2 && s.y < r.bottom + margin;
    if (!covered) return;
    const drawer = r.right < camera.width * 0.62;
    const target = drawer
        ? { x: (r.right + camera.width) / 2, y: s.y }
        : { x: s.x, y: Math.max(160, r.top / 2 + 60) };
    panBy(target.x - s.x, target.y - s.y);
}

// ---------- Ações dos painéis ----------

let pendingDemolish = { key: '', until: 0 };

const actions = {
    playerName: () => playerName.current(),
    onClose: () => { ui.selected = null; },
    sheet: (name) => openSheet(name),
    place: (kind) => startPlacing(kind),
    buildAt: (kind, at) => {
        const [x, y] = at.split(',').map(Number);
        if (tryPlace(kind, x, y)) openSheet('tile', `${x},${y}`);
    },
    plant: (at) => {
        const [x, y] = at.split(',').map(Number);
        if (plantField(game.world.building[idx(x, y)])) sfx.plant();
    },
    harvest: (at) => {
        const [x, y] = at.split(',').map(Number);
        if (harvestField(game.world.building[idx(x, y)]) > 0) sfx.harvest();
        else sfx.nope();
    },
    toggle: (at) => {
        const [x, y] = at.split(',').map(Number);
        if (togglePaused(game.world.building[idx(x, y)])) sfx.click();
    },
    demolish: (at) => {
        const now = performance.now();
        if (pendingDemolish.key !== at || now > pendingDemolish.until) {
            pendingDemolish = { key: at, until: now + 3000 };
            toast('Toca outra vez em Demolir para confirmar.');
            return;
        }
        pendingDemolish = { key: '', until: 0 };
        const [x, y] = at.split(',').map(Number);
        if (demolish(game.world.building[idx(x, y)])) {
            sfx.build();
            refreshDerived();
            closeSheet();
        }
    },
    flatten: (at) => {
        const [x, y] = at.split(',').map(Number);
        const stone = flatten(x, y);
        if (stone < 0) {
            sfx.nope();
            return;
        }
        sfx.build();
        if (stone > 0) fx.floats.push({ gx: x + 0.5, gy: y + 0.5, text: `+${stone} ${RESOURCE.stone.emoji}`, t: 0 });
        refreshDerived();
        saveNow();
    },
    sell: (good, n) => {
        const amount = n === 'all' ? Math.floor(game.res[good]) : Number(n);
        const coins = sell(good, amount);
        if (coins <= 0) return;
        sfx.coins();
        floatAtCastle(`+${fmt(coins)} 💰`);
        sendPlayerCaravan(townFor(good), good);
        refreshDerived();
    },
    buy: (good, n) => {
        const got = buy(good, Number(n), game.derived.storage);
        if (!got) {
            sfx.nope();
            return;
        }
        sfx.coins();
        floatAtCastle(`+${got} ${RESOURCE[good].emoji}`);
        refreshDerived();
    },
    upgrade: () => {
        if (!upgradeCastle()) {
            sfx.nope();
            return;
        }
        sfx.upgrade();
        refreshDerived();
        toast(`🏰 O castelo subiu ao nível ${game.castleLevel}! O território cresceu.`, 'gold');
        submitScore();
        saveNow();
    }
};

initSheets(actions);

// ---------- Entrar e sair do reino ----------

function enterKingdom() {
    game.phase = 'playing';
    game.paused = false;
    timers.save = 0;
    overlays.hideAll();
    topBar.setInGame(true);
    document.body.classList.add('in-game');
    camera.zoom = ZOOM_START;
    lookAt(CASTLE_CENTER.x, CASTLE_CENTER.y + 1);
    resetHud();
    refreshDerived();
    updateHud();
}

function play() {
    resumeAudio();
    playerName.remember();

    let away = null;
    if (hasSave()) {
        loadSave();
        away = resumeOffline();
    }
    enterKingdom();
    saveNow();

    if (away) showWelcome(away);
    else if (game.played < 1) toast('👑 Bem-vindo ao teu reino! Começa pelo objetivo, aqui em cima à esquerda.', 'gold');
}

function showWelcome(away) {
    game.paused = true;
    els.welcomeSub.textContent = `Estiveste fora ${fmtDuration(away.seconds)}${away.days ? ` (${away.days} dia${away.days > 1 ? 's' : ''} no reino)` : ''}. Entretanto:`;
    const items = Object.entries(away.delta)
        .filter(([, n]) => n !== 0)
        .map(([res, n]) => `<span class="delta ${n > 0 ? 'up' : 'down'}">${n > 0 ? '+' : ''}${fmt(n)} ${RESOURCE[res].emoji}</span>`);
    els.welcomeList.innerHTML = items.length ? items.join('') : '<span class="delta">O reino descansou.</span>';
    overlays.show('welcome');
}

function submitScore() {
    // O reino não tem teto, o quadro tem: acima do máximo do servidor o pedido
    // era recusado e a pontuação perdia-se.
    const score = Math.min(MAX_BOARD_SCORE, game.derived.prosperity);
    if (score <= game.bestSubmitted) return;
    game.bestSubmitted = score;
    scores.submitQuietly(playerName.forBoard(), score);
}

function leaveKingdom() {
    if (game.phase !== 'playing') return;
    refreshDerived();
    submitScore();
    saveNow();
    progress.flush();
    stopPlacing();
    closeSheet();
    game.phase = 'menu';
    game.paused = false;
    document.body.classList.remove('in-game');
    topBar.setInGame(false);
    camera.zoom = 1.1;
    menu.show();
}

function togglePause() {
    if (game.phase !== 'playing') return;
    game.paused = !game.paused;
    if (game.paused) {
        saveNow();
        overlays.show('pause');
    } else {
        overlays.hideAll();
    }
}

// ---------- Ligações ----------

setInputHandlers({
    tap: tapTile,
    cancel: () => {
        if (ui.placing) stopPlacing();
        else if (sheetOpen()) closeSheet();
    }
});
attachControls(els.game);

els.playBtn.addEventListener('click', play);
els.newBtn.addEventListener('click', () => overlays.show('confirm'));
els.cancelNewBtn.addEventListener('click', () => menu.show());
els.confirmNewBtn.addEventListener('click', () => {
    progress.reset();
    newGame();
    play();
});
els.welcomeBtn.addEventListener('click', () => {
    game.paused = false;
    overlays.hideAll();
});

els.pauseBtn.addEventListener('click', togglePause);
els.resumeBtn.addEventListener('click', togglePause);
els.quitBtn.addEventListener('click', () => {
    game.paused = false;
    leaveKingdom();
});
els.endBtn.addEventListener('click', leaveKingdom);

els.speedBtn.addEventListener('click', () => {
    const i = SPEEDS.indexOf(game.speed);
    game.speed = SPEEDS[(i + 1) % SPEEDS.length];
    updateHud();
});

els.questCard.addEventListener('click', () => {
    if (sheetOpen() === 'quest') closeSheet();
    else openSheet('quest');
});

for (const btn of els.toolbar.querySelectorAll('.toolBtn')) {
    btn.addEventListener('click', () => {
        resumeAudio();
        stopPlacing();
        if (sheetOpen() === btn.dataset.sheet) closeSheet();
        else openSheet(btn.dataset.sheet);
    });
}

els.placeCancelBtn.addEventListener('click', stopPlacing);

// Fechar ou esconder a página a meio do jogo não pode custar o que se fez.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && game.phase === 'playing') {
        saveNow();
        progress.flush();
    }
});
window.addEventListener('pagehide', () => {
    if (game.phase === 'playing') {
        saveNow();
        progress.flush();
    }
});

// ---------- Arranque ----------

// No menu vê-se já o reino: o guardado neste aparelho ou, a quem não tem
// nenhum, o que vai fundar.
if (!loadSave()) newGame();
camera.zoom = 1.1;
lookAt(CASTLE_CENTER.x, CASTLE_CENTER.y);
menu.show(false);
loop.start();

// O reino da conta chega depois do primeiro frame. Até lá o botão espera:
// fundar um reino novo antes de a conta responder podia pôr por cima de um
// reino guardado noutro aparelho.
Promise.race([progress.load(), new Promise((resolve) => setTimeout(resolve, 6000))]).then(() => {
    if (game.phase !== 'menu') return;
    if (hasSave()) loadSave();
    // Se o jogador já foi para outro ecrã (a confirmação de um reino novo),
    // não se lhe puxa o tapete: só se atualiza o menu por baixo.
    if (overlays.isVisible('start')) menu.show(true);
    else menu.refresh(true);
});

// O menu está montado: o ecrã de arranque já pode acabar a barra. O tempo
// mínimo é dele (lib/arcade/splash.js), isto só lhe diz que não falta nada.
window.__arcadeSplash?.ready();
