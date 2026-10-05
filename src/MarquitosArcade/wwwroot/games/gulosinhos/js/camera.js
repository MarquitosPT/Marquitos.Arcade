// A câmara: o tamanho de um tile no ecrã e o pedaço do percurso que se vê.
//
// O tile é o maior que deixa ver `VIEW_ROWS` na vertical e `VIEW_MIN_COLS` na
// horizontal (config.js). Ao comprido manda a altura — vê-se um bom bocado do
// caminho à frente; ao alto manda a largura, e o percurso inteiro cabe na
// vertical, com céu por cima.
//
// Ao alto, com os botões táteis à vista, o mundo não vai até ao fundo do ecrã:
// os botões ficam numa faixa só deles (`controlsBand`), para os polegares não
// taparem o chão onde se vai pôr o pé.
//
// A câmara segue o bicho com um pouco de atraso (fica mais suave) e olha para
// a frente, para o lado para onde ele corre: num percurso que se faz a correr,
// o que interessa é o que vem aí.

import { ROWS, TILE_MAX, TILE_MIN, VIEW_MIN_COLS, VIEW_ROWS } from './config.js';
import { game } from './state.js';

/** Altura da faixa dos botões, ao alto. */
const BAND_HEIGHT = 0.2;

export function layoutView() {
    const view = game.view;
    if (!view) return;
    const portrait = view.height > view.width;
    game.controlsBand = game.touchMode && portrait ? Math.round(Math.min(190, view.height * BAND_HEIGHT)) : 0;
    const worldHeight = view.height - game.controlsBand;
    game.tile = Math.max(TILE_MIN, Math.min(TILE_MAX, Math.floor(Math.min(worldHeight / VIEW_ROWS, view.width / VIEW_MIN_COLS))));
}

/** Tiles à vista, na horizontal e na vertical. */
export function viewSize() {
    const view = game.view;
    return {
        cols: view.width / game.tile,
        rows: (view.height - game.controlsBand) / game.tile
    };
}

/** Onde a câmara quer estar para ter o bicho em (px, py), a olhar para `look`. */
function targetFor(world, px, py, look) {
    const { cols, rows } = viewSize();
    const x = Math.max(0, Math.min(world.cols - cols, px - cols * 0.42 + look));
    // Se o percurso cabe todo na vertical, fica encostado ao fundo e o que
    // sobra é céu. Senão, segue o bicho, com mais espaço por cima dele do que
    // por baixo (é para cima que se salta).
    const y = rows >= ROWS ? ROWS - rows : Math.max(0, Math.min(ROWS - rows, py - rows * 0.58));
    return { x, y };
}

/** Põe a câmara já no sítio — ao começar o nível e ao voltar a uma bandeira. */
export function snapCamera(world, px, py, facing = 1) {
    const { cols } = viewSize();
    game.camera.look = facing * cols * 0.1;
    const t = targetFor(world, px, py, game.camera.look);
    game.camera.x = t.x;
    game.camera.y = t.y;
}

export function updateCamera(world, px, py, facing, dt) {
    const { cols } = viewSize();
    const cam = game.camera;
    cam.look += (facing * cols * 0.1 - cam.look) * Math.min(1, dt * 2.5);
    const t = targetFor(world, px, py, cam.look);
    cam.x += (t.x - cam.x) * Math.min(1, dt * 7);
    cam.y += (t.y - cam.y) * Math.min(1, dt * 5);
}
