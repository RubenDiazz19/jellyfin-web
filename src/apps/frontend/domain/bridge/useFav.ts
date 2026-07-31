import { useEffect, useState } from 'react';
import { FAVS } from '../../data/stores/favsStore';

export function useFav(id: string): [boolean, () => void] {
    const [fav, setFav] = useState<boolean>(() => FAVS.has(id));
    useEffect(() => {
        const update = () => setFav(FAVS.has(id));
        window.addEventListener(FAVS.event, update);
        update();
        return () => window.removeEventListener(FAVS.event, update);
    }, [id]);
    return [fav, () => FAVS.toggle(id)];
}

// Ejecuta `onChange` cada vez que cambia cualquier favorito (toggle en
// cualquier tarjeta). Para vistas que necesitan reaccionar con lógica propia
// en vez de solo re-renderizar (p.ej. podar la lista de la pantalla de
// Favoritos cuando se desmarca un item).
export function useFavListener(onChange: () => void) {
    useEffect(() => {
        window.addEventListener(FAVS.event, onChange);
        return () => window.removeEventListener(FAVS.event, onChange);
    }, [onChange]);
}
