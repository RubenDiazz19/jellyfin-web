// Metadata editing + remote provider search (TMDB/TVDB "Identify…").

import { loadSession } from '../session/session';
import { clearShowCache } from './cache';
import { apiFetch, apiSend, noSessionError } from './http';
import { emitItemMutated } from './mutations';

export type ItemMetadataPatch = {
    Name?: string;
    OriginalTitle?: string;
    ProductionYear?: number | null;
    Overview?: string;
    Taglines?: string[];
    Genres?: string[];
    OfficialRating?: string;
};

export type RemoteSearchResult = {
    Name: string;
    ProductionYear?: number;
    Overview?: string;
    ImageUrl?: string;
    SearchProviderName?: string;
    ProviderIds?: Record<string, string>;
};

/**
 * El item tal cual lo devuelve el servidor. Se tipan los campos que lee el
 * editor y se deja el resto abierto a propósito: al guardar se reenvía el
 * objeto entero (POST /Items/{id} espera el item completo), así que perder
 * los campos no listados borraría datos.
 */
export type JFRawItem = {
    Id?: string;
    Name?: string;
    OriginalTitle?: string;
    ProductionYear?: number;
    Overview?: string;
    Taglines?: string[];
    Genres?: string[];
    OfficialRating?: string;
    ImageTags?: Record<string, string>;
    BackdropImageTags?: string[];
    ProviderIds?: Record<string, string>;
    [field: string]: unknown;
};

export async function getItemRaw(itemId: string): Promise<JFRawItem> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    return apiFetch<JFRawItem>(
        `/Users/${session.userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,ProductionYear,OfficialRating,OriginalTitle,ProviderIds`
    );
}

export async function updateItemMetadata(itemId: string, patch: ItemMetadataPatch): Promise<void> {
    const current = await getItemRaw(itemId);
    const merged = { ...current, ...patch };
    await apiSend(`/Items/${itemId}`, 'POST', merged);
    clearShowCache();
    emitItemMutated(itemId);
}

export async function remoteSearch(
    itemId: string,
    itemType: 'Movie' | 'Series' | 'Episode',
    query?: { name?: string; year?: number }
): Promise<RemoteSearchResult[]> {
    const raw = await getItemRaw(itemId);
    const body = {
        ItemId: itemId,
        SearchInfo: {
            Name: query?.name ?? raw.Name,
            Year: query?.year ?? raw.ProductionYear,
            ProviderIds: raw.ProviderIds ?? {}
        }
    };
    const res = await apiSend(`/Items/RemoteSearch/${itemType}`, 'POST', body);
    return res.json();
}

export async function applyRemoteSearchResult(
    itemId: string,
    result: RemoteSearchResult
): Promise<void> {
    await apiSend(`/Items/RemoteSearch/Apply/${itemId}?replaceAllImages=true`, 'POST', result);
    clearShowCache();
    emitItemMutated(itemId);
}
