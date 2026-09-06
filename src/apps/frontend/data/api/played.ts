// Títulos más reproducidos por el usuario en el servidor.
// Alimenta la fila "Más vistos" de la Home.

import type { CatalogItem } from '../models';
import { loadSession } from '../session/session';
import { apiFetch, noSessionError } from './http';
import { mapCatalogItem } from './itemMapping';
import { cachedList } from './listCache';
import { emitListsRefreshed } from './mutations';
import { FIELDS_LIST, type JFItem } from './types';

/** Los títulos más vistos del usuario. Cacheada igual que los listados; ver `listCache`. */
export function getMostPlayed(limit = 12): Promise<CatalogItem[]> {
    return cachedList('played', () => fetchMostPlayed(limit), emitListsRefreshed);
}

async function fetchMostPlayed(limit: number): Promise<CatalogItem[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const uid = session.userId;
    const res = await apiFetch<{ Items?: JFItem[] } | JFItem[]>(
        `/Users/${uid}/Items/Played?IncludeItemTypes=Movie,Series&Limit=${limit}&Fields=${FIELDS_LIST}`
    ).catch(() => [] as JFItem[]);
    const items = Array.isArray(res) ? res : (res.Items ?? []);
    return items.map((it) => mapCatalogItem(it));
}
