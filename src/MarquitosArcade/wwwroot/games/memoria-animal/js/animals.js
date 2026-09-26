// Os animais das cartas.
//
// As ilustrações são do Fluent Emoji da Microsoft (licença MIT, ver
// assets/animais/LICENSE.txt), otimizadas com o svgo e servidas como ficheiros
// SVG. Não se usam os emoji do sistema: cada aparelho desenha-os à sua maneira
// (e há os que ainda não têm o burro), e num jogo de pares a mesma carta tem de
// ter a mesma cara em todo o lado.
//
// Os da quinta vêm primeiro. Não há andorinha nem faisão nas ilustrações — o
// passarinho e o galo fazem as vezes deles.

/** @typedef {{ id: string, name: string }} Animal */

/** @type {Animal[]} */
export const ANIMALS = [
    { id: 'ponei', name: 'Pónei' },
    { id: 'vaca', name: 'Vaca' },
    { id: 'porco', name: 'Porco' },
    { id: 'ovelha', name: 'Ovelha' },
    { id: 'cabra', name: 'Cabra' },
    { id: 'burro', name: 'Burro' },
    { id: 'galinha', name: 'Galinha' },
    { id: 'galo', name: 'Galo' },
    { id: 'pintainho', name: 'Pintainho' },
    { id: 'peru', name: 'Peru' },
    { id: 'pato', name: 'Pato' },
    { id: 'cao', name: 'Cão' },
    { id: 'gato', name: 'Gato' },
    { id: 'rato', name: 'Rato' },
    { id: 'lebre', name: 'Lebre' },
    { id: 'abelha', name: 'Abelha' },
    { id: 'mocho', name: 'Mocho' },
    { id: 'javali', name: 'Javali' },
    { id: 'raposa', name: 'Raposa' },
    { id: 'ourico', name: 'Ouriço-cacheiro' },
    { id: 'passarinho', name: 'Passarinho' },
    { id: 'pavao', name: 'Pavão' },
    { id: 'aguia', name: 'Águia' },
    { id: 'sapo', name: 'Sapo' },
    { id: 'esquilo', name: 'Esquilo' },
    { id: 'lobo', name: 'Lobo' },
    { id: 'urso', name: 'Urso' },
    { id: 'caracol', name: 'Caracol' },
    { id: 'borboleta', name: 'Borboleta' },
    { id: 'joaninha', name: 'Joaninha' },
    { id: 'tartaruga', name: 'Tartaruga' },
    { id: 'girafa', name: 'Girafa' },
    { id: 'elefante', name: 'Elefante' },
    { id: 'leao', name: 'Leão' },
    { id: 'tigre', name: 'Tigre' },
    { id: 'zebra', name: 'Zebra' },
    { id: 'macaco', name: 'Macaco' },
    { id: 'panda', name: 'Panda' },
    { id: 'coala', name: 'Coala' },
    { id: 'camelo', name: 'Camelo' },
    { id: 'hipopotamo', name: 'Hipopótamo' },
    { id: 'crocodilo', name: 'Crocodilo' },
    { id: 'papagaio', name: 'Papagaio' },
    { id: 'pinguim', name: 'Pinguim' },
    { id: 'golfinho', name: 'Golfinho' },
    { id: 'polvo', name: 'Polvo' }
];

const byId = new Map(ANIMALS.map((animal) => [animal.id, animal]));

export const animalById = (id) => byId.get(id) || null;

/** Caminho da ilustração, relativo ao index.html do jogo. */
export const animalSrc = (id) => `assets/animais/${id}.svg`;
