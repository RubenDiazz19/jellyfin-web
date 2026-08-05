import { WATCHED } from '../stores';
import { useStoreValue, useStoreVersion } from './useStore';

/** Si el item está visto, y cómo alternarlo. */
export function useWatched(id: string): [boolean, () => void] {
    const watched = useStoreValue(WATCHED.event, id, () => WATCHED.has(id));
    return [watched, () => { WATCHED.toggle(id); }];
}

/**
 * Re-renderiza cuando cambia algún «visto» de `scope`. Para los componentes
 * que derivan estado agregado de varios ids (temporada completa, serie
 * completa) en vez de suscribirse a uno solo.
 *
 * `scope` es la raíz de las claves que le afectan —el id de la serie— y es lo
 * que evita que marcar un episodio repinte la rejilla entera. Omitirlo
 * significa «cualquier cambio», y solo es correcto para vistas que de verdad
 * dependen de todo el store.
 */
export function useWatchedVersion(scope?: string) {
    useStoreVersion(WATCHED.event, scope);
}
