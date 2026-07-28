// Cola de reproducción persistida en localStorage. Misma forma que
// favsStore: cache en memoria + evento global para que la UI re-lea.
//
// Solo guardamos lo justo para pintar la fila y arrancar la reproducción
// (id real del servidor + textos + póster). Nada de objetos de dominio
// completos: la cola sobrevive a recargas y no debe quedarse con copias
// rancias del catálogo.

const KEY = 'jfp-queue';
const EVENT = 'jfp-queue-change';

export type QueueEntry = {
    /** Id real del item en Jellyfin: es lo que necesita el reproductor. */
    itemId: string;
    title: string;
    /** Línea secundaria: «Serie · T1 E3» o el año de la película. */
    subtitle?: string;
    poster?: string;
};

let cache: QueueEntry[] | null = null;

function ensure(): QueueEntry[] {
    if (cache) return cache;
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
        cache = Array.isArray(raw) ?
            raw.filter((e): e is QueueEntry =>
                !!e && typeof (e as QueueEntry).itemId === 'string'
                && typeof (e as QueueEntry).title === 'string') :
            [];
    } catch {
        cache = [];
    }
    return cache;
}

function persist(next: QueueEntry[]) {
    cache = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
}

export const QUEUE = {
    event: EVENT,

    all(): QueueEntry[] {
        return [...ensure()];
    },

    has(itemId: string): boolean {
        return ensure().some((e) => e.itemId === itemId);
    },

    /** Al final de la cola. Reencolar un item ya presente no lo duplica. */
    enqueue(entry: QueueEntry) {
        const rest = ensure().filter((e) => e.itemId !== entry.itemId);
        persist([...rest, entry]);
    },

    /** A la cabeza: «reproducir a continuación». */
    playNext(entry: QueueEntry) {
        const rest = ensure().filter((e) => e.itemId !== entry.itemId);
        persist([entry, ...rest]);
    },

    remove(itemId: string) {
        persist(ensure().filter((e) => e.itemId !== itemId));
    },

    /** Mueve una entrada a otra posición (reordenado de la UI). */
    move(from: number, to: number) {
        const list = ensure();
        if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        persist(next);
    },

    /** Saca la primera entrada y la devuelve (auto-avance del reproductor). */
    takeNext(): QueueEntry | null {
        const list = ensure();
        if (list.length === 0) return null;
        const [next, ...rest] = list;
        persist(rest);
        return next;
    },

    clear() {
        persist([]);
    }
};
