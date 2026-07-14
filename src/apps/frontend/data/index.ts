// Punto de entrada del "modelo" del prototipo. Reexporta un singleton `PROTO_DATA`
// hidratado desde caché en el arranque + hook para que los componentes se
// enteren cuando llegan datos frescos de TMDb.

import { useEffect, useState } from 'react';
import { baseData, findSeason as _findSeason } from './baseData';
import type { ProtoData, Show, Movie } from './baseData';
import { hydrateFromCache, fetchMissing, purgeOldCacheVersions, TMDB_READY_EVENT } from './tmdbCache';

purgeOldCacheVersions();
hydrateFromCache(baseData);

export const PROTO_DATA: ProtoData = baseData;

// Refresco en segundo plano — se dispara una sola vez.
let started = false;
export function startDataFetch() {
  if (started) return;
  started = true;
  void fetchMissing(baseData);
}

export function useProtoData(): ProtoData {
  const [, force] = useState(0);
  useEffect(() => {
    startDataFetch();
    const bump = () => force((n) => n + 1);
    window.addEventListener(TMDB_READY_EVENT, bump);
    return () => window.removeEventListener(TMDB_READY_EVENT, bump);
  }, []);
  return PROTO_DATA;
}

export const findSeason = _findSeason;
export type { ProtoData, Show, Movie };
export type { Season, Episode, CarouselSlide, CastMember, Rating } from './baseData';
