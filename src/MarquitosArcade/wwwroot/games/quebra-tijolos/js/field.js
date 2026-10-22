// Onde fica o campo no ecrã, e a que escala.
//
// O campo tem sempre o mesmo tamanho em unidades (ver config.js): o que muda de
// ecrã para ecrã é só a escala e o sítio. É a regra que mantém tudo alinhado —
// a física, os tijolos, a raquete e o marcador são desenhados no mesmo
// referencial, com uma única transformação (`applyFieldTransform`), e nada é
// medido em píxeis do ecrã a não ser esta conta.
//
// A caixa que tem de caber no ecrã é o campo, mais as paredes, mais a faixa do
// marcador por cima do teto. Ao alto, fica por baixo da barra de topo. Ao
// comprido sobra largura e falta altura, por isso o campo sobe até ao cimo do
// ecrã sempre que cabe ao lado dos botões da barra, sem lhes tocar.

import { FIELD_H, FIELD_W, FLOOR_PAD, HUD_H, SCREEN_MARGIN, WALL } from './config.js';
import { game } from './state.js';

/** A caixa que se desenha, em unidades do campo (0,0 é o canto de cima à esquerda do interior). */
export const BOX = {
    x: -WALL,
    y: -WALL - HUD_H,
    w: FIELD_W + WALL * 2,
    h: HUD_H + WALL + FIELD_H + FLOOR_PAD
};

/** Folga entre o campo e os botões da barra de topo, em píxeis. */
const BAR_CLEARANCE = 12;

/**
 * Calcula a escala e a posição do campo para o ecrã atual.
 * @param {HTMLElement} [topBarEl] A barra de topo, para o campo não lhe passar por baixo.
 */
export function layoutField(topBarEl) {
    const view = game.view;
    if (!view) return;
    const safe = view.safeArea;
    const left = Math.max(safe.left, SCREEN_MARGIN);
    const right = view.width - Math.max(safe.right, SCREEN_MARGIN);
    const bottom = view.height - Math.max(safe.bottom, SCREEN_MARGIN);
    const fit = (top) => Math.min((right - left) / BOX.w, (bottom - top) / BOX.h);

    let top = Math.max(view.topInset, safe.top + SCREEN_MARGIN);
    let scale = fit(top);
    let centerX = (left + right) / 2;

    // Ao comprido: o campo pode subir até ao cimo se couber à esquerda da barra.
    const barLeft = topBarEl?.getBoundingClientRect().left;
    if (barLeft && !view.isPortrait) {
        const highTop = Math.max(safe.top, SCREEN_MARGIN);
        const highScale = fit(highTop);
        const width = BOX.w * highScale;
        const highCenter = Math.min(centerX, barLeft - BAR_CLEARANCE - width / 2);
        if (highScale > scale && highCenter - width / 2 >= left) {
            top = highTop;
            scale = highScale;
            centerX = highCenter;
        }
    }

    const width = BOX.w * scale;
    const height = BOX.h * scale;
    const boxX = centerX - width / 2;
    const boxY = top + (bottom - top - height) / 2;

    game.layout = {
        scale,
        /** Onde fica, no ecrã, o ponto 0,0 do campo. */
        ox: boxX - BOX.x * scale,
        oy: boxY - BOX.y * scale,
        /** A caixa inteira (paredes e marcador incluídos), em píxeis do ecrã. */
        screen: { x: boxX, y: boxY, w: width, h: height }
    };
}

/** Passa o contexto do canvas a desenhar em unidades do campo. */
export function applyFieldTransform(ctx, shakeX = 0, shakeY = 0) {
    const { scale, ox, oy } = game.layout;
    const dpr = game.view.dpr;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + shakeX), dpr * (oy + shakeY));
}

/** Um X do ecrã (clientX) em unidades do campo. */
export function clientToFieldX(clientX) {
    const bounds = game.view.canvas.getBoundingClientRect();
    return (clientX - bounds.left - game.layout.ox) / game.layout.scale;
}

/** Uma distância do ecrã (px) em unidades do campo. */
export const pxToField = (px) => px / game.layout.scale;
