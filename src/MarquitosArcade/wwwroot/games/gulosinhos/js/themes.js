// Os cenários: as cores do céu, das colinas, do chão e dos enfeites.
//
// Cada nível escolhe um (ver `theme` em levels.js). Tudo o que se desenha vai
// buscar as cores aqui, e nada mais muda entre cenários — os troços e os
// desafios são os mesmos em todo o lado. O `accent` é a cor do nível nos
// cartões do menu e no ecrã de resultados.
//
// Os enfeites (`decor`) são quatro desenhos por cenário, escolhidos pelo
// gerador em world.js com um número de 0 a 3: flores, arbustos, cogumelos,
// conchas, cristais, bonecos de neve, chupa-chupas gigantes…

const meadow = {
    sky: ['#7fd3ff', '#d9f4ff'],
    sun: '#fff3b0',
    far: '#9fdc8a',
    near: '#6cc46a',
    grass: '#6fd35b',
    grassDark: '#4fb043',
    ground: '#b9794a',
    groundDark: '#9a5f37',
    groundDots: '#c98f60',
    block: '#f0b955',
    blockDark: '#c98f2c',
    platform: '#e7a35b',
    platformDark: '#b97a3a',
    clouds: 'rgba(255, 255, 255, 0.9)',
    decor: ['flower', 'bush', 'mushroom', 'flower2'],
    night: false
};

export const THEMES = {
    prado: { ...meadow, accent: '#7ddc5a' },
    pomar: {
        ...meadow,
        accent: '#ff8a5c',
        far: '#b5e08a',
        near: '#82c763',
        decor: ['appleTree', 'bush', 'flower', 'flower2']
    },
    bosque: {
        ...meadow,
        accent: '#3fbf7f',
        sky: ['#6cc6e8', '#cdeee3'],
        far: '#5fae7d',
        near: '#3f8f5e',
        grass: '#4cbf63',
        grassDark: '#35994a',
        ground: '#8a5a3b',
        groundDark: '#6e4429',
        groundDots: '#9c6b4a',
        decor: ['pine', 'mushroom', 'bush', 'pine']
    },
    riacho: {
        ...meadow,
        accent: '#46c3e8',
        sky: ['#68c9f0', '#e2f7ff'],
        far: '#7cc9a8',
        near: '#4fae86',
        decor: ['reeds', 'rock', 'flower', 'bush']
    },
    praia: {
        ...meadow,
        accent: '#ffcf4d',
        sky: ['#4fc3f7', '#c7f0ff'],
        far: '#5ad0e6',
        near: '#2fb4d4',
        grass: '#ffe08a',
        grassDark: '#efc35a',
        ground: '#f3cd7c',
        groundDark: '#dcae5a',
        groundDots: '#f9dc9b',
        decor: ['palm', 'shell', 'starfish', 'shell']
    },
    dunas: {
        ...meadow,
        accent: '#f2a14b',
        sky: ['#ffb36b', '#ffe7b8'],
        sun: '#fff1c4',
        far: '#f3c27a',
        near: '#e7a95c',
        grass: '#f6c776',
        grassDark: '#dfa956',
        ground: '#e6a85e',
        groundDark: '#cd8b45',
        groundDots: '#efbb7a',
        decor: ['cactus', 'rock', 'cactus', 'shell']
    },
    gruta: {
        ...meadow,
        accent: '#b98cff',
        sky: ['#1d1638', '#3a2c63'],
        sun: null,
        far: '#2e2552',
        near: '#3c3068',
        grass: '#8f7bd8',
        grassDark: '#6c58b8',
        ground: '#4b3b78',
        groundDark: '#3a2c63',
        groundDots: '#5b4a8c',
        block: '#7f6bd0',
        blockDark: '#5c4aa8',
        platform: '#8b77d6',
        platformDark: '#6150ad',
        clouds: null,
        decor: ['crystal', 'mushroomGlow', 'crystal', 'rock'],
        night: true
    },
    mina: {
        ...meadow,
        accent: '#ffb347',
        sky: ['#22180f', '#4a3220'],
        sun: null,
        far: '#3b2a1b',
        near: '#4c3622',
        grass: '#a57a4c',
        grassDark: '#7f5a35',
        ground: '#6a4a2c',
        groundDark: '#55391f',
        groundDots: '#7d5a37',
        block: '#c9873c',
        blockDark: '#9a6326',
        clouds: null,
        decor: ['lantern', 'gold', 'rock', 'crystal'],
        night: true
    },
    neve: {
        ...meadow,
        accent: '#8fd8ff',
        sky: ['#9ccff2', '#eef8ff'],
        far: '#d8ecf8',
        near: '#bcdcef',
        grass: '#ffffff',
        grassDark: '#d5e9f5',
        ground: '#8aa6c2',
        groundDark: '#7390ac',
        groundDots: '#9db7d0',
        block: '#c6e6ff',
        blockDark: '#93c4ea',
        decor: ['snowman', 'pineSnow', 'rock', 'pineSnow'],
        snow: true
    },
    glaciar: {
        ...meadow,
        accent: '#5ab8ff',
        sky: ['#6fb2ea', '#dff1ff'],
        far: '#b7dbf3',
        near: '#93c6ea',
        grass: '#e9f7ff',
        grassDark: '#bfe2f7',
        ground: '#6d9dd0',
        groundDark: '#5786ba',
        groundDots: '#86b2de',
        block: '#a8dcff',
        blockDark: '#6fbaf0',
        decor: ['iceSpike', 'pineSnow', 'snowman', 'rock'],
        snow: true
    },
    nuvens: {
        ...meadow,
        accent: '#ff9ad5',
        sky: ['#b9a8ff', '#ffe0f3'],
        far: '#ffffff',
        near: '#f4ecff',
        grass: '#ffffff',
        grassDark: '#e8e0ff',
        ground: '#d9cfff',
        groundDark: '#c3b6f5',
        groundDots: '#e6dfff',
        block: '#ffd36b',
        blockDark: '#efb23d',
        decor: ['rainbow', 'star', 'flower2', 'star']
    },
    docaria: {
        ...meadow,
        accent: '#ff6fb1',
        sky: ['#ff9fcf', '#ffe6f2'],
        far: '#ffc4e1',
        near: '#ff9ccb',
        grass: '#fff4fb',
        grassDark: '#ffd1ea',
        ground: '#8b4f3a',
        groundDark: '#723c2b',
        groundDots: '#a5654c',
        block: '#ff8fc5',
        blockDark: '#e86aa7',
        platform: '#ffd0e6',
        platformDark: '#f29bc4',
        decor: ['lollipop', 'candyCane', 'cupcakeTree', 'lollipop']
    }
};
