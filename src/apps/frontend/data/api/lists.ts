// Playlists y colecciones: listar, crear y añadir items. Sustituye a los
// enlaces al web nativo del menú "más opciones".

import { loadSession } from '../session/session';
import { apiFetch, apiSend, noSessionError } from './http';
import { imageUrl } from './images';

export type ListEntry = {
    id: string;
    name: string;
    count?: number;
    image?: string;
};

/** Campos que devuelve el listado de playlists/colecciones y aquí se usan. */
type JFListItem = {
    Id: string;
    Name: string;
    ChildCount?: number;
    ImageTags?: Record<string, string>;
};

function mapEntry(i: JFListItem): ListEntry {
    return {
        id: i.Id,
        name: i.Name,
        count: i.ChildCount,
        image: i.ImageTags?.Primary ?
            imageUrl(i.Id, 'Primary', { tag: i.ImageTags.Primary, maxHeight: 200 }) ?? undefined :
            undefined
    };
}

export async function getPlaylists(): Promise<ListEntry[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFListItem[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&Fields=ChildCount`
    );
    return (data.Items ?? []).map(mapEntry);
}

export async function addToPlaylist(playlistId: string, itemId: string): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await apiSend(`/Playlists/${playlistId}/Items?ids=${itemId}&userId=${session.userId}`, 'POST');
}

/**
 * A qué título «cuenta» una entrada de la lista.
 *
 * Al meter una serie en una lista, Jellyfin NO guarda la serie: la expande en
 * todos sus episodios, uno por entrada. Es del servidor y no hay forma de
 * evitarlo —pasa igual creando la lista con la serie dentro que añadiéndola
 * después, con `MediaType` o sin él—. Así que los episodios se vuelven a
 * agrupar bajo su serie: la lista de 14 capítulos se ve y se maneja como el
 * único título que el usuario metió.
 */
function subjectOf(item: PlaylistItem): string {
    return item.kind === 'episode' && item.seriesId ? item.seriesId : item.id;
}

/**
 * Índice del contenido de una lista: título → ids de SUS ENTRADAS.
 *
 * Son cosas distintas y la diferencia importa: para borrar, `DELETE
 * /Playlists/{id}/Items` espera el `PlaylistItemId`, no el id del item. Y son
 * varias por título, no una: quitar una serie significa borrar de golpe las
 * entradas de todos sus episodios.
 */
export function entryIndex(items: readonly PlaylistItem[]): Map<string, string[]> {
    const entries = new Map<string, string[]>();
    for (const item of items) {
        // Sin `entryId` no se puede borrar; se ignora en vez de guardar una
        // entrada que luego fallaría al quitarla.
        if (!item.entryId) continue;
        const key = subjectOf(item);
        const list = entries.get(key);
        if (list) list.push(item.entryId);
        else entries.set(key, [item.entryId]);
    }
    return entries;
}

/**
 * Los títulos de la lista tal como hay que enseñarlos: los episodios sueltos
 * se pliegan en su serie, conservando el sitio del primero que apareció.
 */
export function collapseSeries(items: readonly PlaylistItem[]): PlaylistItem[] {
    const out: PlaylistItem[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const key = subjectOf(item);
        if (seen.has(key)) continue;
        seen.add(key);
        if (item.kind === 'episode' && item.seriesId) {
            // Se sustituye por la serie: su nombre, su carátula y su ficha.
            // Las imágenes del episodio ya apuntan a las del padre cuando él
            // no tiene propias, así que sirven de respaldo.
            out.push({
                ...item,
                id: item.seriesId,
                title: item.seriesName ?? item.title,
                kind: 'show',
                // La carátula del capítulo es un fotograma suelto; la de la
                // serie es la que se reconoce de un vistazo. El logo tiene que
                // ser el de la SERIE, no el del episodio —que casi nunca
                // tiene—: si no, la tarjeta cae al título en texto y la serie
                // se ve distinta a la película de al lado.
                poster: item.seriesPoster ?? item.poster,
                logo: item.seriesLogo ?? null
            });
        } else {
            out.push(item);
        }
    }
    return out;
}

/** Un item dentro de una lista, con lo justo para pintar su tarjeta. */
export type PlaylistItem = {
    id: string;
    title: string;
    kind: 'show' | 'movie' | 'episode';
    year?: number;
    poster?: string;
    /** Imagen apaisada, para las tarjetas 16/9 del índice de listas. */
    backdrop?: string;
    logo?: string | null;
    /** Serie a la que pertenece, cuando el item es un episodio. */
    seriesId?: string;
    seriesName?: string;
    /** Carátula de la serie, para cuando el episodio se pliega en ella. */
    seriesPoster?: string;
    /** Logo de la serie, para lo mismo. */
    seriesLogo?: string | null;
    /** Id de SU ENTRADA en la lista, que es lo que borra el DELETE. */
    entryId?: string;
};

type JFPlaylistItem = {
    Id: string;
    Name: string;
    Type?: string;
    ProductionYear?: number;
    ImageTags?: Record<string, string>;
    BackdropImageTags?: string[];
    ParentBackdropItemId?: string;
    ParentBackdropImageTags?: string[];
    SeriesId?: string;
    SeriesName?: string;
    SeriesPrimaryImageTag?: string;
    ParentLogoItemId?: string;
    ParentLogoImageTag?: string;
    PlaylistItemId?: string;
};

function mapPlaylistItem(i: JFPlaylistItem): PlaylistItem {
    return {
        id: i.Id,
        title: i.Name,
        kind: i.Type === 'Series' ? 'show' : i.Type === 'Episode' ? 'episode' : 'movie',
        year: i.ProductionYear,
        // Un episodio no suele traer carátula propia; se cae a la de su serie
        // para que la rejilla no quede con huecos grises.
        poster: i.ImageTags?.Primary ?
            imageUrl(i.Id, 'Primary', { tag: i.ImageTags.Primary, maxHeight: 480 }) ?? undefined :
            i.SeriesId && i.SeriesPrimaryImageTag ?
                imageUrl(i.SeriesId, 'Primary', {
                    tag: i.SeriesPrimaryImageTag, maxHeight: 480
                }) ?? undefined :
                undefined,
        // Los episodios traen el fondo de la serie en `ParentBackdrop*`.
        backdrop: i.BackdropImageTags?.[0] ?
            imageUrl(i.Id, 'Backdrop', { tag: i.BackdropImageTags[0], maxWidth: 800 }) ?? undefined :
            i.ParentBackdropItemId && i.ParentBackdropImageTags?.[0] ?
                imageUrl(i.ParentBackdropItemId, 'Backdrop', {
                    tag: i.ParentBackdropImageTags[0], maxWidth: 800
                }) ?? undefined :
                undefined,
        logo: i.ImageTags?.Logo ?
            imageUrl(i.Id, 'Logo', { tag: i.ImageTags.Logo, maxHeight: 120 }) :
            null,
        seriesId: i.SeriesId,
        seriesName: i.SeriesName,
        seriesPoster: i.SeriesId && i.SeriesPrimaryImageTag ?
            imageUrl(i.SeriesId, 'Primary', {
                tag: i.SeriesPrimaryImageTag, maxHeight: 480
            }) ?? undefined :
            undefined,
        // El logo de la serie llega en el episodio como `ParentLogo*`; no hay
        // un `SeriesLogoImageTag` equivalente al de la carátula.
        seriesLogo: i.ParentLogoItemId && i.ParentLogoImageTag ?
            imageUrl(i.ParentLogoItemId, 'Logo', {
                tag: i.ParentLogoImageTag, maxHeight: 120
            }) :
            null,
        entryId: i.PlaylistItemId
    };
}

/**
 * Contenido de una lista, en el orden en que está guardada — añadir mete al
 * final, así que el último elemento es el último añadido.
 *
 * Una sola llamada sirve para todo lo que hace falta de una lista: pintar sus
 * items, saber qué contiene y con qué id de entrada borrar cada uno. Antes
 * eran dos peticiones al mismo endpoint.
 */
export async function getPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFPlaylistItem[] }>(
        `/Playlists/${playlistId}/Items?userId=${session.userId}`
            + '&Fields=ProductionYear,ImageTags&EnableImageTypes=Primary,Logo,Backdrop'
    );
    return (data.Items ?? []).map(mapPlaylistItem);
}

export async function removeFromPlaylist(playlistId: string, entryId: string): Promise<void> {
    await apiSend(`/Playlists/${playlistId}/Items?entryIds=${entryId}`, 'DELETE');
}

/** Crea la lista con el item dentro y devuelve su id. */
export async function createPlaylist(name: string, itemId: string): Promise<string> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const res = await apiSend('/Playlists', 'POST', {
        Name: name,
        Ids: [itemId],
        UserId: session.userId,
        MediaType: 'Video'
    });
    // El servidor devuelve `{ Id }`. Si algún día dejara de hacerlo, el store
    // se recarga entero igualmente: el id es un atajo, no un requisito.
    const body = await res.json().catch(() => ({})) as { Id?: string };
    return body.Id ?? '';
}

export async function getCollections(): Promise<ListEntry[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFListItem[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=BoxSet&Recursive=true&SortBy=SortName&Fields=ChildCount`
    );
    return (data.Items ?? []).map(mapEntry);
}

export async function addToCollection(collectionId: string, itemId: string): Promise<void> {
    await apiSend(`/Collections/${collectionId}/Items?ids=${itemId}`, 'POST');
}

/**
 * Quita items de una colección.
 *
 * Aquí sí basta el id del item, al revés que en las listas de reproducción:
 * una colección guarda el título tal cual, sin una entrada intermedia con id
 * propio.
 */
export async function removeFromCollection(collectionId: string, itemIds: string): Promise<void> {
    await apiSend(`/Collections/${collectionId}/Items?ids=${itemIds}`, 'DELETE');
}

/** Crea la colección con el item dentro y devuelve su id. */
export async function createCollection(name: string, itemId: string): Promise<string> {
    const res = await apiSend(
        `/Collections?name=${encodeURIComponent(name)}&ids=${itemId}`, 'POST'
    );
    const body = await res.json().catch(() => ({})) as { Id?: string };
    return body.Id ?? '';
}

/**
 * Contenido de una colección.
 *
 * A diferencia de las listas de reproducción, una colección **no expande las
 * series**: guarda «Rompiendo el hielo» como un título, no como sus catorce
 * capítulos. Por eso aquí no hace falta plegar nada.
 */
export async function getCollectionItems(collectionId: string): Promise<PlaylistItem[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFPlaylistItem[] }>(
        `/Users/${session.userId}/Items?ParentId=${collectionId}&SortBy=SortName`
            + '&Fields=ProductionYear,ImageTags&EnableImageTypes=Primary,Logo,Backdrop'
    );
    return (data.Items ?? []).map(mapPlaylistItem);
}
