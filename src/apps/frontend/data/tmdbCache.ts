// Módulo desactivado. El catálogo llega ahora vía la API de Jellyfin, así que
// no hay ni caché TMDb ni hidratado en cliente. Se mantiene el shape mínimo
// para no romper imports antiguos.
import type { ProtoData } from './baseData';

export const TMDB_READY_EVENT = 'jfp-tmdb-ready';

export function purgeOldCacheVersions(): void { /* no-op */ }
export function hydrateFromCache(_data: ProtoData): void { /* no-op */ }
export async function fetchMissing(_data: ProtoData): Promise<void> { /* no-op */ }
