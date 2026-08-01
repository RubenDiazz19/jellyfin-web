import { useEffect } from 'react';
import { LISTS } from '../stores';
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
