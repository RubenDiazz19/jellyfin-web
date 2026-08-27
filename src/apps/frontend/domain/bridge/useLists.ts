import { useCallback, useEffect, useState } from 'react';
import { LISTS, type ListKind, type ListRef } from '../stores';
import { useStoreValue } from './useStore';

/**
 * Si el título está en alguna lista (de reproducción o colección), y en cuáles.
 *
 * Dispara la carga al montar: el botón puede ser lo primero que se pinte de
 * las listas, así que no puede dar por hecho que alguien las haya pedido ya.
 * Mientras no haya datos responde `false`, que es el estado neutro correcto.
 */
export function useInLists(itemId: string): { inAny: boolean; keys: string[] } {
    useEffect(() => {
        void LISTS.ensure();
    }, [itemId]);

    return useStoreValue(LISTS.event, itemId, () => ({
        inAny: LISTS.has(itemId),
        keys: LISTS.keysOf(itemId)
    }));
}

/**
 * Sincroniza y recarga la lista completa de listas (reproducción y colecciones).
 * Escucha el evento global de `LISTS.event` y gestiona el estado de carga y error.
 */
export function useListsSync() {
    const [lists, setLists] = useState<ListRef[]>(() => LISTS.all());
    const [loading, setLoading] = useState(() => LISTS.all().length === 0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const sync = () => setLists(LISTS.all());
        window.addEventListener(LISTS.event, sync);
        LISTS.refresh()
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
        return () => window.removeEventListener(LISTS.event, sync);
    }, []);

    const refresh = useCallback(() => setLists(LISTS.all()), []);

    return { lists, loading, error, refresh };
}

/**
 * Sincroniza una lista concreta por tipo e id con el store `LISTS`.
 */
export function useListSync(kind: ListKind, listId: string) {
    const [list, setList] = useState<ListRef | undefined>(() => LISTS.find(kind, listId));

    useEffect(() => {
        const sync = () => setList(LISTS.find(kind, listId));
        window.addEventListener(LISTS.event, sync);
        void LISTS.ensure().then(sync);
        return () => window.removeEventListener(LISTS.event, sync);
    }, [kind, listId]);

    const refresh = useCallback(() => setList(LISTS.find(kind, listId)), [kind, listId]);

    return { list, refresh };
}

