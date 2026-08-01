import { FAVS } from '../stores';
import { useStoreListener, useStoreValue } from './useStore';

/**
 * Si el item es favorito, y cómo dejarlo en un valor concreto.
 *
 * El setter toma el valor y no alterna: quien lo usa tiene que poder revertir
 * su propio cambio cuando el servidor lo rechaza, y un `toggle()` ciego
 * revertiría el click siguiente si llegan dos seguidos.
 */
export function useFav(id: string): [boolean, (value: boolean) => void] {
    const fav = useStoreValue(FAVS.event, id, () => FAVS.has(id));
    return [fav, (value: boolean) => { FAVS.setMany([id], value); }];
}

/** Ejecuta `onChange` cada vez que cambia cualquier favorito. */
export function useFavListener(onChange: () => void) {
    useStoreListener(FAVS.event, onChange);
}
