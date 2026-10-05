// Os níveis dos Gulosinhos.
//
// Um nível é uma receita: o cenário, a semente, a dificuldade, os desafios que
// pode ter e quanto tempo deve durar. O percurso sai da semente (ver world.js),
// por isso **acrescentar um nível é acrescentar uma entrada ao array `LEVELS`**,
// e mais nada — como no Maze Run.
//
// O que cada campo faz:
//
//   name        uma palavra só: no cartão do menu não pode quebrar em duas linhas
//   theme       o cenário (cores, fundo e enfeites — ver themes.js)
//   seed        a semente: o mesmo número dá sempre o mesmo percurso
//   difficulty  de 0 a 1: buracos mais largos, guardiões mais rápidos, mais de cada
//   target      segundos de percurso, pela conta do gerador (world.js). O tempo-
//               -alvo (a terceira estrela) é 15% acima disto; quem joga com
//               calma e vai às guloseimas acaba entre 1:30 e 2:00, e quem só
//               corre, sem se desviar para nada, faz o nível em pouco mais de 1:00
//   features    os desafios que podem aparecer
//   focus       os que o nível apresenta: aparecem mais vezes
//   hint        o conselho do ecrã de quem não chegou ao fim
//
// Os desafios (ver os troços em world.js):
//
//   jelly      guardião de geleia — salta-se-lhe em cima
//   hedgehog   ouriço — pica por cima, salta-se por cima dele
//   bees       abelhas a subir e a descer
//   plants     plantas carnívoras em vasos
//   bombs      bombas-relógio (paredes de caixotes e corredores)
//   spikes     picos no chão
//   pillars    pilares por cima de buracos
//   springs    molas ao pé de paredes altas
//   lifts      elevadores
//   movers     plataformas que vão e vêm por cima de buracos
//   crumble    pontes de bolachas que se desfazem

import { MAX_STARS } from './config.js';
import { THEMES } from './themes.js';

const ALL = ['jelly', 'hedgehog', 'bees', 'plants', 'bombs', 'spikes', 'pillars', 'springs', 'lifts', 'movers', 'crumble'];

/**
 * Os doze níveis, por ordem. Cada um apresenta uma ou duas coisas novas até ao
 * 7, e daí em diante é tudo misturado e a apertar.
 *
 * Doze enchem as páginas do carrossel em todos os formatos: 3 páginas de 4 ao
 * alto, 4 de 3 ao comprido, 2 de 6 no computador.
 */
export const LEVELS = [
    {
        id: 1, name: 'Prado', theme: 'prado', seed: 1101, difficulty: 0.05, target: 84,
        features: ['jelly', 'spikes'], focus: ['jelly'],
        hint: 'Salta em cima das geleias: elas guardam as guloseimas, mas não aguentam um salto na cabeça.'
    },
    {
        id: 2, name: 'Pomar', theme: 'pomar', seed: 2207, difficulty: 0.15, target: 86,
        features: ['jelly', 'spikes', 'plants', 'pillars'], focus: ['plants'],
        hint: 'As plantas carnívoras escondem-se no vaso de tempos a tempos. Espera que desçam e passa.'
    },
    {
        id: 3, name: 'Bosque', theme: 'bosque', seed: 3301, difficulty: 0.25, target: 88,
        features: ['jelly', 'spikes', 'plants', 'pillars', 'bombs'], focus: ['bombs'],
        hint: 'Chega-te à bomba para ela começar a contar e afasta-te antes de rebentar: é ela que abre a parede.'
    },
    {
        id: 4, name: 'Riacho', theme: 'riacho', seed: 4409, difficulty: 0.35, target: 90,
        features: ['jelly', 'spikes', 'plants', 'pillars', 'bombs', 'movers', 'hedgehog'], focus: ['movers', 'hedgehog'],
        hint: 'O ouriço pica por cima: salta-lhe por cima ou vai pela plataforma.'
    },
    {
        id: 5, name: 'Praia', theme: 'praia', seed: 5503, difficulty: 0.42, target: 92,
        features: ['jelly', 'spikes', 'plants', 'pillars', 'bombs', 'movers', 'hedgehog', 'springs', 'bees'], focus: ['springs', 'bees'],
        hint: 'Passa por baixo das abelhas quando estão lá em cima — ou salta-lhes em cima.'
    },
    {
        id: 6, name: 'Dunas', theme: 'dunas', seed: 6607, difficulty: 0.5, target: 92,
        features: ['jelly', 'spikes', 'plants', 'pillars', 'bombs', 'movers', 'hedgehog', 'springs', 'bees', 'crumble'], focus: ['crumble'],
        hint: 'As bolachas desfazem-se debaixo dos pés: atravessa a ponte a correr, sem parar.'
    },
    {
        id: 7, name: 'Gruta', theme: 'gruta', seed: 7703, difficulty: 0.58, target: 94,
        features: ALL, focus: ['lifts', 'bombs'],
        hint: 'O elevador sobe e desce sozinho: espera por ele em terra firme.'
    },
    {
        id: 8, name: 'Mina', theme: 'mina', seed: 8803, difficulty: 0.64, target: 96,
        features: ALL, focus: ['bombs', 'crumble'],
        hint: 'No corredor das bombas, não pares: elas rebentam atrás de ti.'
    },
    {
        id: 9, name: 'Neve', theme: 'neve', seed: 9907, difficulty: 0.7, target: 98,
        features: ALL, focus: ['hedgehog', 'plants'],
        hint: 'Depois de uma pancada ficas uns instantes a piscar: aproveita-os para sair do aperto.'
    },
    {
        id: 10, name: 'Glaciar', theme: 'glaciar', seed: 10103, difficulty: 0.78, target: 100,
        features: ALL, focus: ['movers', 'crumble'],
        hint: 'Um salto curto é um toque rápido no botão: dá jeito para os pilares estreitos.'
    },
    {
        id: 11, name: 'Nuvens', theme: 'nuvens', seed: 11119, difficulty: 0.86, target: 102,
        features: ALL, focus: ['springs', 'lifts', 'bees'],
        hint: 'Se caíres, recomeças na última bandeira — e as guloseimas que já apanhaste ficam contigo.'
    },
    {
        id: 12, name: 'Doçaria', theme: 'docaria', seed: 12211, difficulty: 0.95, target: 104,
        features: ALL, focus: ['bombs', 'jelly', 'plants'],
        hint: 'O frasco das guloseimas está no fim. Respira fundo e vai buscá-lo.'
    }
].map((level) => ({ ...level, accent: THEMES[level.theme].accent }));

export const levelCount = () => LEVELS.length;

export const levelById = (id) => LEVELS.find((level) => level.id === Number(id)) || null;

/**
 * As estrelas de um nível concluído: uma por chegar ao fim, outra por trazer
 * as guloseimas todas, outra por chegar dentro do tempo-alvo. São
 * independentes — quem corre sem as apanhar todas também tem a sua estrela.
 */
export function starsFor({ seconds, par, candies, totalCandies }) {
    let stars = 1;
    if (candies >= totalCandies) stars++;
    if (seconds <= par) stars++;
    return Math.min(MAX_STARS, stars);
}
