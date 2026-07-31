// Fachada de stores locales (favoritos / vistos) para la capa presentation.
// Los componentes que derivan estado agregado (temporada completa, serie
// completa) leen los stores por aquí; la suscripción reactiva la dan los
// hooks de domain/bridge (useFav, useWatched, use*Version).

export { FAVS } from '../data/stores/favsStore';
export { WATCHED } from '../data/stores/watchedStore';
export { VIEWS, type SavedView } from '../data/stores/viewsStore';
