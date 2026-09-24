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
    AUTOSAVE_SECONDS, BUILDING, GAME_ID, MAX_BOARD_SCORE, NAME_STORAGE_KEY, PLAYER_FALLBACK, RESOURCE, ROAD_COST, SPEEDS,
    TOWNS, ZOOM_START
} from './config.js';
import { resumeAudio, sfx } from './audio.js';
import {
    buildRoad, canAfford, canRoad, checkPlacement, demolish, flatten, flattenBlock, newRoadCells, place, removeRoad,
    roadPath, upgradeCastle
} from './buildings.js';
import { addResource, harvestField, plantField, refreshDerived, stepEconomy, togglePaused } from './economy.js';
import { fmt, fmtDuration } from './format.js';
import { flashQuest, resetHud, updateHud } from './hud.js';
import { attachControls, setInputHandlers } from './input.js';
import { anchorFor, camera, gridToWorld, lookAt, panBy, rotateView, worldToScreen } from './iso.js';
import { buy, sell, townFor } from './market.js';
import { createMenu } from './menu.js';
import { checkQuest } from './quests.js';
import { initRenderer, render } from './render.js';
import { hasSave, loadSave, newGame, progress, resumeOffline, saveNow } from './save.js';
import { closeSheet, initSheets, openSheet, refreshSheet, sheetOpen } from './sheets.js';
import { fx, game, ui } from './state.js';
import { sendPlayerCaravan } from './towns.js';
import { els, overlays, toast, topBar, topBarEl } from './ui.js';
import { stepWalkers } from './walkers.js';
import { CASTLE_CENTER, ROAD_PLAYER, idx } from './world.js';

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
            lookAt(CASTLE_CENTER.x + Math.cos(a) * 10, CASTLE_CENTER.y + Math.sin(a) * 10);
        }

        // A gente anda ao ritmo do relógio do jogo; no menu, devagar, ao natural.
        stepWalkers(game.phase === 'playing' ? (game.paused ? 0 : dt * game.speed) : dt);

        timers.hud += dt;
        if (timers.hud >= 0.25 && game.phase === 'playing') {
            timers.hud = 0;
            refreshDerived();
            updateHud();
            // Os recursos mudam: o ✓ pode passar a dar (ou deixar de dar).
            if (ui.pending) refreshPlaceBanner();
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

const priceOf = (cost, n = 1) => Object.entries(cost).map(([r, c]) => `${c * n} ${RESOURCE[r].emoji}`).join(' + ');
const ROAD_PRICE = priceOf(ROAD_COST);

/*
 * Com rato, o fantasma segue o ponteiro e um clique constrói. Ao toque não há
 * ponteiro a pairar: o primeiro toque só escolhe o sítio (`ui.pending`), que se
 * vê no mapa e se pode trocar com outro toque, e só o ✓ constrói.
 */

/** O texto e os botões do modo de construção, conforme o que está escolhido. */
function refreshPlaceBanner() {
    const kind = ui.placing;
    els.placeBanner.hidden = !kind;
    document.body.classList.toggle('is-placing', !!kind);
    if (!kind) return;

    const pending = ui.pending;
    els.placeConfirm.hidden = !pending;
    let text;
    let ok = false;
    if (kind === 'road') {
        const head = `🛣️ <b>Estrada</b> · ${ROAD_PRICE} por casa`;
        if (!pending) {
            text = ui.roadFrom
                ? `${head}<br>Toca onde o troço acaba.`
                : `${head}<br>Toca onde começa: numa estrada ou em chão livre.`;
        } else {
            const path = ui.roadPreview;
            const cells = path ? newRoadCells(path) : 0;
            ok = !!path && canAfford(ROAD_COST, cells);
            if (!path) text = `${head}<br>⛔ ${ui.roadFrom ? 'Não há caminho livre até aí.' : 'Aqui não se abre estrada.'} Toca noutra casa.`;
            else if (!ok) text = `${head}<br>⛔ Faltam recursos: ${cells} casas custam ${priceOf(ROAD_COST, cells)}.`;
            else text = `${head}<br>Abrir ${cells} casa${cells === 1 ? '' : 's'} (${priceOf(ROAD_COST, cells)})? Ou toca noutra casa.`;
        }
    } else {
        const def = BUILDING[kind];
        const head = `${def.emoji} <b>${def.name}</b> · ${priceOf(def.cost)}`;
        if (!pending) {
            text = `${head}<br>Toca numa casa verde para escolher o sítio.`;
        } else {
            const check = checkPlacement(kind, pending.x, pending.y);
            ok = check.ok;
            text = ok
                ? `${head}<br>Construir aqui? Ou toca noutra casa para mudar.`
                : `${head}<br>⛔ ${check.reason}. Toca noutra casa.`;
        }
    }
    els.placeText.innerHTML = text;
    els.placeYesBtn.disabled = !ok;
}

/** Modo de estrada: toca-se onde começa e depois onde acaba cada troço. */
function startRoad(from = null) {
    closeSheet();
    ui.placing = 'road';
    ui.roadFrom = from;
    ui.roadPreview = null;
    ui.roadPreviewKey = '';
    ui.pending = null;
    ui.hover = null;
    ui.selected = null;
    refreshPlaceBanner();
}

/** O troço até `tile`: desde o fim do anterior, ou só essa casa para começar. */
function roadPathTo(tile) {
    const from = ui.roadFrom;
    if (from) return roadPath(from.x, from.y, tile.x, tile.y);
    return canRoad(tile.x, tile.y) ? [tile] : null;
}

/** Abre o troço `path` e continua a estrada a partir de `end`. */
function buildRoadPath(path, end) {
    if (!path) {
        sfx.nope();
        toast(ui.roadFrom
            ? 'Não há caminho livre até aí: a estrada contorna edifícios, árvores, água e colinas.'
            : 'Aqui não se abre estrada: só em chão plano e livre, dentro do território.', 'bad');
        return false;
    }
    const built = buildRoad(path);
    if (built < 0) {
        sfx.nope();
        toast(path.length > 1
            ? `Faltam recursos: este troço tem ${newRoadCells(path)} casas novas, a ${ROAD_PRICE} cada.`
            : `Faltam recursos: cada casa de estrada custa ${ROAD_PRICE}.`, 'bad');
        return false;
    }
    if (built > 0) sfx.build();
    else sfx.click();
    startRoad(end);
    return true;
}

function roadTap(tile, touch) {
    const { x, y } = tile;
    // Tocar numa estrada, sem troço a meio, só diz onde o próximo começa.
    if (!ui.roadFrom && game.world.road[idx(x, y)] === ROAD_PLAYER) {
        startRoad({ x, y });
        sfx.click();
        return;
    }
    if (!touch) {
        buildRoadPath(roadPathTo(tile), { x, y });
        return;
    }
    ui.pending = { x, y };
    ui.roadPreview = roadPathTo(tile);
    ui.roadPreviewOk = !!ui.roadPreview && canAfford(ROAD_COST, newRoadCells(ui.roadPreview));
    sfx.click();
    refreshPlaceBanner();
}

/** O que o rato mostra por cima do tabuleiro em modo de construção. */
function hoverTile(tile) {
    // Um sítio escolhido ao toque fica à vista até ser confirmado ou largado.
    if (ui.pending) return;
    if (!ui.placing || !tile) {
        ui.hover = null;
        ui.roadPreview = null;
        return;
    }
    if (ui.placing !== 'road') {
        ui.hover = anchorFor(tile, 2);
        return;
    }
    const key = `${tile.x},${tile.y}|${ui.roadFrom?.x},${ui.roadFrom?.y}|${game.roadsVersion}`;
    if (ui.roadPreviewKey === key) return;
    ui.roadPreviewKey = key;
    const path = roadPathTo(tile);
    ui.roadPreview = path;
    ui.roadPreviewOk = !!path && canAfford(ROAD_COST, newRoadCells(path));
}

/** Entre os quatro blocos que cobrem a casa (x, y), o primeiro onde `kind` cabe. */
function anchorCovering(kind, x, y) {
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        if (checkPlacement(kind, x + dx, y + dy, { ignoreCost: true }).ok) return { x: x + dx, y: y + dy };
    }
    return { x, y };
}

function startPlacing(kind) {
    if (kind === 'road') {
        startRoad();
        return;
    }
    const check = checkPlacement(kind);
    if (!check.ok) {
        sfx.nope();
        toast(`${BUILDING[kind].emoji} ${BUILDING[kind].name}: ${check.reason.toLowerCase()}.`, 'bad');
        return;
    }
    closeSheet();
    ui.placing = kind;
    ui.hover = null;
    ui.pending = null;
    ui.selected = null;
    refreshPlaceBanner();
}

function stopPlacing() {
    ui.placing = null;
    ui.hover = null;
    ui.pending = null;
    ui.roadFrom = null;
    ui.roadPreview = null;
    refreshPlaceBanner();
}

/** ✕: larga o sítio escolhido, mas continua em modo de construção. */
function dropPending() {
    if (!ui.pending) return;
    ui.pending = null;
    ui.roadPreview = null;
    ui.roadPreviewKey = '';
    sfx.click();
    refreshPlaceBanner();
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

/** Constrói `kind` no bloco (x, y); depois disso, ou se continua a pôr mais, ou o modo acaba. */
function placeAt(kind, x, y) {
    if (!tryPlace(kind, x, y)) return;
    ui.pending = null;
    if (!REPEATABLE.has(kind) || !checkPlacement(kind).ok) stopPlacing();
    else refreshPlaceBanner();
}

/** ✓: constrói no sítio escolhido ao toque. */
function confirmPending() {
    const at = ui.pending;
    if (!ui.placing || !at) return;
    resumeAudio();
    if (ui.placing === 'road') buildRoadPath(ui.roadPreview, at);
    else placeAt(ui.placing, at.x, at.y);
}

// ---------- Toques no mapa ----------

function tapTile(tile, pointerType) {
    const { x, y } = tile;
    resumeAudio();
    const touch = pointerType !== 'mouse';
    if (ui.placing === 'road') {
        roadTap(tile, touch);
        return;
    }
    if (ui.placing) {
        const at = anchorFor(tile, 2);
        if (!touch) {
            placeAt(ui.placing, at.x, at.y);
            return;
        }
        ui.pending = at;
        sfx.click();
        refreshPlaceBanner();
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

    showTileOptions(tile);
}

/**
 * Botão direito: as opções da casa, sem atalhos. Não semeia nem colhe e, se
 * estava a construir, larga a construção em vez de pôr alguma coisa ali.
 */
function inspectTile(tile) {
    resumeAudio();
    if (ui.placing) stopPlacing();
    showTileOptions(tile);
}

function showTileOptions({ x, y }) {
    if (game.world.building[idx(x, y)]?.kind === 'castle') {
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
        const anchor = anchorCovering(kind, x, y);
        if (tryPlace(kind, anchor.x, anchor.y)) openSheet('tile', `${x},${y}`);
    },
    roadFrom: (at) => {
        const [x, y] = at.split(',').map(Number);
        startRoad({ x, y });
    },
    unroad: (at) => {
        const [x, y] = at.split(',').map(Number);
        if (removeRoad(x, y)) {
            sfx.build();
            closeSheet();
        } else {
            sfx.nope();
        }
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
        const block = flattenBlock(x, y);
        if (stone > 0) fx.floats.push({ gx: block.x + 1, gy: block.y + 1, text: `+${stone} ${RESOURCE.stone.emoji}`, t: 0 });
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
    lookAt(CASTLE_CENTER.x, CASTLE_CENTER.y + 2);
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
    inspect: inspectTile,
    hover: hoverTile,
    cancel: () => {
        if (ui.pending) dropPending();
        else if (ui.placing) stopPlacing();
        else if (sheetOpen()) closeSheet();
    },
    confirm: confirmPending,
    toggleHide: toggleHideProps
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

// No sentido das setas do ícone 🔄: o cenário roda ao contrário dos ponteiros do relógio.
els.rotateBtn.addEventListener('click', () => rotateView(-1));

/** Esconde ou volta a mostrar os edifícios e as árvores enquanto se constrói. */
function toggleHideProps() {
    if (!ui.placing) return;
    ui.hideProps = !ui.hideProps;
    refreshHideBtn();
}

function refreshHideBtn() {
    const on = ui.hideProps;
    els.placeHideBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Mostrar edifícios e árvores' : 'Ocultar edifícios e árvores';
    els.placeHideBtn.title = `${label} (H)`;
    els.placeHideBtn.setAttribute('aria-label', label);
}

els.placeHideBtn.addEventListener('click', toggleHideProps);

els.questCard.addEventListener('click', () => {
    if (sheetOpen() === 'quest') closeSheet();
    else openSheet('quest');
});

for (const btn of els.toolbar.querySelectorAll('.toolBtn[data-sheet]')) {
    btn.addEventListener('click', () => {
        resumeAudio();
        stopPlacing();
        if (sheetOpen() === btn.dataset.sheet) closeSheet();
        else openSheet(btn.dataset.sheet);
    });
}

els.placeCancelBtn.addEventListener('click', stopPlacing);
els.placeNoBtn.addEventListener('click', dropPending);
els.placeYesBtn.addEventListener('click', confirmPending);

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
