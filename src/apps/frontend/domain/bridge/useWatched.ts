import { useEffect, useState } from 'react';
import { WATCHED } from '../../data/stores/watchedStore';

export function useWatched(id: string): [boolean, () => void] {
  const [w, setW] = useState<boolean>(() => WATCHED.has(id));
  useEffect(() => {
    const update = () => setW(WATCHED.has(id));
    window.addEventListener(WATCHED.event, update);
    update();
    return () => window.removeEventListener(WATCHED.event, update);
  }, [id]);
  return [w, () => WATCHED.toggle(id)];
}

// Fuerza un re-render cuando cambia cualquier "visto". Útil en componentes
// que derivan estado agregado a partir de varios ids (temporada completa,
// serie completa) en vez de suscribirse a uno solo.
export function useWatchedVersion() {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    window.addEventListener(WATCHED.event, update);
    return () => window.removeEventListener(WATCHED.event, update);
  }, []);
}
