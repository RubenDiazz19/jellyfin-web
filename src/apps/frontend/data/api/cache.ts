// In-memory show cache shared by every module that mutates or invalidates
// a show. Kept internal to the API layer.

import type { Show } from '../models';

export const showCache = new Map<string, Promise<Show>>();

// showCache se rellena desde shows.ts; sonar solo ve este fichero.
// Toda mutación (marcar visto, editar metadatos, fin de reproducción) limpia
// el caché entero: los ids de las mutaciones suelen ser de episodio/temporada
// y no casan con las claves (ids de serie); borrar todo es siempre correcto
// y cada serie solo re-fetchea una vez en la siguiente visita.
export function clearShowCache(): void {
    showCache.clear(); // eslint-disable-line sonarjs/no-empty-collection
}
