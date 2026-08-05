// Playlists y colecciones: listar, crear y añadir items. Sustituye a los
// enlaces al web nativo del menú "más opciones".

import { loadSession } from '../session/session';
import { apiFetch, apiSend, fetchUserItems, noSessionError } from './http';
import { firstImageUrl } from './itemMapping';

/**
 * Tamaños con los que se piden las imágenes de una lista. Las tarjetas de
 * lista se pintan más pequeñas que una ficha, así que no hace falta el tamaño
 * de itemMapping.
 */
const POSTER_HEIGHT = 480;
const BACKDROP_WIDTH = 800;
const LOGO_HEIGHT = 120;
/** El fondo del hero de una lista se ve a pantalla completa, no en tarjeta. */
const HERO_WIDTH = 1920;
const HERO_POSTER_HEIGHT = 1080;

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
        image: firstImageUrl([['Primary', i.Id, i.ImageTags?.Primary]], { maxHeight: 200 })
    };
}

export async function getPlaylists(): Promise<ListEntry[]> {
    const items = await fetchUserItems<JFListItem>(
        'IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&Fields=ChildCount'
    );
    return items.map(mapEntry);
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
    /** La misma imagen a tamaño de pantalla, para el hero de la lista. */
    heroBackdrop?: string;
    /**
     * Cuándo entró en la biblioteca (ISO). Es lo que decide qué fondo hereda
     * la lista cuando no se le ha puesto uno a mano.
     */
    added?: string;
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
    DateCreated?: string;
};

function mapPlaylistItem(i: JFPlaylistItem): PlaylistItem {
    return {
        id: i.Id,
        title: i.Name,
        kind: i.Type === 'Series' ? 'show' : i.Type === 'Episode' ? 'episode' : 'movie',
        year: i.ProductionYear,
        // Un episodio no suele traer carátula propia; se cae a la de su serie
        // para que la rejilla no quede con huecos grises.
        poster: firstImageUrl([
            ['Primary', i.Id, i.ImageTags?.Primary],
            ['Primary', i.SeriesId, i.SeriesPrimaryImageTag]
        ], { maxHeight: POSTER_HEIGHT }),
        // Los episodios traen el fondo de la serie en `ParentBackdrop*`.
        backdrop: firstImageUrl([
            ['Backdrop', i.Id, i.BackdropImageTags?.[0]],
            ['Backdrop', i.ParentBackdropItemId, i.ParentBackdropImageTags?.[0]]
        ], { maxWidth: BACKDROP_WIDTH }),
        // Misma imagen, tamaño de pantalla. Se cae a la carátula porque un
        // hero con una vertical estirada se ve mejor que uno en negro, y hay
        // títulos sin fondo.
        heroBackdrop: firstImageUrl([
            ['Backdrop', i.Id, i.BackdropImageTags?.[0]],
            ['Backdrop', i.ParentBackdropItemId, i.ParentBackdropImageTags?.[0]]
        ], { maxWidth: HERO_WIDTH }) ?? firstImageUrl([
            ['Primary', i.Id, i.ImageTags?.Primary],
            ['Primary', i.SeriesId, i.SeriesPrimaryImageTag]
        ], { maxHeight: HERO_POSTER_HEIGHT }),
        added: i.DateCreated,
        logo: firstImageUrl([['Logo', i.Id, i.ImageTags?.Logo]], { maxHeight: LOGO_HEIGHT }) ?? null,
        seriesId: i.SeriesId,
        seriesName: i.SeriesName,
        seriesPoster: firstImageUrl(
            [['Primary', i.SeriesId, i.SeriesPrimaryImageTag]], { maxHeight: POSTER_HEIGHT }
        ),
        // El logo de la serie llega en el episodio como `ParentLogo*`; no hay
        // un `SeriesLogoImageTag` equivalente al de la carátula.
        seriesLogo: firstImageUrl(
            [['Logo', i.ParentLogoItemId, i.ParentLogoImageTag]], { maxHeight: LOGO_HEIGHT }
        ) ?? null,
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
            + '&Fields=ProductionYear,ImageTags,DateCreated&EnableImageTypes=Primary,Logo,Backdrop'
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
    const items = await fetchUserItems<JFListItem>(
        'IncludeItemTypes=BoxSet&Recursive=true&SortBy=SortName&Fields=ChildCount'
    );
    return items.map(mapEntry);
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
    const items = await fetchUserItems<JFPlaylistItem>(
        `ParentId=${collectionId}&SortBy=SortName`
            + '&Fields=ProductionYear,ImageTags,DateCreated&EnableImageTypes=Primary,Logo,Backdrop'
    );
    return items.map(mapPlaylistItem);
}
