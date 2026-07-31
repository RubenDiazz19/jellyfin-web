// Vocabulario de etiquetas ya usadas en la biblioteca, para autosugerir al
// etiquetar. Se junta de los ViewModels que tienen catálogo cargado: cuál de
// ellos lo tiene depende de por dónde haya entrado el usuario (búsqueda,
// listado de series, listado de películas), así que se miran todos.
//
// Se lee con `peek()` a propósito: es un dato de apoyo para un diálogo que se
// abre puntualmente, no algo a lo que la vista deba re-suscribirse.

import { libraryVM } from './LibraryViewModel';
import { searchVM } from './SearchViewModel';

export function knownTags(): string[] {
    const seen = new Map<string, string>();
    const lists = [
        searchVM.shows.peek(), searchVM.movies.peek(),
        libraryVM.shows.peek(), libraryVM.movies.peek()
    ];
    for (const list of lists) {
        for (const item of list) {
            for (const tag of item.tags ?? []) {
                const key = tag.toLowerCase();
                if (!seen.has(key)) seen.set(key, tag);
            }
        }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
