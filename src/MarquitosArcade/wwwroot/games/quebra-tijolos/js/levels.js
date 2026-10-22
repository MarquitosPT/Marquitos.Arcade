// Os níveis do Quebra-Tijolos: trinta muralhas desenhadas à mão, em cinco mundos.
//
// Cada nível é uma grelha de texto com 13 letras por linha — a legenda está em
// js/bricks.js (`w o c g r b p y v` são cores, `S` prata, `T` titânio, `E`
// TNT, `#` aço e `.` buraco). Desenha-se a olhar para o texto: o que se vê no
// ficheiro é o que aparece no campo. Os nomes são de uma palavra só, para
// caberem nos cartões do carrossel sem partir a linha (ver o README).
//
// Cada mundo apresenta um tijolo novo e tem a sua cor. A velocidade da bola e
// a largura da raquete não se escrevem nível a nível: crescem e encolhem com
// o número do nível (`levelTuning`), do primeiro ao último.

import {
    BALL_SPEED_FIRST, BALL_SPEED_LAST, PADDLE_W_FIRST, PADDLE_W_LAST, PAR_BASE, PAR_PER_HIT
} from './config.js';
import { checkGrid, hitsToClear, specialKinds } from './bricks.js';

/** Os mundos: nome, cores do cenário e uma dica para quem lá fica sem vidas. */
export const WORLDS = [
    {
        name: 'Néon',
        accent: '#3fd8f2',
        accent2: '#ff6ec7',
        sky: ['#0a1030', '#170c38'],
        grid: 'rgba(63, 216, 242, 0.08)',
        wall: ['#3a4a8c', '#1b2350'],
        hint: 'Bate na bola com a ponta da raquete para a mandar de lado.'
    },
    {
        name: 'Fábrica',
        accent: '#ff9a3c',
        accent2: '#ffd23f',
        sky: ['#1a0f08', '#2b1408'],
        grid: 'rgba(255, 154, 60, 0.08)',
        wall: ['#6b5444', '#33251c'],
        hint: 'O aço não se parte: usa-o para fazer ricochete e chegar aos cantos.'
    },
    {
        name: 'Pólvora',
        accent: '#ff4d6a',
        accent2: '#ff9a3c',
        sky: ['#1c0610', '#2e0a18'],
        grid: 'rgba(255, 77, 106, 0.08)',
        wall: ['#7a2c3c', '#3a1220'],
        hint: 'Uma TNT leva os vizinhos com ela — e se o vizinho for outra TNT, rebenta também.'
    },
    {
        name: 'Cristal',
        accent: '#a46bff',
        accent2: '#3fd8f2',
        sky: ['#0e0828', '#1c0f3e'],
        grid: 'rgba(164, 107, 255, 0.09)',
        wall: ['#55418f', '#261a4c'],
        hint: 'O titânio pede três golpes: abre caminho por onde há menos.'
    },
    {
        name: 'Cosmos',
        accent: '#ffd23f',
        accent2: '#ff6ec7',
        sky: ['#05060f', '#11102a'],
        grid: 'rgba(255, 210, 63, 0.07)',
        wall: ['#4a4a6a', '#1e1e34'],
        hint: 'Apanha as cápsulas: três bolas ou o laser mudam um nível inteiro.'
    }
];

/** Os desenhos. O mundo de cada um é o seu lugar na lista: seis por mundo. */
const DESIGNS = [
    // ---------- Néon: só tijolos de cor, e a prata no fim ----------
    { name: 'Arranque', grid: [
        'rrrrrrrrrrrrr',
        'ooooooooooooo',
        'yyyyyyyyyyyyy',
        'ggggggggggggg',
        'ccccccccccccc'
    ] },
    { name: 'Pirâmide', grid: [
        '......y......',
        '.....yoy.....',
        '....yoroy....',
        '...yorgroy...',
        '..yorgcgroy..',
        '.yorgcbcgroy.',
        'yorgcbpbcgroy'
    ] },
    { name: 'Coração', grid: [
        '..ppp...ppp..',
        '.prrrp.prrrp.',
        'prrwrrprrrrrp',
        'prrrrrrrrrrrp',
        '.prrrrrrrrrp.',
        '..prrrrrrrp..',
        '...prrrrrp...',
        '....prrrp....',
        '.....prp.....',
        '......p......'
    ] },
    { name: 'Xadrez', grid: [
        'S.S.S.S.S.S.S',
        '.b.b.b.b.b.b.',
        'c.c.c.c.c.c.c',
        '.g.g.g.g.g.g.',
        'y.y.y.y.y.y.y',
        '.o.o.o.o.o.o.',
        'r.r.r.r.r.r.r'
    ] },
    { name: 'Invasor', grid: [
        '...g.....g...',
        '....g...g....',
        '...ggggggg...',
        '..ggSgggSgg..',
        '.ggggggggggg.',
        '.g.ggggggg.g.',
        '.g.g.....g.g.',
        '....gg.gg....'
    ] },
    { name: 'Arco-íris', grid: [
        '...rrrrrrr...',
        '..rooooooor..',
        '.rooyyyyyoor.',
        'rooyygggyyoor',
        'roygg...ggyor',
        'roy.......yor',
        'SSS.......SSS'
    ] },

    // ---------- Fábrica: o aço, que não se parte ----------
    { name: 'Portões', grid: [
        'ccccccccccccc',
        'bbbbbbbbbbbbb',
        'vvvvvvvvvvvvv',
        'ppppppppppppp',
        '#####...#####',
        '.............',
        'ooooooooooooo'
    ] },
    { name: 'Colunas', grid: [
        'ooooooooooooo',
        '#ooo#ooo#ooo#',
        '#ooo#ooo#ooo#',
        '#yyy#yyy#yyy#',
        '#ySy#yyy#ySy#',
        '#...#...#...#'
    ] },
    { name: 'Fortaleza', grid: [
        'y.y.y...y.y.y',
        'yyyyy...yyyyy',
        'yrrry...yrrry',
        'yrrryyyyyrrry',
        'yrrrrrrrrrrry',
        'yrr#######rry',
        'yrr#.....#rry'
    ] },
    { name: 'Escadas', grid: [
        'r#.........#r',
        'rr#.......#rr',
        'ooo#.....#ooo',
        'oooo#...#oooo',
        'yyyyy#.#yyyyy',
        'yyyyyy#yyyyyy',
        'ggggggggggggg',
        'cScccccccccSc'
    ] },
    { name: 'Engrenagem', grid: [
        '....#####....',
        '..##ooooo##..',
        '.#oooyyyooo#.',
        '.#ooyySyyoo#.',
        '.#oooyyyooo#.',
        '..#ooooooo#..'
    ] },
    { name: 'Ilhas', grid: [
        'vvvvvvvvvvvvv',
        'vvvvvvvvvvvvv',
        '..##.....##..',
        'bbbbbbbbbbbbb',
        'bbbbbbbbbbbbb',
        '.....###.....',
        'ccccccccccccc',
        'ccccccccccccc'
    ] },

    // ---------- Pólvora: a TNT ----------
    { name: 'Rastilho', grid: [
        'ggggggggggggg',
        'ggggggggggggg',
        'rrrrrrErrrrrr',
        'yyyyyyyyyyyyy',
        'yyyEyyyyyEyyy',
        'ooooooooooooo'
    ] },
    { name: 'Minas', grid: [
        'ccccccccccccc',
        'ccEcccEcccEcc',
        'bbbbbbbbbbbbb',
        'bbbbbbbbbbbbb',
        'EbbbbEbEbbbbE',
        'vvvvvvvvvvvvv'
    ] },
    { name: 'Barril', grid: [
        'rr..#####..rr',
        'rr.#yyyyy#.rr',
        'oo#yyEEEyy#oo',
        'oo#yEEEEEy#oo',
        'oo#yyEEEyy#oo',
        'rr.#yyyyy#.rr',
        'rr..##.##..rr'
    ] },
    { name: 'Dominó', grid: [
        'ppppppppppppp',
        'pEpppppppppEp',
        'vvEvvvvvvvEvv',
        'bbbEbbbbbEbbb',
        'ccccEcccEcccc',
        'gggggEgEggggg',
        'yyyyyyEyyyyyy'
    ] },
    { name: 'Foguete', grid: [
        '......E......',
        '....rrrrr....',
        '..rrrrErrrr..',
        '.rrrEEEEErrr.',
        '..rrrrErrrr..',
        '....rrrrr....',
        '......E......',
        '.............',
        'SS.........SS'
    ] },
    { name: 'Muralha', grid: [
        'ooooooooooooo',
        'yyyyyyyyyyyyy',
        'yyyyyyyyyyyyy',
        '###E#####E###',
        '.............',
        'rrrrrrrrrrrrr',
        'r.r.r.r.r.r.r'
    ] },

    // ---------- Cristal: o titânio ----------
    { name: 'Diamante', grid: [
        '......T......',
        '.....TvT.....',
        '....TvvvT....',
        '...TvvSvvT...',
        '..TvvSSSvvT..',
        '...TvvSvvT...',
        '....TvvvT....',
        '.....TvT.....',
        '......T......'
    ] },
    { name: 'Colmeia', grid: [
        'yyTyyyTyyyTyy',
        'yTyTyTyTyTyTy',
        'Tyyy.yyy.yyyT',
        'yTyTyTyTyTyTy',
        'yyTyyyTyyyTyy',
        'ooooooooooooo'
    ] },
    { name: 'Totem', grid: [
        '...ggggggg...',
        '...gTgggTg...',
        '...ggggggg...',
        '....bbbbb....',
        '..ccbTbTbcc..',
        '....bbbbb....',
        '...rrrrrrr...',
        '...rTrrrTr...',
        '...rrrrrrr...',
        '....#...#....'
    ] },
    { name: 'Prisma', grid: [
        'vvvvvvvvvvvvv',
        'vSvSvSvSvSvSv',
        'bbbbbbbbbbbbb',
        'bTbTbTbTbTbTb',
        'ccccccccccccc',
        'cScScScScScSc',
        'ggggggggggggg',
        '#...........#'
    ] },
    { name: 'Cristais', grid: [
        'T.....T.....T',
        'cT...cTc...Tc',
        'ccT.ccScc.Tcc',
        'cccTcccccTccc',
        'ccccTcccTcccc',
        'cccccTcTccccc',
        'bbbbbbTbbbbbb',
        'bbbbbbbbbbbbb'
    ] },
    { name: 'Cofre', grid: [
        '..#########..',
        '..#yyyyyyy#..',
        '..#yySySyy#..',
        '..#yyyyyyy#..',
        '..###TTT###..',
        'o...........o',
        'oo.........oo',
        'ooo.......ooo'
    ] },

    // ---------- Cosmos: tudo junto ----------
    { name: 'Foguetão', grid: [
        '......r......',
        '.....rwr.....',
        '....rwwwr....',
        '....wbbbw....',
        '....wbcbw....',
        '....wbbbw....',
        '....wwwww....',
        '...TwwwwwT...',
        '..TT.www.TT..',
        '..T..oyo..T..',
        '.....yEy.....',
        '......y......'
    ] },
    { name: 'Planeta', grid: [
        '....ppppp....',
        '..ppvvvvvpp..',
        '.pvvbbbbbvvp.',
        'SSSSSSSSSSSSS',
        '.pvvbbbbbvvp.',
        '..ppvvvvvpp..',
        '....ppppp....'
    ] },
    { name: 'Estrela', grid: [
        '......o......',
        '.....oyo.....',
        'oooooyyyooooo',
        '.oyyyyTyyyyo.',
        '..oyyyyyyyo..',
        '...oyyyyyo...',
        '..oyyo.oyyo..',
        '.oyo.....oyo.',
        'oo.........oo'
    ] },
    { name: 'Nave', grid: [
        '..#.......#..',
        '...#.....#...',
        '..vvvvvvvvv..',
        '.vvSvvvvvSvv.',
        'vvvvvvvvvvvvv',
        'vEvvvvvvvvvEv',
        'vvvTTTTTTTvvv',
        '.v.v.....v.v.'
    ] },
    { name: 'Eclipse', grid: [
        '....TTTTT....',
        '..TT#####TT..',
        '.T#ppppppp#T.',
        'T#ppEpppEpp#T',
        '.T#ppppppp#T.',
        '..TT#...#TT..',
        '....T...T....'
    ] },
    { name: 'Apoteose', grid: [
        'rrrrrrrrrrrrr',
        'oSoSoSoSoSoSo',
        'yyyyyyyyyyyyy',
        'gTgggEgEgggTg',
        'ccccccccccccc',
        'bSbSbSbSbSbSb',
        'vvvvvvvvvvvvv',
        'pppppTpTppppp',
        '##.........##'
    ] }
];

/** Mundos de seis níveis: o nível 7 abre o segundo. */
export const LEVELS_PER_WORLD = 6;

/** Velocidade e raquete deste nível: do primeiro ao último, em linha reta. */
function levelTuning(id, count) {
    const t = count > 1 ? (id - 1) / (count - 1) : 0;
    return {
        ballSpeed: Math.round(BALL_SPEED_FIRST + (BALL_SPEED_LAST - BALL_SPEED_FIRST) * t),
        paddleW: Math.round(PADDLE_W_FIRST + (PADDLE_W_LAST - PADDLE_W_FIRST) * t)
    };
}

export const LEVELS = DESIGNS.map((design, index) => {
    const id = index + 1;
    const world = WORLDS[Math.floor(index / LEVELS_PER_WORLD)];
    const level = {
        id,
        name: design.name,
        grid: design.grid,
        world,
        accent: world.accent,
        hint: design.hint || world.hint,
        ...levelTuning(id, DESIGNS.length)
    };
    checkGrid(level);
    level.hits = hitsToClear(level);
    level.kinds = specialKinds(level);
    /** Tempo-alvo da terceira estrela, em segundos, arredondado aos 5. */
    level.par = Math.ceil((PAR_BASE + level.hits * PAR_PER_HIT) / 5) * 5;
    return level;
});

export const levelCount = () => LEVELS.length;
export const levelById = (id) => LEVELS[id - 1] || null;
