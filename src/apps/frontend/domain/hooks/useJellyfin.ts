// Hooks pequeños para consumir la API de Jellyfin desde componentes.
// Sólo se activan si la sesión guarda un accessToken real; si no, devuelven
// null y la página cae al modo prototipo (PROTO_DATA).

import { useEffect, useState } from 'react';
import { getShows, getShow, getHomeCarousel } from '../../data/api';
import { useSession } from '../../data/session/SessionProvider';
import type { Show, CarouselSlide } from '../../data/models';

type FetchState<T> = { data: T | null; error: string | null; loading: boolean };

// Slides del hero de la Home (continuar viendo + últimas series).
export function useJellyfinCarousel(): FetchState<CarouselSlide[]> {
  const { session } = useSession();
  const [state, setState] = useState<FetchState<CarouselSlide[]>>({
    data: null, error: null, loading: !!session?.accessToken,
  });
  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;
    getHomeCarousel()
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((err: Error) => {
        // El hero es opcional: si falla, la Home sigue mostrando la biblioteca.
        if (!cancelled) setState({ data: [], error: err.message, loading: false });
      });
    return () => { cancelled = true; };
  }, [session?.accessToken]);
  return state;
}

export function useJellyfinShows(): FetchState<Show[]> {
  const { session } = useSession();
  const [state, setState] = useState<FetchState<Show[]>>({
    data: null, error: null, loading: !!session?.accessToken,
  });
  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;
    getShows()
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, error: err.message, loading: false });
      });
    return () => { cancelled = true; };
  }, [session?.accessToken]);
  return state;
}

export function useJellyfinShow(id: string | undefined): FetchState<Show> {
  const { session } = useSession();
  const [state, setState] = useState<FetchState<Show>>({
    data: null, error: null, loading: !!session?.accessToken && !!id,
  });
  useEffect(() => {
    if (!session?.accessToken || !id) return;
    setState({ data: null, error: null, loading: true });
    let cancelled = false;
    getShow(id)
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, error: err.message, loading: false });
      });
    return () => { cancelled = true; };
  }, [session?.accessToken, id]);
  return state;
}
