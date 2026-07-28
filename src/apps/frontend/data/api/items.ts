// Direct item actions surfaced from the "more" menu.

import { loadSession } from '../session/session';
import { clearShowCache } from './cache';
import { apiSend, noSessionError, trimSlash } from './http';
import { emitItemMutated } from './mutations';

export async function markPlayed(itemId: string, played: boolean): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await apiSend(
        `/Users/${session.userId}/PlayedItems/${itemId}`,
        played ? 'POST' : 'DELETE'
    );
    clearShowCache();
    emitItemMutated(itemId);
}

export async function toggleFavorite(itemId: string, favorite: boolean): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await apiSend(
        `/Users/${session.userId}/FavoriteItems/${itemId}`,
        favorite ? 'POST' : 'DELETE'
    );
    clearShowCache();
    emitItemMutated(itemId);
}

export async function refreshItemMetadata(itemId: string): Promise<void> {
    await apiSend(
        `/Items/${itemId}/Refresh?metadataRefreshMode=FullRefresh&imageRefreshMode=FullRefresh&replaceAllMetadata=false&replaceAllImages=false`,
        'POST'
    );
    emitItemMutated(itemId);
}

export async function deleteItem(itemId: string): Promise<void> {
    await apiSend(`/Items/${itemId}`, 'DELETE');
    clearShowCache();
    emitItemMutated(itemId);
}

export function downloadUrl(itemId: string): string {
    const session = loadSession();
    if (!session?.accessToken) return '';
    return `${trimSlash(session.serverUrl)}/Items/${itemId}/Download?api_key=${encodeURIComponent(session.accessToken)}`;
}

// Canonical link to the item inside the native web player, for surfaces we
// don't yet reimplement in the custom frontend (share, playlists, etc.).
export function nativeItemUrl(itemId: string): string {
    const session = loadSession();
    if (!session?.serverUrl) return '';
    const server = session.serverId ? `&serverId=${session.serverId}` : '';
    return `${trimSlash(session.serverUrl)}/web/#/details?id=${itemId}${server}`;
}
