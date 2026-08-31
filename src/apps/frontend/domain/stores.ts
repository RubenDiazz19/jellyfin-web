// Fachada de stores locales (favoritos / vistos) para la capa presentation.
// Los componentes que derivan estado agregado (temporada completa, serie
// completa) leen los stores por aquí; la suscripción reactiva la dan los
// hooks de domain/bridge (useFav, useWatched, use*Version).

export { FAVS } from '../data/stores/favsStore';
export { WATCHED } from '../data/stores/watchedStore';
// Las claves con las que esos dos stores identifican cada cosa: una película o
// un episodio no se guardan por su id de Jellyfin (ver itemKeys).
export { episodeKey, movieKey, seasonKey } from '../data/stores/itemKeys';
export { VIEWS, type RatingOperator, type SavedView } from '../data/stores/viewsStore';
// A diferencia de los de arriba, este no vive en localStorage: la fuente de
// verdad son las listas del servidor (de reproducción y colecciones). Se
// expone igual porque el contrato hacia la vista es el mismo (leer + evento
// de cambio).
export { LISTS, displayItems, type ListKind, type ListRef } from '../data/stores/listsStore';
export type { ListEntry } from '../data/api/lists';
