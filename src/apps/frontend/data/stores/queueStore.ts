// Cola de reproducción persistida en localStorage.
//
// Solo guardamos lo justo para pintar la fila y arrancar la reproducción
// (id real del servidor + textos + póster). Nada de objetos de dominio
// completos: la cola sobrevive a recargas y no debe quedarse con copias
// rancias del catálogo.

import { createListStore } from './persistentStore';

export type QueueEntry = {
    /** Id real del item en Jellyfin: es lo que necesita el reproductor. */
    itemId: string;
    title: string;
    /** Línea secundaria: «Serie · T1 E3» o el año de la película. */
    subtitle?: string;
    poster?: string;
};

function isQueueEntry(entry: unknown): entry is QueueEntry {
    const e = entry as QueueEntry;
    return !!e && typeof e.itemId === 'string' && typeof e.title === 'string';
}

const store = createListStore<QueueEntry>({
    key: 'jfp-queue',
    event: 'jfp-queue-change',
    isValid: isQueueEntry
});

/** Sin el item dado, para que reencolarlo no lo duplique. */
const without = (list: QueueEntry[], itemId: string) => list.filter((e) => e.itemId !== itemId);

export const QUEUE = {
    event: store.event,

    all: () => store.all(),

    has: (itemId: string): boolean => store.all().some((e) => e.itemId === itemId),

    /** Al final de la cola. Reencolar un item ya presente no lo duplica. */
    enqueue(entry: QueueEntry) {
        store.update((list) => [...without(list, entry.itemId), entry]);
    },

    /** A la cabeza: «reproducir a continuación». */
    playNext(entry: QueueEntry) {
        store.update((list) => [entry, ...without(list, entry.itemId)]);
    },

    remove(itemId: string) {
        store.update((list) => without(list, itemId));
    },

    /** Mueve una entrada a otra posición (reordenado de la UI). */
    move(from: number, to: number) {
        const list = store.all();
        if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        store.replace(list);
    },

    /** Saca la primera entrada y la devuelve (auto-avance del reproductor). */
    takeNext(): QueueEntry | null {
        const [next, ...rest] = store.all();
        if (!next) return null;
        store.replace(rest);
        return next;
    },

    clear() {
        store.replace([]);
    }
};
