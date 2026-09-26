// Ecrã "Como jogar": o texto vive no index.html; aqui só se monta a galeria
// dos animais, a partir da mesma lista das cartas — um animal novo em
// animals.js aparece aqui sem mais nada.

import { escapeHtml } from '/lib/arcade/index.js';

import { ANIMALS, animalSrc } from './animals.js';
import { levelCount } from './levels.js';
import { els } from './ui.js';

let built = false;

/** Monta a galeria na primeira vez que o ecrã se abre — são quase cinquenta ilustrações. */
export function prepareHowto() {
    els.howtoLastLevel.textContent = String(levelCount());
    if (built) return;
    built = true;
    els.animalGallery.innerHTML = ANIMALS.map((animal) => `<li class="animalItem">
        <img src="${animalSrc(animal.id)}" alt="" width="56" height="56" loading="lazy" decoding="async">
        <span>${escapeHtml(animal.name)}</span>
    </li>`).join('');
}
