import { FAVS } from '../stores';
import { useStoreListener, useStoreValue } from './useStore';

/** Si el item es favorito, y cómo alternarlo. */
export function useFav(id: string): [boolean, () => void] {
    const fav = useStoreValue(FAVS.event, id, () => FAVS.has(id));
    return [fav, () => { FAVS.toggle(id); }];
}

/** Ejecuta `onChange` cada vez que cambia cualquier favorito. */
export function useFavListener(onChange: () => void) {
    useStoreListener(FAVS.event, onChange);
}
