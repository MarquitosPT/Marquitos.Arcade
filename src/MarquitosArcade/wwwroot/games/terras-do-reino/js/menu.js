// O menu: quem governa e o reino que está à espera.
//
// Por trás do vidro vê-se o próprio reino guardado (ou, a quem ainda não tem
// nenhum, o reino que vai fundar), com a câmara a passear devagar à volta do
// castelo. O menu é uma janela para o reino, não um cartaz.

import { fmt } from './format.js';
import { game } from './state.js';
import { hasSave, progress } from './save.js';
import { els, overlays } from './ui.js';

export function createMenu({ playerName }) {
    let accountBound = false;

    function bindAccount() {
        if (accountBound) return;
        accountBound = true;
        playerName.account.then((displayName) => {
            const signedIn = !!displayName;
            els.nameRow.hidden = signedIn;
            els.accountRow.hidden = !signedIn;
            if (signedIn) {
                els.accountName.textContent = displayName;
                els.accountInitial.textContent = [...displayName][0].toUpperCase();
            }
            els.nameSlot.classList.remove('is-pending');
        });
    }

    /** Atualiza o cartão do reino guardado e os botões. `ready` é falso enquanto a conta não respondeu. */
    function refresh(ready = true) {
        const saved = hasSave();
        els.saveCard.hidden = !saved;
        if (saved) {
            els.saveLine.textContent = `🏰 Castelo nível ${game.castleLevel} · Dia ${game.day}`;
            els.saveSub.textContent = `Prosperidade ${fmt(game.derived.prosperity)} · ${game.buildings.length} edifícios · ${game.derived.residents} moradores`;
        }
        els.playBtn.textContent = !ready ? 'A abrir o reino…' : saved ? 'Continuar o reino' : 'Fundar o reino';
        els.playBtn.disabled = !ready;
        els.newBtn.hidden = !saved || !ready;
        els.progressNote.hidden = progress.stored;
    }

    function show(ready = true) {
        bindAccount();
        refresh(ready);
        overlays.show('start');
    }

    return { show, refresh };
}
