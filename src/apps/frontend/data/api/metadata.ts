// Metadata editing + remote provider search (TMDB/TVDB "Identify…").

import { loadSession } from '../session/session';
import { MANUAL_TAGS } from '../stores/manualTagsStore';
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
    Tags?: string[];
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
    Tags?: string[];
    ImageTags?: Record<string, string>;
    BackdropImageTags?: string[];
    ProviderIds?: Record<string, string>;
    [field: string]: unknown;
};

export async function getItemRaw(itemId: string): Promise<JFRawItem> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    // `Tags` va en la lista porque el guardado reenvía el item entero: si no
    // se pidiera aquí, cada edición de metadatos borraría las etiquetas.
    return apiFetch<JFRawItem>(
        `/Users/${session.userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,ProductionYear,OfficialRating,OriginalTitle,ProviderIds,Tags`
    );
}

/**
 * Manda el item ya leído con el parche aplicado. Separado de
 * `updateItemMetadata` para que quien ya tenga el item en la mano —
 * `setItemTags`, que necesita las etiquetas previas para diferenciarlas —
 * no tenga que volver a pedirlo.
 */
async function applyPatch(
    itemId: string, current: JFRawItem, patch: ItemMetadataPatch
): Promise<void> {
    await apiSend(`/Items/${itemId}`, 'POST', { ...current, ...patch });
    clearShowCache();
    emitItemMutated(itemId);
}

export async function updateItemMetadata(itemId: string, patch: ItemMetadataPatch): Promise<void> {
    await applyPatch(itemId, await getItemRaw(itemId), patch);
}

/** Etiquetas del item, normalizadas: sin vacíos, sin duplicados y ordenadas. */
export function normalizeTags(tags: string[]): string[] {
    const seen = new Map<string, string>();
    for (const raw of tags) {
        const tag = raw.trim();
        // Se comparan en minúsculas para no acabar con «Serie» y «serie» como
        // etiquetas distintas, pero se conserva cómo la escribió el usuario.
        if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Reemplaza las etiquetas de un item por las que se le pasen. */
export async function setItemTags(itemId: string, tags: string[]): Promise<void> {
    const current = await getItemRaw(itemId);
    const next = normalizeTags(tags);
    // El diálogo manda la lista entera, y ahí van mezclados los keywords que
    // ya traía el item de TMDB con lo que acaba de teclear el usuario. Lo que
    // no estuviera antes es lo escrito ahora: solo eso se registra como
    // manual, que es lo que decide qué se ve en la fila de chips.
    const before = new Set((current.Tags ?? []).map((t) => t.toLowerCase()));
    MANUAL_TAGS.add(next.filter((t) => !before.has(t.toLowerCase())));
    await applyPatch(itemId, current, { Tags: next });
}

/**
 * Añade `tags` a varios items a la vez, conservando lo que ya tuviera cada
 * uno. Un solo `emitItemMutated()` al final: cada evento provoca un refetch
 * de la biblioteca entera, y con N items eso serían N recargas seguidas.
 *
 * Los items se procesan en serie a propósito — `POST /Items/{id}` reescribe
 * el item completo, y lanzar decenas en paralelo contra el servidor de casa
 * es la forma rápida de que empiece a devolver errores.
 */
export async function setItemsTags(itemIds: string[], tags: string[]): Promise<void> {
    const added = normalizeTags(tags);
    if (added.length === 0 || itemIds.length === 0) return;
    // En el lote no hay ambigüedad: lo que se pasa es exactamente lo que el
    // usuario ha escrito en el diálogo.
    MANUAL_TAGS.add(added);
    for (const itemId of itemIds) {
        const current = await getItemRaw(itemId);
        const merged = {
            ...current,
            Tags: normalizeTags([...(current.Tags ?? []), ...added])
        };
        await apiSend(`/Items/${itemId}`, 'POST', merged);
    }
    clearShowCache();
    emitItemMutated();
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
