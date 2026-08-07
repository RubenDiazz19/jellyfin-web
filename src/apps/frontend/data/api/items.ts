// Direct item actions surfaced from the "more" menu.

import { loadSession } from '../session/session';
import { clearShowCache } from './cache';
import { apiSend, noSessionError, trimSlash } from './http';
import { markDeleted } from './deleted';
import { emitItemDeleted, emitItemMutated } from './mutations';

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

/**
 * Marca o desmarca el item como favorito en el servidor.
 *
 * A diferencia de `markPlayed` no invalida cachés ni emite `itemMutated`: el
 * estado de favorito no viaja en ningún modelo cacheado (ni `Show` ni `Movie`
 * lo llevan), lo pinta el store local. Tirar la caché de series y forzar un
 * refetch de la biblioteca entera en cada corazón sería trabajo perdido.
 */
export async function toggleFavorite(itemId: string, favorite: boolean): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await apiSend(
        `/Users/${session.userId}/FavoriteItems/${itemId}`,
        favorite ? 'POST' : 'DELETE'
    );
}

/**
 * Los tres modos de refresco de Jellyfin, con los mismos nombres que usa el
 * diálogo nativo:
 *
 * - `scan`: solo mira el disco a por archivos nuevos o cambiados. Lo que ya
 *   está catalogado no se vuelve a consultar a los proveedores, así que ni
 *   los metadatos ni las imágenes existentes se tocan.
 * - `missing`: además pregunta a los proveedores por lo que esté vacío. Los
 *   campos que ya tienen valor se respetan.
 * - `all`: descarta los metadatos actuales y los vuelve a bajar.
 *
 * Las imágenes van aparte a propósito: ni `missing` ni `all` sustituyen una
 * carátula que ya existe salvo que se pida `replaceImages`. Es la diferencia
 * entre «actualiza el contenido» y «vuelve a bajarlo todo», que es justo lo
 * que el botón único de antes no dejaba elegir.
 */
export type RefreshMode = 'scan' | 'missing' | 'all';

export type RefreshOptions = {
    mode: RefreshMode;
    /** Sustituir las imágenes que ya tiene. Se ignora en modo `scan`. */
    replaceImages?: boolean;
    /** Regenerar las miniaturas de la barra de progreso. Idem. */
    replaceTrickplay?: boolean;
};

export async function refreshItemMetadata(itemId: string, options: RefreshOptions): Promise<void> {
    // `Default` es «mira el disco»; `FullRefresh`, «vuelve a preguntar a los
    // proveedores». Los dos reemplazos solo tienen sentido con el segundo.
    const full = options.mode !== 'scan';
    const mode = full ? 'FullRefresh' : 'Default';
    const query = new URLSearchParams({
        metadataRefreshMode: mode,
        imageRefreshMode: mode,
        replaceAllMetadata: String(options.mode === 'all'),
        replaceAllImages: String(full && !!options.replaceImages),
        regenerateTrickplay: String(full && !!options.replaceTrickplay)
    });
    await apiSend(`/Items/${itemId}/Refresh?${query.toString()}`, 'POST');
    emitItemMutated(itemId);
}

export async function deleteItem(itemId: string): Promise<void> {
    await apiSend(`/Items/${itemId}`, 'DELETE');
    // Antes de avisar a nadie: a partir de aquí, pedir su ficha es un 404
    // seguro y la capa de datos lo corta sola (ver deleted.ts).
    markDeleted(itemId);
    clearShowCache();
    // `emitItemDeleted` y no `emitItemMutated`: quien esté enseñando este item
    // tiene que irse, no recargarlo. Ver la nota en mutations.ts.
    emitItemDeleted(itemId);
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
