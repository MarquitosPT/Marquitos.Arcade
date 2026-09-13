// Acesso a localStorage que nunca rebenta.
//
// Em iOS Safari no modo privado (e com cookies de terceiros bloqueados dentro de
// um iframe) o simples acesso a `localStorage` atira. Todos os jogos tinham a sua
// própria cópia de um `safeGet`/`safeSet` com try/catch; vive aqui uma só vez.

export function readText(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeText(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function readJson(key, fallback = null) {
    const raw = readText(key);
    if (raw === null) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed === undefined ? fallback : parsed;
    } catch {
        return fallback;
    }
}

export function writeJson(key, value) {
    try {
        return writeText(key, JSON.stringify(value));
    } catch {
        return false;
    }
}
