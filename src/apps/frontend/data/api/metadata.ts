// Metadata editing + remote provider search (TMDB/TVDB "Identify…").

import { loadSession } from '../session/session';
import { clearShowCache } from './cache';
import { apiFetch, apiSend } from './http';

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

export async function getItemRaw(itemId: string): Promise<any> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    return apiFetch<any>(
        `/Users/${session.userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,ProductionYear,OfficialRating,OriginalTitle,ProviderIds`
    );
}

export async function updateItemMetadata(itemId: string, patch: ItemMetadataPatch): Promise<void> {
    const current = await getItemRaw(itemId);
    const merged = { ...current, ...patch };
    await apiSend(`/Items/${itemId}`, 'POST', merged);
    clearShowCache();
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
}
