// Favoritos persistidos en localStorage. Cambios se notifican por
// evento global ('jfp-favs-change') para que los hooks re-lean.
//
// Cachear el Set en memoria evita parsear el JSON de localStorage en
// cada `has()`. En la Home hay decenas de tarjetas que consultan
// favoritos por render — sin cache, cada scroll o cambio de "visto"
// provocaba cientos de JSON.parse.

const KEY = 'jfp-favs';
const EVENT = 'jfp-favs-change';

let cache: Set<string> | null = null;

function ensure(): Set<string> {
    if (cache) return cache;
    try {
        cache = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
    } catch {
        cache = new Set();
    }
    return cache;
}

function persist() {
    if (!cache) return;
    localStorage.setItem(KEY, JSON.stringify([...cache]));
    window.dispatchEvent(new Event(EVENT));
}

export const FAVS = {
    event: EVENT,
    has(id: string): boolean {
        return ensure().has(id);
    },
    toggle(id: string) {
        const s = ensure();
        if (s.has(id)) s.delete(id);
        else s.add(id);
        persist();
    }
};
