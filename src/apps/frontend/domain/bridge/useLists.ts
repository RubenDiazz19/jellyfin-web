import { useEffect, useState } from 'react';
import { LISTS } from '../../data/stores/listsStore';

/**
 * Si el título está en alguna lista (de reproducción o colección), y en cuáles.
 *
 * Dispara la carga al montar: el botón puede ser lo primero que se pinte de
 * las listas, así que no puede dar por hecho que alguien las haya pedido ya.
 * Mientras no haya datos responde `false`, que es el estado neutro correcto.
 */
export function useInLists(itemId: string): { inAny: boolean; keys: string[] } {
    const [state, setState] = useState(() => ({
        inAny: LISTS.has(itemId),
        keys: LISTS.keysOf(itemId)
    }));

    useEffect(() => {
        const update = () => setState({
            inAny: LISTS.has(itemId),
            keys: LISTS.keysOf(itemId)
        });
        window.addEventListener(LISTS.event, update);
        update();
        void LISTS.ensure();
        return () => window.removeEventListener(LISTS.event, update);
    }, [itemId]);

    return state;
}
