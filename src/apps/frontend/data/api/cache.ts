// In-memory show cache shared by every module that mutates or invalidates
// a show. Kept internal to the API layer.
//
// TTL de 5 minutos: sin él, una serie visitada quedaba stale para siempre
// hasta que alguna mutación local limpiara el caché (los cambios hechos
// desde OTRO cliente nunca llegaban).

import type { Show } from '../models';

const TTL_MS = 5 * 60_000;

type Entry = { promise: Promise<Show>; at: number };

const entries = new Map<string, Entry>();

// API compatible con Map para que shows.ts no cambie de forma.
export const showCache = {
    get(id: string): Promise<Show> | undefined {
        const e = entries.get(id);
        if (!e) return undefined;
        if (Date.now() - e.at > TTL_MS) {
            entries.delete(id);
            return undefined;
        }
        return e.promise;
    },
    set(id: string, promise: Promise<Show>): void {
        entries.set(id, { promise, at: Date.now() });
    },
    delete(id: string): void {
        entries.delete(id);
    }
};

// Toda mutación (marcar visto, editar metadatos, fin de reproducción) limpia
// el caché entero: los ids de las mutaciones suelen ser de episodio/temporada
// y no casan con las claves (ids de serie); borrar todo es siempre correcto
// y cada serie solo re-fetchea una vez en la siguiente visita.
export function clearShowCache(): void {
    entries.clear();
}
