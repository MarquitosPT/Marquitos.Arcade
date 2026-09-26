// Barra de topo comum aos jogos: sair para a arcada, acerca, ver pontuações, pausar, terminar.
//
// Fora do jogo mostram-se os links de navegação; dentro do jogo, os controlos de
// pausa/terminar — para o jogador não sair da partida por engano num toque.

/**
 * @param {object} elements Elementos da barra; qualquer um pode faltar.
 * @param {HTMLElement} [elements.arcadeLink]
 * @param {HTMLElement} [elements.aboutBtn]
 * @param {HTMLElement} [elements.scoresLink]
 * @param {HTMLElement} [elements.pauseBtn]
 * @param {HTMLElement} [elements.endBtn]
 */
export function createTopBar({ arcadeLink, aboutBtn, scoresLink, pauseBtn, endBtn } = {}) {
    const outOfGame = [arcadeLink, aboutBtn, scoresLink].filter(Boolean);
    const inGameOnly = [pauseBtn, endBtn].filter(Boolean);

    function setInGame(inGame) {
        for (const el of outOfGame) el.style.display = inGame ? 'none' : 'inline-block';
        for (const el of inGameOnly) el.style.display = inGame ? 'inline-block' : 'none';
    }

    setInGame(false);

    return { setInGame };
}
