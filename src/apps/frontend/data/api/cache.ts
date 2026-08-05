// In-memory show cache shared by every module that mutates or invalidates
// a show. Kept internal to the API layer.
//
// TTL de 5 minutos: sin él, una serie visitada quedaba stale para siempre
// hasta que alguna mutación local limpiara el caché (los cambios hechos
// desde OTRO cliente nunca llegaban).
//
// El usuario entra por parámetro y no de la sesión: quien llama ya lo tiene a
// mano, y así este módulo no depende de dónde vive la sesión. La mecánica
// (Map + clave + TTL) es la de `createTtlCache`.

import type { Show } from '../models';
import { createTtlCache } from './ttlCache';

const cache = createTtlCache<Promise<Show>>({ ttlMs: 5 * 60_000 });

export const showCache = {
    get: (userId: string, id: string) => cache.get(cache.key(userId, id)),
    set: (userId: string, id: string, promise: Promise<Show>) => {
        cache.set(cache.key(userId, id), promise);
    },
    delete: (userId: string, id: string) => { cache.delete(cache.key(userId, id)); }
};

// Toda mutación (marcar visto, editar metadatos, fin de reproducción) limpia
// el caché entero: los ids de las mutaciones suelen ser de episodio/temporada
// y no casan con las claves (ids de serie); borrar todo es siempre correcto
// y cada serie solo re-fetchea una vez en la siguiente visita.
export function clearShowCache(): void {
    cache.clear();
}
