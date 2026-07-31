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

// Un Show lleva dentro estado POR USUARIO (visto, progreso, "continuar
// por"), así que el id del item no basta como clave: al cambiar de cuenta en
// la misma pestaña, la nueva sesión leía el Show de la anterior hasta que
// expirara el TTL. El userId va en la clave y no como filtro para que las
// entradas de cada cuenta coexistan sin pisarse.
// `.` como separador: no puede aparecer en un userId ni en un item id.
function keyFor(userId: string, id: string): string {
    return `${userId}.${id}`;
}

export const showCache = {
    get(userId: string, id: string): Promise<Show> | undefined {
        const key = keyFor(userId, id);
        const e = entries.get(key);
        if (!e) return undefined;
        if (Date.now() - e.at > TTL_MS) {
            entries.delete(key);
            return undefined;
        }
        return e.promise;
    },
    set(userId: string, id: string, promise: Promise<Show>): void {
        entries.set(keyFor(userId, id), { promise, at: Date.now() });
    },
    delete(userId: string, id: string): void {
        entries.delete(keyFor(userId, id));
    }
};

// Toda mutación (marcar visto, editar metadatos, fin de reproducción) limpia
// el caché entero: los ids de las mutaciones suelen ser de episodio/temporada
// y no casan con las claves (ids de serie); borrar todo es siempre correcto
// y cada serie solo re-fetchea una vez en la siguiente visita.
export function clearShowCache(): void {
    entries.clear();
}
