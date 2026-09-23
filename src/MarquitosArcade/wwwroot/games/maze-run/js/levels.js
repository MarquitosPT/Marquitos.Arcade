// Os níveis do Maze Run.
//
// Um nível é uma receita: o tamanho do labirinto, a semente, quantos cristais,
// que guardas, que peças e quanto tempo. O labirinto sai da semente (ver
// maze.js) e as colocações saem daqui — por isso **acrescentar um nível é
// acrescentar uma entrada ao array `LEVELS`**, e mais nada. Não há mapas
// desenhados à mão para manter nem ficheiros de dados à parte.
//
// O que cada campo faz:
//
//   cols, rows   tamanho do labirinto em células (acertados para ímpar)
//   seed         a semente: o mesmo número dá sempre o mesmo labirinto
//                (num nível com portas, a semente escolhe-se pelo que sai: nem
//                 todos os labirintos dão para trancar — ver `placeDoors`)
//   braid        de 0 a 1, quantos becos sem saída se abrem (ver maze.js)
//   crystals     cristais a apanhar antes de a saída abrir
//   freezers     cristais de gelo que congelam os guardas (opcionais)
//   portals      pares de portais que ligam dois pontos do labirinto
//   doors        portas trancadas, cada uma com a sua chave
//   guards       os guardas, pela ordem por que aparecem: { kind, speed }
//   seconds      o tempo da tentativa
//   par          o tempo-alvo: abaixo dele ganha-se a segunda estrela
//   lives        vidas da tentativa (por omissão, DEFAULT_LIVES)
//   accent       a cor do nível — paredes, HUD e cartão do menu

import { DEFAULT_LIVES, ENEMY_BASE_SPEED, GUARD_START_SECONDS, MAX_STARS } from './config.js';
import { buildMaze, canReach, cellKey, distanceField, exitsFrom, shortestPath, START, STEPS } from './maze.js';

/**
 * Os guardas:
 *
 *   roam     anda ao acaso, só não volta para trás — é o que enche o labirinto
 *   chase    desce o mapa de distâncias até ao jogador: vem mesmo atrás
 *   ambush   persegue uma célula à frente do jogador, para lhe cortar o caminho
 *
 * A diferença entre eles é só a célula que tomam por alvo (ver enemies.js), e é
 * de propósito: um guarda novo é uma forma nova de escolher o alvo, não um
 * motor de movimento novo.
 */
export const GUARD_ROAM = 'roam';
export const GUARD_CHASE = 'chase';
export const GUARD_AMBUSH = 'ambush';

/** As cores dos pares de portais e dos pares chave/porta, por ordem de uso. */
export const PORTAL_COLORS = ['#35e0ff', '#ffc14d', '#ff5d9e'];
export const DOOR_COLORS = ['#ffc14d', '#5ef3a0', '#ff8a3d'];

/**
 * Os quarenta e oito níveis, por ordem.
 *
 * A curva sobe de quatro em quatro: cada degrau apresenta ou aperta uma coisa —
 * o tamanho do labirinto, mais um guarda, uma peça nova — e os quatro níveis do
 * degrau dão tempo para a aprender antes do seguinte. Do 1 ao 4 há só cristais
 * e dois guardas; o gelo entra no 5, os portais no 9, a porta trancada no 17 e
 * a segunda porta no 25.
 *
 * Quarenta e oito é também o número que enche as páginas do carrossel em todos
 * os formatos: 12 páginas de 4 ao alto, 16 de 3 ao comprido, 8 de 6 no
 * computador (ver css/carousel.css).
 *
 * As sementes não foram escolhidas à mão: nem todos os labirintos dão para
 * trancar (ver `placeDoors`), por isso cada uma foi procurada até dar um nível
 * que cumpre a receita toda. O cenário `maze-run-mecanicas` do smoke-test monta
 * os quarenta e oito e falha se algum deixar de cumprir.
 *
 * Os nomes são de uma palavra de propósito: no cartão do menu não podem quebrar
 * em duas linhas, senão desalinham a fila toda (ver `.levelName` em
 * css/controls.css).
 */
export const LEVELS = [
    {
        id: 1,
        name: 'Cripta',
        hint: 'Apanha os cristais todos: é isso que abre a saída.',
        cols: 13, rows: 11, seed: 104729, braid: 0.3,
        crystals: 6,
        guards: [{ kind: GUARD_CHASE, speed: 0.64 }, { kind: GUARD_ROAM, speed: 0.625 }],
        seconds: 104, par: 54,
        accent: '#5ad8f2'
    },
    {
        id: 2,
        name: 'Poço',
        hint: 'Um guarda que vem atrás não vira para trás. Usa isso.',
        cols: 13, rows: 11, seed: 209458, braid: 0.304,
        crystals: 6,
        guards: [{ kind: GUARD_CHASE, speed: 0.646 }, { kind: GUARD_ROAM, speed: 0.631 }],
        seconds: 104, par: 54,
        accent: '#5ac7f2'
    },
    {
        id: 3,
        name: 'Cave',
        hint: 'Inverter a marcha é imediato; virar numa esquina espera pela esquina.',
        cols: 13, rows: 11, seed: 314187, braid: 0.308,
        crystals: 7,
        guards: [{ kind: GUARD_CHASE, speed: 0.653 }, { kind: GUARD_ROAM, speed: 0.638 }],
        seconds: 107, par: 56,
        accent: '#5ab5f2'
    },
    {
        id: 4,
        name: 'Túnel',
        hint: 'Um beco sem saída com um guarda atrás não tem jogada nenhuma.',
        cols: 13, rows: 11, seed: 418916, braid: 0.312,
        crystals: 7,
        guards: [{ kind: GUARD_CHASE, speed: 0.659 }, { kind: GUARD_ROAM, speed: 0.644 }],
        seconds: 107, par: 56,
        accent: '#5aa3f2'
    },
    {
        id: 5,
        name: 'Néon',
        hint: 'O cristal de gelo congela os guardas. Guarda-o para quando precisares.',
        cols: 13, rows: 11, seed: 523645, braid: 0.313,
        crystals: 7,
        freezers: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.666 },
            { kind: GUARD_AMBUSH, speed: 0.651 },
            { kind: GUARD_ROAM, speed: 0.636 }
        ],
        seconds: 107, par: 56,
        accent: '#5a91f2'
    },
    {
        id: 6,
        name: 'Geleira',
        hint: 'A porta trancada também trava os guardas. Enquanto está fechada, é um abrigo.',
        cols: 13, rows: 11, seed: 628374, braid: 0.317,
        crystals: 7,
        freezers: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.672 },
            { kind: GUARD_AMBUSH, speed: 0.657 },
            { kind: GUARD_ROAM, speed: 0.642 }
        ],
        seconds: 107, par: 56,
        accent: '#5a80f2'
    },
    {
        id: 7,
        name: 'Fundição',
        hint: 'O emboscador não vem atrás de ti: vai para onde tu vais.',
        cols: 13, rows: 11, seed: 733103, braid: 0.321,
        crystals: 8,
        freezers: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.678 },
            { kind: GUARD_AMBUSH, speed: 0.663 },
            { kind: GUARD_ROAM, speed: 0.648 }
        ],
        seconds: 111, par: 58,
        accent: '#5a6ef2'
    },
    {
        id: 8,
        name: 'Névoa',
        hint: 'Um portal é um atalho para os dois lados.',
        cols: 13, rows: 11, seed: 837832, braid: 0.325,
        crystals: 8,
        freezers: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.685 },
            { kind: GUARD_AMBUSH, speed: 0.67 },
            { kind: GUARD_ROAM, speed: 0.655 }
        ],
        seconds: 111, par: 58,
        accent: '#5a5cf2'
    },
    {
        id: 9,
        name: 'Ferro',
        hint: 'Os portais levam-te ao outro lado num instante — mas os guardas também os usam.',
        cols: 15, rows: 13, seed: 942561, braid: 0.326,
        crystals: 8,
        freezers: 1,
        portals: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.691 },
            { kind: GUARD_AMBUSH, speed: 0.676 },
            { kind: GUARD_ROAM, speed: 0.661 }
        ],
        seconds: 115, par: 60,
        accent: '#695af2'
    },
    {
        id: 10,
        name: 'Vórtice',
        hint: 'Deixa o cristal que está no meio dos guardas para quando tiveres o gelo.',
        cols: 15, rows: 13, seed: 47290, braid: 0.33,
        crystals: 8,
        freezers: 1,
        portals: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.697 },
            { kind: GUARD_AMBUSH, speed: 0.682 },
            { kind: GUARD_ROAM, speed: 0.667 }
        ],
        seconds: 115, par: 60,
        accent: '#7b5af2'
    },
    {
        id: 11,
        name: 'Espiral',
        hint: 'Um guarda a tremer é gelo prestes a derreter.',
        cols: 15, rows: 13, seed: 152019, braid: 0.334,
        crystals: 9,
        freezers: 1,
        portals: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.704 },
            { kind: GUARD_AMBUSH, speed: 0.689 },
            { kind: GUARD_ROAM, speed: 0.674 }
        ],
        seconds: 119, par: 62,
        accent: '#8d5af2'
    },
    {
        id: 12,
        name: 'Trânsito',
        hint: 'Vê onde está a saída antes de ires buscar o primeiro cristal.',
        cols: 15, rows: 13, seed: 256748, braid: 0.338,
        crystals: 9,
        freezers: 1,
        portals: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.71 },
            { kind: GUARD_AMBUSH, speed: 0.695 },
            { kind: GUARD_ROAM, speed: 0.68 }
        ],
        seconds: 119, par: 62,
        accent: '#9f5af2'
    },
    {
        id: 13,
        name: 'Bronze',
        hint: 'Dois pares de portais. A cor diz-te onde vais sair.',
        cols: 15, rows: 13, seed: 361477, braid: 0.339,
        crystals: 9,
        freezers: 1,
        portals: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.717 },
            { kind: GUARD_CHASE, speed: 0.702 },
            { kind: GUARD_AMBUSH, speed: 0.687 },
            { kind: GUARD_ROAM, speed: 0.672 }
        ],
        seconds: 119, par: 62,
        accent: '#b15af2'
    },
    {
        id: 14,
        name: 'Prisma',
        hint: 'A cor da chave diz-te qual é a porta que ela abre.',
        cols: 15, rows: 13, seed: 466206, braid: 0.343,
        crystals: 9,
        freezers: 1,
        portals: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.723 },
            { kind: GUARD_CHASE, speed: 0.708 },
            { kind: GUARD_AMBUSH, speed: 0.693 },
            { kind: GUARD_ROAM, speed: 0.678 }
        ],
        seconds: 119, par: 62,
        accent: '#c25af2'
    },
    {
        id: 15,
        name: 'Miragem',
        hint: 'Perder uma vida repõe toda a gente no sítio — o relógio é que não volta atrás.',
        cols: 15, rows: 13, seed: 570936, braid: 0.347,
        crystals: 10,
        freezers: 1,
        portals: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.729 },
            { kind: GUARD_CHASE, speed: 0.714 },
            { kind: GUARD_AMBUSH, speed: 0.699 },
            { kind: GUARD_ROAM, speed: 0.684 }
        ],
        seconds: 122, par: 63,
        accent: '#d45af2'
    },
    {
        id: 16,
        name: 'Dédalo',
        hint: 'Ao passares por um cruzamento, repara por onde o guarda foi.',
        cols: 15, rows: 13, seed: 675664, braid: 0.351,
        crystals: 10,
        freezers: 1,
        portals: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.736 },
            { kind: GUARD_CHASE, speed: 0.721 },
            { kind: GUARD_AMBUSH, speed: 0.706 },
            { kind: GUARD_ROAM, speed: 0.691 }
        ],
        seconds: 122, par: 63,
        accent: '#e65af2'
    },
    {
        id: 17,
        name: 'Fornalha',
        hint: 'A chave abre a porta trancada — e enquanto estiver fechada, nem os guardas passam.',
        cols: 17, rows: 13, seed: 780393, braid: 0.352,
        crystals: 10,
        freezers: 1,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.742 },
            { kind: GUARD_CHASE, speed: 0.727 },
            { kind: GUARD_AMBUSH, speed: 0.712 },
            { kind: GUARD_ROAM, speed: 0.697 }
        ],
        seconds: 124, par: 64,
        accent: '#f25aec'
    },
    {
        id: 18,
        name: 'Trinco',
        hint: 'O número dentro do portal da saída diz quantos cristais faltam.',
        cols: 17, rows: 13, seed: 885122, braid: 0.356,
        crystals: 10,
        freezers: 1,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.749 },
            { kind: GUARD_CHASE, speed: 0.734 },
            { kind: GUARD_AMBUSH, speed: 0.719 },
            { kind: GUARD_ROAM, speed: 0.704 }
        ],
        seconds: 124, par: 64,
        accent: '#f25ada'
    },
    {
        id: 19,
        name: 'Cofre',
        hint: 'Inverter a marcha é imediato; virar numa esquina espera pela esquina.',
        cols: 17, rows: 13, seed: 997770, braid: 0.36,
        crystals: 11,
        freezers: 2,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.755 },
            { kind: GUARD_CHASE, speed: 0.74 },
            { kind: GUARD_AMBUSH, speed: 0.725 },
            { kind: GUARD_ROAM, speed: 0.71 }
        ],
        seconds: 128, par: 67,
        accent: '#f25ac8'
    },
    {
        id: 20,
        name: 'Brasa',
        hint: 'Um beco sem saída com um guarda atrás não tem jogada nenhuma.',
        cols: 17, rows: 13, seed: 94580, braid: 0.364,
        crystals: 11,
        freezers: 2,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.761 },
            { kind: GUARD_CHASE, speed: 0.746 },
            { kind: GUARD_AMBUSH, speed: 0.731 },
            { kind: GUARD_ROAM, speed: 0.716 }
        ],
        seconds: 128, par: 67,
        accent: '#f25ab6'
    },
    {
        id: 21,
        name: 'Forja',
        hint: 'A chave está do outro lado do portal. Vai lá e volta antes que te encontrem.',
        cols: 17, rows: 13, seed: 199309, braid: 0.365,
        crystals: 11,
        freezers: 2,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.768 },
            { kind: GUARD_CHASE, speed: 0.753 },
            { kind: GUARD_AMBUSH, speed: 0.738 },
            { kind: GUARD_ROAM, speed: 0.723 }
        ],
        seconds: 128, par: 67,
        accent: '#f25aa5'
    },
    {
        id: 22,
        name: 'Roldana',
        hint: 'A porta trancada também trava os guardas. Enquanto está fechada, é um abrigo.',
        cols: 17, rows: 13, seed: 311957, braid: 0.369,
        crystals: 11,
        freezers: 2,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.774 },
            { kind: GUARD_CHASE, speed: 0.759 },
            { kind: GUARD_AMBUSH, speed: 0.744 },
            { kind: GUARD_ROAM, speed: 0.729 }
        ],
        seconds: 128, par: 67,
        accent: '#f25a93'
    },
    {
        id: 23,
        name: 'Relógio',
        hint: 'O emboscador não vem atrás de ti: vai para onde tu vais.',
        cols: 17, rows: 13, seed: 408767, braid: 0.373,
        crystals: 12,
        freezers: 2,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.78 },
            { kind: GUARD_CHASE, speed: 0.765 },
            { kind: GUARD_AMBUSH, speed: 0.75 },
            { kind: GUARD_ROAM, speed: 0.735 }
        ],
        seconds: 132, par: 69,
        accent: '#f25a81'
    },
    {
        id: 24,
        name: 'Oficina',
        hint: 'Um portal é um atalho para os dois lados.',
        cols: 17, rows: 13, seed: 513497, braid: 0.377,
        crystals: 12,
        freezers: 2,
        portals: 2,
        doors: 1,
        guards: [
            { kind: GUARD_CHASE, speed: 0.787 },
            { kind: GUARD_CHASE, speed: 0.772 },
            { kind: GUARD_AMBUSH, speed: 0.757 },
            { kind: GUARD_ROAM, speed: 0.742 }
        ],
        seconds: 132, par: 69,
        accent: '#f25a6f'
    },
    {
        id: 25,
        name: 'Selado',
        hint: 'Duas portas em cadeia: a primeira chave abre o caminho para a segunda.',
        cols: 19, rows: 15, seed: 618225, braid: 0.378,
        crystals: 12,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.793 },
            { kind: GUARD_CHASE, speed: 0.778 },
            { kind: GUARD_AMBUSH, speed: 0.763 },
            { kind: GUARD_AMBUSH, speed: 0.748 },
            { kind: GUARD_ROAM, speed: 0.733 }
        ],
        seconds: 137, par: 71,
        accent: '#f25a5e'
    },
    {
        id: 26,
        name: 'Cadeado',
        hint: 'Deixa o cristal que está no meio dos guardas para quando tiveres o gelo.',
        cols: 19, rows: 15, seed: 730873, braid: 0.382,
        crystals: 12,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.8 },
            { kind: GUARD_CHASE, speed: 0.785 },
            { kind: GUARD_AMBUSH, speed: 0.77 },
            { kind: GUARD_AMBUSH, speed: 0.755 },
            { kind: GUARD_ROAM, speed: 0.74 }
        ],
        seconds: 137, par: 71,
        accent: '#f2685a'
    },
    {
        id: 27,
        name: 'Masmorra',
        hint: 'Um guarda a tremer é gelo prestes a derreter.',
        cols: 19, rows: 15, seed: 843523, braid: 0.386,
        crystals: 13,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.806 },
            { kind: GUARD_CHASE, speed: 0.791 },
            { kind: GUARD_AMBUSH, speed: 0.776 },
            { kind: GUARD_AMBUSH, speed: 0.761 },
            { kind: GUARD_ROAM, speed: 0.746 }
        ],
        seconds: 141, par: 73,
        accent: '#f27a5a'
    },
    {
        id: 28,
        name: 'Calabouço',
        hint: 'Vê onde está a saída antes de ires buscar o primeiro cristal.',
        cols: 19, rows: 15, seed: 964090, braid: 0.39,
        crystals: 13,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.812 },
            { kind: GUARD_CHASE, speed: 0.797 },
            { kind: GUARD_AMBUSH, speed: 0.782 },
            { kind: GUARD_AMBUSH, speed: 0.767 },
            { kind: GUARD_ROAM, speed: 0.752 }
        ],
        seconds: 141, par: 73,
        accent: '#f28b5a'
    },
    {
        id: 29,
        name: 'Catacumba',
        hint: 'Os guardas não atravessam uma porta trancada. Nem tu.',
        cols: 19, rows: 15, seed: 52979, braid: 0.391,
        crystals: 13,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.819 },
            { kind: GUARD_CHASE, speed: 0.804 },
            { kind: GUARD_AMBUSH, speed: 0.789 },
            { kind: GUARD_AMBUSH, speed: 0.774 },
            { kind: GUARD_ROAM, speed: 0.759 }
        ],
        seconds: 141, par: 73,
        accent: '#f29d5a'
    },
    {
        id: 30,
        name: 'Ossário',
        hint: 'A cor da chave diz-te qual é a porta que ela abre.',
        cols: 19, rows: 15, seed: 141870, braid: 0.395,
        crystals: 13,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.825 },
            { kind: GUARD_CHASE, speed: 0.81 },
            { kind: GUARD_AMBUSH, speed: 0.795 },
            { kind: GUARD_AMBUSH, speed: 0.78 },
            { kind: GUARD_ROAM, speed: 0.765 }
        ],
        seconds: 141, par: 73,
        accent: '#f2af5a'
    },
    {
        id: 31,
        name: 'Sarcófago',
        hint: 'Perder uma vida repõe toda a gente no sítio — o relógio é que não volta atrás.',
        cols: 19, rows: 15, seed: 254518, braid: 0.399,
        crystals: 14,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.831 },
            { kind: GUARD_CHASE, speed: 0.816 },
            { kind: GUARD_AMBUSH, speed: 0.801 },
            { kind: GUARD_AMBUSH, speed: 0.786 },
            { kind: GUARD_ROAM, speed: 0.771 }
        ],
        seconds: 144, par: 75,
        accent: '#f2c15a'
    },
    {
        id: 32,
        name: 'Templo',
        hint: 'Ao passares por um cruzamento, repara por onde o guarda foi.',
        cols: 19, rows: 15, seed: 359248, braid: 0.403,
        crystals: 14,
        freezers: 2,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.838 },
            { kind: GUARD_CHASE, speed: 0.823 },
            { kind: GUARD_AMBUSH, speed: 0.808 },
            { kind: GUARD_AMBUSH, speed: 0.793 },
            { kind: GUARD_ROAM, speed: 0.778 }
        ],
        seconds: 144, par: 75,
        accent: '#f2d25a'
    },
    {
        id: 33,
        name: 'Santuário',
        hint: 'Os guardas dispersam de vez em quando — é aí que se vai buscar o que ficou para trás.',
        cols: 19, rows: 15, seed: 456057, braid: 0.404,
        crystals: 14,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.844 },
            { kind: GUARD_CHASE, speed: 0.829 },
            { kind: GUARD_AMBUSH, speed: 0.814 },
            { kind: GUARD_AMBUSH, speed: 0.799 },
            { kind: GUARD_ROAM, speed: 0.784 }
        ],
        seconds: 144, par: 75,
        accent: '#f2e45a'
    },
    {
        id: 34,
        name: 'Obelisco',
        hint: 'O número dentro do portal da saída diz quantos cristais faltam.',
        cols: 19, rows: 15, seed: 560787, braid: 0.408,
        crystals: 14,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.851 },
            { kind: GUARD_CHASE, speed: 0.836 },
            { kind: GUARD_AMBUSH, speed: 0.821 },
            { kind: GUARD_AMBUSH, speed: 0.806 },
            { kind: GUARD_ROAM, speed: 0.791 }
        ],
        seconds: 144, par: 75,
        accent: '#edf25a'
    },
    {
        id: 35,
        name: 'Zigurate',
        hint: 'Inverter a marcha é imediato; virar numa esquina espera pela esquina.',
        cols: 19, rows: 15, seed: 689272, braid: 0.412,
        crystals: 15,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.857 },
            { kind: GUARD_CHASE, speed: 0.842 },
            { kind: GUARD_AMBUSH, speed: 0.827 },
            { kind: GUARD_AMBUSH, speed: 0.812 },
            { kind: GUARD_ROAM, speed: 0.797 }
        ],
        seconds: 148, par: 77,
        accent: '#dcf25a'
    },
    {
        id: 36,
        name: 'Ruína',
        hint: 'Um beco sem saída com um guarda atrás não tem jogada nenhuma.',
        cols: 19, rows: 15, seed: 786082, braid: 0.416,
        crystals: 15,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.863 },
            { kind: GUARD_CHASE, speed: 0.848 },
            { kind: GUARD_AMBUSH, speed: 0.833 },
            { kind: GUARD_AMBUSH, speed: 0.818 },
            { kind: GUARD_ROAM, speed: 0.803 }
        ],
        seconds: 148, par: 77,
        accent: '#caf25a'
    },
    {
        id: 37,
        name: 'Espelhos',
        hint: 'Daqui para a frente é tudo ao mesmo tempo. Decide antes de entrares no corredor.',
        cols: 21, rows: 15, seed: 890811, braid: 0.417,
        crystals: 15,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.87 },
            { kind: GUARD_CHASE, speed: 0.855 },
            { kind: GUARD_CHASE, speed: 0.84 },
            { kind: GUARD_AMBUSH, speed: 0.825 },
            { kind: GUARD_AMBUSH, speed: 0.81 },
            { kind: GUARD_ROAM, speed: 0.795 }
        ],
        seconds: 150, par: 78,
        accent: '#b8f25a'
    },
    {
        id: 38,
        name: 'Mosaico',
        hint: 'A porta trancada também trava os guardas. Enquanto está fechada, é um abrigo.',
        cols: 21, rows: 15, seed: 11379, braid: 0.421,
        crystals: 15,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.876 },
            { kind: GUARD_CHASE, speed: 0.861 },
            { kind: GUARD_CHASE, speed: 0.846 },
            { kind: GUARD_AMBUSH, speed: 0.831 },
            { kind: GUARD_AMBUSH, speed: 0.816 },
            { kind: GUARD_ROAM, speed: 0.801 }
        ],
        seconds: 150, par: 78,
        accent: '#a6f25a'
    },
    {
        id: 39,
        name: 'Colmeia',
        hint: 'O emboscador não vem atrás de ti: vai para onde tu vais.',
        cols: 21, rows: 15, seed: 84431, braid: 0.425,
        crystals: 16,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.883 },
            { kind: GUARD_CHASE, speed: 0.868 },
            { kind: GUARD_CHASE, speed: 0.853 },
            { kind: GUARD_AMBUSH, speed: 0.838 },
            { kind: GUARD_AMBUSH, speed: 0.823 },
            { kind: GUARD_ROAM, speed: 0.808 }
        ],
        seconds: 154, par: 80,
        accent: '#95f25a'
    },
    {
        id: 40,
        name: 'Teia',
        hint: 'Um portal é um atalho para os dois lados.',
        cols: 21, rows: 15, seed: 236677, braid: 0.429,
        crystals: 16,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.889 },
            { kind: GUARD_CHASE, speed: 0.874 },
            { kind: GUARD_CHASE, speed: 0.859 },
            { kind: GUARD_AMBUSH, speed: 0.844 },
            { kind: GUARD_AMBUSH, speed: 0.829 },
            { kind: GUARD_ROAM, speed: 0.814 }
        ],
        seconds: 154, par: 80,
        accent: '#83f25a'
    },
    {
        id: 41,
        name: 'Enredo',
        hint: 'O relógio só anda enquanto se joga. Parar a pensar não custa nada.',
        cols: 21, rows: 17, seed: 301808, braid: 0.43,
        crystals: 16,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.895 },
            { kind: GUARD_CHASE, speed: 0.88 },
            { kind: GUARD_CHASE, speed: 0.865 },
            { kind: GUARD_AMBUSH, speed: 0.85 },
            { kind: GUARD_AMBUSH, speed: 0.835 },
            { kind: GUARD_ROAM, speed: 0.82 }
        ],
        seconds: 157, par: 82,
        accent: '#71f25a'
    },
    {
        id: 42,
        name: 'Meandro',
        hint: 'Deixa o cristal que está no meio dos guardas para quando tiveres o gelo.',
        cols: 21, rows: 17, seed: 398618, braid: 0.434,
        crystals: 16,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.902 },
            { kind: GUARD_CHASE, speed: 0.887 },
            { kind: GUARD_CHASE, speed: 0.872 },
            { kind: GUARD_AMBUSH, speed: 0.857 },
            { kind: GUARD_AMBUSH, speed: 0.842 },
            { kind: GUARD_ROAM, speed: 0.827 }
        ],
        seconds: 157, par: 82,
        accent: '#5ff25a'
    },
    {
        id: 43,
        name: 'Fenda',
        hint: 'Um guarda a tremer é gelo prestes a derreter.',
        cols: 21, rows: 17, seed: 527104, braid: 0.438,
        crystals: 17,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.908 },
            { kind: GUARD_CHASE, speed: 0.893 },
            { kind: GUARD_CHASE, speed: 0.878 },
            { kind: GUARD_AMBUSH, speed: 0.863 },
            { kind: GUARD_AMBUSH, speed: 0.848 },
            { kind: GUARD_ROAM, speed: 0.833 }
        ],
        seconds: 161, par: 84,
        accent: '#5af266'
    },
    {
        id: 44,
        name: 'Caverna',
        hint: 'Vê onde está a saída antes de ires buscar o primeiro cristal.',
        cols: 21, rows: 17, seed: 608076, braid: 0.442,
        crystals: 17,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.914 },
            { kind: GUARD_CHASE, speed: 0.899 },
            { kind: GUARD_CHASE, speed: 0.884 },
            { kind: GUARD_AMBUSH, speed: 0.869 },
            { kind: GUARD_AMBUSH, speed: 0.854 },
            { kind: GUARD_ROAM, speed: 0.839 }
        ],
        seconds: 161, par: 84,
        accent: '#5af278'
    },
    {
        id: 45,
        name: 'Sombra',
        hint: 'Os últimos quatro. A partir daqui não há corredor que não tenha companhia.',
        cols: 23, rows: 17, seed: 712805, braid: 0.443,
        crystals: 17,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.921 },
            { kind: GUARD_CHASE, speed: 0.906 },
            { kind: GUARD_CHASE, speed: 0.891 },
            { kind: GUARD_AMBUSH, speed: 0.876 },
            { kind: GUARD_AMBUSH, speed: 0.861 },
            { kind: GUARD_ROAM, speed: 0.846 }
        ],
        seconds: 164, par: 85,
        accent: '#5af28a'
    },
    {
        id: 46,
        name: 'Eclipse',
        hint: 'Seis guardas, e três deles vêm atrás de ti a sério.',
        cols: 23, rows: 17, seed: 833372, braid: 0.447,
        crystals: 17,
        freezers: 3,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.927 },
            { kind: GUARD_CHASE, speed: 0.912 },
            { kind: GUARD_CHASE, speed: 0.897 },
            { kind: GUARD_AMBUSH, speed: 0.882 },
            { kind: GUARD_AMBUSH, speed: 0.867 },
            { kind: GUARD_ROAM, speed: 0.852 }
        ],
        seconds: 164, par: 85,
        accent: '#5af29c'
    },
    {
        id: 47,
        name: 'Abismo',
        hint: 'O segundo maior labirinto do jogo. Faz o caminho de volta antes de o teres de fazer.',
        cols: 23, rows: 17, seed: 953940, braid: 0.451,
        crystals: 18,
        freezers: 4,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.934 },
            { kind: GUARD_CHASE, speed: 0.919 },
            { kind: GUARD_CHASE, speed: 0.904 },
            { kind: GUARD_AMBUSH, speed: 0.889 },
            { kind: GUARD_AMBUSH, speed: 0.874 },
            { kind: GUARD_ROAM, speed: 0.859 }
        ],
        seconds: 167, par: 87,
        accent: '#5af2ad'
    },
    {
        id: 48,
        name: 'Zénite',
        hint: 'O último. Tudo o que aprendeste, ao mesmo tempo e à pressa.',
        cols: 23, rows: 17, seed: 42830, braid: 0.455,
        crystals: 18,
        freezers: 4,
        portals: 2,
        doors: 2,
        guards: [
            { kind: GUARD_CHASE, speed: 0.94 },
            { kind: GUARD_CHASE, speed: 0.925 },
            { kind: GUARD_CHASE, speed: 0.91 },
            { kind: GUARD_AMBUSH, speed: 0.895 },
            { kind: GUARD_AMBUSH, speed: 0.88 },
            { kind: GUARD_ROAM, speed: 0.865 }
        ],
        seconds: 167, par: 87,
        accent: '#5af2bf'
    }
];

export const levelCount = () => LEVELS.length;

/** O nível com este número (1-based), ou `null`. */
export const levelById = (id) => LEVELS.find((level) => level.id === id) || null;

/** Vidas do nível — a receita manda, e quase nenhuma tem de o dizer. */
export const livesOf = (level) => level.lives ?? DEFAULT_LIVES;

/**
 * As estrelas de uma tentativa concluída. Ver MAX_STARS no config.js para o
 * porquê de serem condições e não escalões de pontuação.
 */
export function starsFor(level, { seconds, livesLost }) {
    let stars = 1;
    if (seconds <= level.par) stars++;
    if (livesLost === 0) stars++;
    return Math.min(MAX_STARS, stars);
}

/**
 * Monta o nível jogável: o labirinto e onde fica cada coisa.
 *
 * As colocações saem do mesmo gerador com semente que escavou o labirinto, por
 * isso o nível é sempre igual — o jogador que repete encontra tudo onde deixou,
 * e o cartão do menu mostra o labirinto que vai mesmo jogar.
 *
 * A ordem em que se põem as peças não é arbitrária:
 *
 *   1. a saída, no ponto mais longe do início — o nível é uma travessia;
 *   2. os portais, porque mudam o que é perto de quê;
 *   3. as portas, que precisam de saber o caminho já com os portais contados —
 *      uma porta que se contorne por um portal não tranca nada;
 *   4. o resto, que só precisa de células livres.
 */
export function buildLevelLayout(level) {
    const maze = buildMaze(level);
    const spawn = { x: START.x, y: START.y };
    const wantsDoors = (level.doors || 0) > 0;

    const fromSpawn = distanceField(maze, spawn.x, spawn.y);
    // Num nível com portas, a saída vai para o fundo de um beco. É o que garante
    // que existe onde pôr a porta: a boca de um beco corta-o do resto do
    // labirinto por construção, e num labirinto cheio de laços (ver `braid`)
    // uma célula ao calhar quase nunca corta nada.
    const exit = farthest(maze, fromSpawn, { deadEnd: wantsDoors });
    const maxDistance = fromSpawn[exit.y * maze.cols + exit.x];

    const taken = new Set([cellKey(spawn.x, spawn.y), cellKey(exit.x, exit.y)]);

    const portals = placePortals(maze, fromSpawn, maxDistance, level.portals || 0, taken);
    const doors = placeDoors(maze, spawn, exit, level.doors || 0, taken);

    // Os guardas ficam do lado de cá das portas: um guarda trancado do outro
    // lado não faz nada até a porta abrir, e o nível seria mais fácil do que
    // parece no cartão.
    const fromSpawnNow = distanceField(maze, spawn.x, spawn.y);
    const guards = placeGuards(maze, fromSpawnNow, reachableDistance(maze, fromSpawnNow), level.guards, taken);

    // Os cristais, esses, espalham-se pelo labirinto todo — contando que as
    // portas acabam por abrir. Um cristal do outro lado de uma porta é o que dá
    // sentido à chave: sem ele, a porta só estaria entre o jogador e a saída.
    const { freezers, crystals } = withDoorsOpen(maze, () => {
        const spread = distanceField(maze, spawn.x, spawn.y);
        const reach = reachableDistance(maze, spread);
        return {
            freezers: placeSpread(maze, spread, reach, level.freezers || 0, taken),
            crystals: placeSpread(maze, spread, reach, level.crystals, taken)
        };
    });

    return { level, maze, spawn, exit, portals, doors, freezers, crystals, guards };
}

/**
 * Corre uma colocação com as portas do nível destrancadas e volta a fechá-las.
 * Serve a quem tem de olhar para o labirinto inteiro — que é como ele vai estar
 * a meio do nível, não como está no primeiro segundo.
 */
function withDoorsOpen(maze, fn) {
    const closed = [...maze.blocked];
    maze.blocked.clear();
    try {
        return fn();
    } finally {
        for (const key of closed) maze.blocked.add(key);
    }
}

/**
 * A célula de chão mais longe do alvo do campo de distâncias. Com `deadEnd`,
 * procura-se primeiro entre os becos sem saída — e só se não houver nenhum é
 * que serve a mais longe de todas.
 */
function farthest(maze, field, { deadEnd = false } = {}) {
    const pick = (onlyDeadEnds) => {
        let best = null;
        let bestDistance = -1;
        for (const cell of maze.floors) {
            if (onlyDeadEnds && exitsFrom(maze, cell.x, cell.y).length !== 1) continue;
            const distance = field[cell.y * maze.cols + cell.x];
            if (distance > bestDistance) {
                bestDistance = distance;
                best = cell;
            }
        }
        return best;
    };

    const best = (deadEnd && pick(true)) || pick(false) || { x: START.x, y: START.y };
    return { x: best.x, y: best.y };
}

/** A maior distância alcançável, para as faixas de colocação saberem onde acabam. */
function reachableDistance(maze, field) {
    let max = 0;
    for (const cell of maze.floors) {
        max = Math.max(max, field[cell.y * maze.cols + cell.x]);
    }
    return max;
}

// ---------- Portais ----------

/**
 * Cada par liga duas pontas afastadas do labirinto. Afastadas é o ponto: um
 * portal entre duas células vizinhas não é um atalho, é um enfeite. Por isso
 * uma ponta fica na metade de cá e a outra na metade de lá.
 *
 * E nenhuma das pontas pode ser a única passagem para o que está do outro lado
 * dela. Uma célula com portal não se atravessa: quem chega ao centro é levado
 * para a outra ponta (ver `enterPortal` em walker.js), por isso um portal num
 * corredor que não tenha volta a dar fecha ali o labirinto — só lá se entra
 * caindo do outro portal, e o que estiver lá (um cristal, a saída) deixa de se
 * poder ir buscar a pé. Era o que acontecia no nível 11, com a saída encostada
 * a um portal: quem subia o corredor era atirado para o outro lado do labirinto
 * sempre que tentava lá chegar.
 *
 * Por isso cada ponta é escolhida entre as células que, fechadas — todas as
 * pontas ao mesmo tempo, que é como quem anda a pé as encontra —, deixam o
 * labirinto inteiro alcançável a partir do início. O portal passa a ser sempre
 * um atalho, e nunca a única porta de uma zona.
 */
function placePortals(maze, fromSpawn, maxDistance, count, taken) {
    const placed = [];

    // As pontas já postas, que para quem anda a pé são parede.
    const closed = new Set();

    // Duas pontas encostadas uma à outra encadeiam-se: quem sai de uma segue em
    // frente, cai na outra e é atirado outra vez, sem ter percebido porquê. Uma
    // ponta nova nunca fica ao lado de uma que já lá esteja.
    const clearOfPortals = (cell) => !STEPS.some((step) => closed.has(cellKey(cell.x + step.x, cell.y + step.y)));
    const hasWayAround = (cell) => clearOfPortals(cell) && walkableWithout(maze, closed, cell);

    // O que faz de um par um atalho: a pé, uma ponta tem de ficar mesmo longe da
    // outra. É a mesma medida que as faixas já davam de graça (a de cá acaba aos
    // 40% da travessia e a de lá começa aos 60%), agora medida a direito — assim
    // a procura pode sair da faixa sem o par deixar de valer a pena.
    const minGap = Math.max(4, Math.floor(maxDistance * 0.2));

    const pickEnd = (low, high, accept) =>
        pickInBand(maze, fromSpawn, low, high, taken, { deadEnds: false, accept })
        // Faixa sem célula que sirva: procura-se no labirinto todo. A faixa é uma
        // preferência, as condições do `accept` é que não se dispensam.
        || pickInBand(maze, fromSpawn, 2, maxDistance, taken, { deadEnds: false, accept });

    for (let i = 0; i < count; i++) {
        const near = pickEnd(2, Math.floor(maxDistance * 0.4), hasWayAround);
        if (!near) break;

        // A ponta de cá entra já no `taken` e no `closed`: a de lá tem de ser
        // outra célula, e tem de continuar a haver volta a dar com as duas
        // fechadas — não uma de cada vez.
        taken.add(cellKey(near.x, near.y));
        closed.add(cellKey(near.x, near.y));

        const fromNear = walkField(maze, near, closed);
        const isFar = (cell) => {
            const distance = fromNear[cell.y * maze.cols + cell.x];
            if (distance < minGap) return false;
            // E longe também no ecrã: um salto que acaba ao lado de onde começou
            // lê-se como um portal avariado, por muitas voltas que poupe.
            if (Math.hypot(cell.x - near.x, cell.y - near.y) < MIN_PORTAL_LEAP) return false;
            return hasWayAround(cell);
        };
        const far = pickEnd(Math.ceil(maxDistance * 0.6), maxDistance, isFar);

        if (!far) {
            taken.delete(cellKey(near.x, near.y));
            closed.delete(cellKey(near.x, near.y));
            break;
        }

        taken.add(cellKey(far.x, far.y));
        closed.add(cellKey(far.x, far.y));
        maze.portals.set(cellKey(near.x, near.y), far);
        maze.portals.set(cellKey(far.x, far.y), near);
        placed.push({ a: near, b: far, color: PORTAL_COLORS[i % PORTAL_COLORS.length] });
    }

    return placed;
}

/** A que distância, em células a direito, uma ponta de portal tem de ficar da outra. */
const MIN_PORTAL_LEAP = 4;

/**
 * Distâncias a pé a partir de uma célula, com `closed` por parede. É a onda do
 * `distanceField` sem os saltos de portal: aqui pergunta-se precisamente o que
 * se consegue fazer *sem* eles. A célula de partida conta mesmo que esteja
 * fechada — é de lá que se sai.
 */
function walkField(maze, from, closed = new Set()) {
    const field = new Int16Array(maze.cols * maze.rows).fill(-1);
    if (!maze.isFloor(from.x, from.y)) return field;

    field[from.y * maze.cols + from.x] = 0;
    const queue = [from];

    while (queue.length) {
        const current = queue.shift();
        const next = field[current.y * maze.cols + current.x] + 1;
        for (const step of STEPS) {
            const cell = { x: current.x + step.x, y: current.y + step.y };
            const index = cell.y * maze.cols + cell.x;
            if (!maze.isFloor(cell.x, cell.y) || closed.has(cellKey(cell.x, cell.y))) continue;
            if (field[index] !== -1) continue;
            field[index] = next;
            queue.push(cell);
        }
    }

    return field;
}

/**
 * True se, com estas células fechadas e mais esta, ainda se chega a pé do início
 * a todo o resto do labirinto.
 */
function walkableWithout(maze, closed, cell) {
    const shut = new Set(closed);
    shut.add(cellKey(cell.x, cell.y));

    const field = walkField(maze, START, shut);
    return maze.floors.every((floor) => shut.has(cellKey(floor.x, floor.y))
        || !maze.isFloor(floor.x, floor.y)
        || field[floor.y * maze.cols + floor.x] >= 0);
}

// ---------- Portas e chaves ----------

/**
 * Uma porta só é uma porta se trancar mesmo alguma coisa.
 *
 * Num labirinto com laços (e todos têm, por causa do `braid`), fechar uma
 * célula ao calhar quase nunca corta o caminho — dá-se a volta e a porta passa
 * a enfeite. Por isso a procura é pelo contrário: percorre-se o caminho mais
 * curto até ao que se quer trancar e fecha-se cada célula à experiência, até
 * encontrar uma que deixe mesmo o destino inalcançável.
 *
 * Com mais do que uma porta, elas encadeiam-se: a primeira tranca a saída e a
 * segunda tranca a chave da primeira. Quem joga percebe a ordem sem lhe
 * explicarem — a chave que se encontra é sempre a do próximo cadeado.
 */
function placeDoors(maze, spawn, exit, count, taken) {
    const placed = [];
    let target = exit;

    for (let i = 0; i < count; i++) {
        const cell = findCut(maze, spawn, target, taken);
        if (!cell) break;

        maze.blocked.add(cellKey(cell.x, cell.y));
        taken.add(cellKey(cell.x, cell.y));

        // A chave da última porta pode ir para o melhor sítio que houver. As
        // outras não: a porta seguinte vai trancar *esta* chave, por isso ela
        // tem de ficar onde ainda seja possível cortar o caminho até lá. Sem
        // esta verificação, a melhor chave era às vezes a que deixava o nível
        // com uma porta a menos do que a receita pedia.
        const lastDoor = i === count - 1;
        const candidates = keyCandidates(maze, spawn, cell, taken);
        const key = (lastDoor ? null : candidates.find((candidate) => findCut(maze, spawn, candidate, taken)))
            // Labirinto onde a cadeia não dá para continuar: fica-se pela melhor
            // chave e a porta seguinte não se coloca. Uma porta a menos é melhor
            // do que uma chave num sítio mau — e o varrimento de sementes (ver a
            // nota da receita) é que evita que isso aconteça nos níveis que
            // contam com as duas.
            || candidates[0];

        if (!key) {
            maze.blocked.delete(cellKey(cell.x, cell.y));
            taken.delete(cellKey(cell.x, cell.y));
            break;
        }

        taken.add(cellKey(key.x, key.y));
        placed.push({ cell, key, color: DOOR_COLORS[i % DOOR_COLORS.length], open: false });
        target = key;
    }

    return placed;
}

/**
 * Uma célula que, fechada, deixa `target` inalcançável a partir de `spawn`.
 * Preferem-se corredores (duas saídas): uma porta num cruzamento não se lê — não
 * se percebe o que é que ela está a fechar.
 */
function findCut(maze, spawn, target, taken) {
    // O caminho mais curto primeiro, de trás para a frente: a porta mais perto
    // do que guarda é a que deixa mais labirinto aberto, e é a que se percebe
    // melhor. Quase sempre é aqui que se encontra, e é uma procura barata.
    const path = shortestPath(maze, spawn, target).reverse();
    const onPath = cutAmong(maze, spawn, target, taken, path);
    if (onPath) return onPath;

    // Não havendo no caminho, procura-se em todo o labirinto — das células mais
    // afastadas do início para as mais próximas, pela mesma razão.
    const fromSpawn = distanceField(maze, spawn.x, spawn.y);
    const everywhere = maze.floors
        .filter((cell) => fromSpawn[cell.y * maze.cols + cell.x] >= 0)
        .sort((a, b) => fromSpawn[b.y * maze.cols + b.x] - fromSpawn[a.y * maze.cols + a.x]);

    return cutAmong(maze, spawn, target, taken, everywhere);
}

/**
 * A primeira das candidatas que, fechada, deixa `target` inalcançável. Os
 * corredores (duas saídas) ganham sempre aos cruzamentos: uma porta num
 * cruzamento não se lê — não se percebe o que é que ela está a fechar.
 */
function cutAmong(maze, spawn, target, taken, candidates) {
    let fallback = null;

    for (const cell of candidates) {
        const key = cellKey(cell.x, cell.y);
        if (taken.has(key) || maze.portals.has(key) || maze.blocked.has(key)) continue;
        if (cell.x === target.x && cell.y === target.y) continue;
        if (cell.x === spawn.x && cell.y === spawn.y) continue;

        maze.blocked.add(key);
        const cuts = !canReach(maze, spawn, target);
        maze.blocked.delete(key);
        if (!cuts) continue;

        if (exitsFrom(maze, cell.x, cell.y).length === 2) return { x: cell.x, y: cell.y };
        fallback = fallback || { x: cell.x, y: cell.y };
    }

    return fallback;
}

/**
 * Os melhores sítios para a chave de uma porta, por ordem: o mais longe **da
 * porta** que se consiga, sem sair do que ainda é alcançável com ela fechada.
 * Devolve uma lista, e não um sítio, porque quem escolhe tem mais uma condição
 * a cumprir — ver `placeDoors`.
 *
 * Longe da porta e não longe do início, que é a medida que parecia óbvia e não
 * é: a porta está lá ao fundo, longe do início, e a célula mais longe do início
 * ainda alcançável é precisamente a que está encostada a ela. A chave calhava
 * colada ao cadeado e abrir a porta não custava nada. Medindo a partir da
 * porta, a chave vai parar ao canto oposto do que se pode andar — que é a
 * viagem que a porta devia estar a cobrar.
 *
 * Um beco sem saída vale um bónus, não um veto: se houver outra porta a seguir,
 * é a boca de um beco que lhe serve de sítio (ver `findCut`), por isso convém.
 * Mas *só* becos era pior do que nada — quando o único beco alcançável está
 * encostado à porta, a chave voltava a ficar ao lado do cadeado. O bónus é
 * pequeno de propósito: um beco a um passo nunca ganha a um corredor a dez.
 */
function keyCandidates(maze, spawn, doorCell, taken, limit = 8) {
    const reachable = distanceField(maze, spawn.x, spawn.y);
    const isReachable = (cell) => reachable[cell.y * maze.cols + cell.x] >= 0;

    // A porta está fechada, por isso não se mede a partir dela: mede-se a partir
    // do vizinho dela que ficou do lado de cá.
    const doorSide = STEPS
        .map((step) => ({ x: doorCell.x + step.x, y: doorCell.y + step.y }))
        .find((cell) => maze.isFloor(cell.x, cell.y) && isReachable(cell));
    if (!doorSide) return [];

    const fromDoor = distanceField(maze, doorSide.x, doorSide.y);
    const scored = [];

    for (const cell of maze.floors) {
        const key = cellKey(cell.x, cell.y);
        if (taken.has(key) || maze.portals.has(key) || maze.blocked.has(key)) continue;
        if (!isReachable(cell)) continue;

        const distance = fromDoor[cell.y * maze.cols + cell.x];
        if (distance < 0) continue;

        scored.push({
            x: cell.x,
            y: cell.y,
            score: distance + (exitsFrom(maze, cell.x, cell.y).length === 1 ? DEAD_END_BONUS : 0)
        });
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((cell) => ({ x: cell.x, y: cell.y }));
}

/** Quanto vale um beco sem saída na escolha do sítio da chave, em passos. */
const DEAD_END_BONUS = 3;

// ---------- Cristais, gelo e guardas ----------

/**
 * Espalha `count` peças por faixas de distância ao início — uma por faixa —,
 * com preferência para os becos sem saída. Assim não se apanha tudo no mesmo
 * corredor e o nível obriga mesmo a percorrer o labirinto.
 */
function placeSpread(maze, field, maxDistance, count, taken) {
    const placed = [];
    const band = Math.max(1, maxDistance / Math.max(1, count));

    for (let i = 0; i < count; i++) {
        const low = Math.max(2, Math.floor(band * i));
        const high = Math.ceil(band * (i + 1));
        const cell = pickInBand(maze, field, low, high, taken)
            // Faixa sem célula livre (acontece nos cantos mais apertados):
            // procura-se em todo o labirinto para não ficarem peças por pôr.
            || pickInBand(maze, field, 2, maxDistance, taken);
        if (!cell) break;
        taken.add(cellKey(cell.x, cell.y));
        placed.push(cell);
    }

    return placed;
}

/**
 * Uma célula livre dentro da faixa, preferindo becos sem saída. Com `accept`,
 * só entram as células que a condição aceitar — é assim que os portais se
 * limitam às que têm volta a dar (ver `placePortals`). A condição fica para o
 * fim porque custa mais do que as outras: só a testam as células que já
 * passaram pela faixa.
 */
function pickInBand(maze, field, low, high, taken, { deadEnds = true, accept = null } = {}) {
    const options = [];
    const preferred = [];

    for (const cell of maze.floors) {
        const key = cellKey(cell.x, cell.y);
        if (taken.has(key) || maze.portals.has(key) || maze.blocked.has(key)) continue;
        const distance = field[cell.y * maze.cols + cell.x];
        if (distance < low || distance > high) continue;
        if (accept && !accept(cell)) continue;
        options.push(cell);
        if (deadEnds && exitsFrom(maze, cell.x, cell.y).length === 1) preferred.push(cell);
    }

    const pool = preferred.length ? preferred : options;
    if (!pool.length) return null;
    const chosen = pool[Math.floor(maze.random() * pool.length)];
    return { x: chosen.x, y: chosen.y };
}

/**
 * Os guardas começam na metade mais afastada do início, e nunca em cima de
 * outra peça: a primeira coisa que se vê ao arrancar não pode ser um guarda em
 * cima do jogador.
 *
 * "Afastado" mede-se em tempo, e não só em casas: cada guarda tem de precisar
 * de pelo menos GUARD_START_SECONDS, à sua própria velocidade, para chegar ao
 * início. Medir só em casas deixava um guarda rápido a meia dúzia de segundos
 * do jogador, no corredor por onde ele tinha de sair — era o que acontecia no
 * nível 17, com um perseguidor a 13 casas, que chegava lá em quatro segundos e
 * fechava a fuga antes de se perceber para onde ir.
 *
 * Nos labirintos pequenos não há sempre casas que cheguem tão longe. Aí a
 * distância pedida vai baixando até haver onde pôr o guarda — fica o mais longe
 * que o labirinto deixa, em vez de voltar a qualquer sítio da metade de lá.
 */
function placeGuards(maze, field, maxDistance, guards, taken) {
    const minDistance = Math.max(4, Math.floor(maxDistance * 0.45));
    const placed = [];

    for (const guard of guards) {
        const safeDistance = Math.ceil(GUARD_START_SECONDS * ENEMY_BASE_SPEED * guard.speed);
        let cell = null;
        for (let low = Math.max(minDistance, safeDistance); !cell && low >= 2; low--) {
            cell = pickInBand(maze, field, Math.min(low, maxDistance), maxDistance, taken, { deadEnds: false });
        }
        // Região inicial pequena de mais para tantos guardas (acontece quando
        // uma porta tranca logo metade do labirinto): antes um guarda do outro
        // lado da porta do que um nível com menos guardas do que a receita pede.
        cell ||= withDoorsOpen(maze, () => {
            const open = distanceField(maze, START.x, START.y);
            return pickInBand(maze, open, 4, reachableDistance(maze, open), taken, { deadEnds: false });
        });
        if (!cell) break;
        taken.add(cellKey(cell.x, cell.y));
        placed.push({ ...guard, x: cell.x, y: cell.y });
    }

    return placed;
}
