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

// Fuerza un re-render cuando cambia cualquier favorito. Útil para las
// vistas que agregan estado (buscador con filtro de favoritos, etc.).
export function useFavVersion() {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    window.addEventListener(FAVS.event, update);
    return () => window.removeEventListener(FAVS.event, update);
  }, []);
}
