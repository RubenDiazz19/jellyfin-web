import { WATCHED } from '../stores';
import { useStoreValue, useStoreVersion } from './useStore';

/** Si el item está visto, y cómo alternarlo. */
export function useWatched(id: string): [boolean, () => void] {
    const watched = useStoreValue(WATCHED.event, id, () => WATCHED.has(id));
    return [watched, () => { WATCHED.toggle(id); }];
}

/**
 * Re-renderiza cuando cambia cualquier «visto». Para los componentes que
 * derivan estado agregado de varios ids (temporada completa, serie completa)
 * en vez de suscribirse a uno solo.
 */
export function useWatchedVersion() {
    useStoreVersion(WATCHED.event);
}
