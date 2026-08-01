// Listas del servidor: listas de reproducción y colecciones.
//
// Mismo contrato que favsStore/queueStore —caché en memoria + evento global
// para que la UI re-lea— pero la fuente de verdad es el SERVIDOR: se ven desde
// cualquier cliente de Jellyfin.
//
// Los dos tipos se manejan juntos porque para el usuario son lo mismo (una
// lista donde meter títulos) y el botón «Mi lista» tiene que ofrecer ambas.
// Por dentro se comportan distinto, y esas diferencias se aíslan aquí:
//
//   - Una lista de reproducción EXPANDE las series en sus episodios; una
//     colección guarda la serie tal cual.
//   - Para borrar, una lista quiere el `PlaylistItemId` de cada entrada; una
//     colección se conforma con el id del item.
//
// Se cachea entero a propósito. Jellyfin no expone «en qué listas está este
// item», así que responder a eso obliga a leer el contenido de todas; hacerlo
// por cada botón que se pinta sería una tormenta de peticiones.

import { imageUrl } from '../api/images';
import {
    addToCollection, addToPlaylist, collapseSeries, createCollection, createPlaylist,
    entryIndex, getCollectionItems, getCollections, getPlaylistItems, getPlaylists,
    removeFromCollection, removeFromPlaylist, type ListEntry, type PlaylistItem
} from '../api/lists';
import { deleteImage, setImageByUrl, uploadImageFile } from '../api/remote-images';
import { LIST_COVERS } from './listCoversStore';

const EVENT = 'jfp-lists-change';

export type ListKind = 'playlist' | 'collection';

/** Una lista concreta, con su tipo. */
export type ListRef = ListEntry & {
    kind: ListKind;
    /** True si el fondo lo puso el usuario y no es la portada automática. */
    hasCustomCover?: boolean;
};

/**
 * La imagen propia de la lista, recién pedida al servidor.
 *
 * Sin `tag`: al subir una nueva, el tag cambia y el que tuviéramos cacheado
 * apuntaría a la vieja. Se cuela un contador para saltarse la caché del
 * navegador, que si no seguiría enseñando la anterior.
 */
function coverImage(listId: string): string | undefined {
    return imageUrl(listId, 'Primary', { maxWidth: 800 }) ?
        `${imageUrl(listId, 'Primary', { maxWidth: 800 })}&v=${coverVersion}` :
        undefined;
}

/** Sube cada vez que se cambia un fondo, para invalidar la caché de imágenes. */
let coverVersion = 0;

/** Clave única: los ids no colisionan entre tipos, pero conviene no fiarse. */
const keyOf = (kind: ListKind, id: string) => `${kind}:${id}`;

type Loaded = {
    lists: ListRef[];
    /**
     * clave de lista → (título → ids con los que se le quita).
     *
     * Son varios ids por título porque una serie vive en una lista de
     * reproducción como uno por episodio; en una colección siempre es uno.
     */
    entries: Map<string, Map<string, string[]>>;
    /** clave de lista → imagen del último título añadido, para la portada. */
    covers: Map<string, string | undefined>;
};

let cache: Loaded | null = null;
let inflight: Promise<Loaded> | null = null;

function emit() {
    window.dispatchEvent(new Event(EVENT));
}

/**
 * Portada de una lista: la imagen del último título añadido.
 *
 * Se recorre hacia atrás y no se coge el último a secas porque añadir una
 * serie a una lista de reproducción la expande en TODOS sus episodios, y el
 * último capítulo puede no tener ninguna imagen — quedaría una tarjeta gris
 * justo después de añadir algo, que es cuando más se mira. Se prefiere la
 * apaisada: la tarjeta es 16/9 y una carátula vertical se recorta fatal.
 */
function coverOf(items: readonly { backdrop?: string; poster?: string }[]): string | undefined {
    for (let i = items.length - 1; i >= 0; i--) {
        const image = items[i].backdrop ?? items[i].poster;
        if (image) return image;
    }
    return undefined;
}

/** Los títulos de una lista tal como se enseñan y se cuentan. */
export function displayItems(kind: ListKind, items: PlaylistItem[]): PlaylistItem[] {
    return kind === 'playlist' ? collapseSeries(items) : items;
}

/** Índice título → ids de borrado, según lo que espere cada tipo. */
function removalIndex(kind: ListKind, items: PlaylistItem[]): Map<string, string[]> {
    if (kind === 'playlist') return entryIndex(items);
    // Una colección se borra por id de item; no hay entrada intermedia.
    return new Map(items.map((i) => [i.id, [i.id]]));
}

async function fetchKind(kind: ListKind, loaded: Loaded): Promise<void> {
    const lists = kind === 'playlist' ? await getPlaylists() : await getCollections();
    const fetchItems = kind === 'playlist' ? getPlaylistItems : getCollectionItems;
    await Promise.all(lists.map(async (list) => {
        const key = keyOf(kind, list.id);
        loaded.lists.push({ ...list, kind });
        try {
            const items = await fetchItems(list.id);
            loaded.entries.set(key, removalIndex(kind, items));
            loaded.covers.set(key, coverOf(displayItems(kind, items)));
        } catch {
            // Una lista que falla no debe dejar sin datos a las demás.
            loaded.entries.set(key, new Map());
        }
    }));
}

async function fetchAll(): Promise<Loaded> {
    const loaded: Loaded = { lists: [], entries: new Map(), covers: new Map() };
    // Si un tipo falla entero (por permisos, por ejemplo) el otro se sigue
    // pudiendo usar.
    await Promise.allSettled([fetchKind('playlist', loaded), fetchKind('collection', loaded)]);
    return loaded;
}

async function reload(): Promise<Loaded> {
    // Una sola petición en vuelo: varios botones montándose a la vez piden
    // carga y no tiene sentido leerlo todo N veces.
    inflight ??= fetchAll().finally(() => { inflight = null; });
    cache = await inflight;
    emit();
    return cache;
}

export const LISTS = {
    event: EVENT,

    /** Carga si no hay nada cacheado. No fuerza refresco. */
    async ensure(): Promise<void> {
        if (cache) return;
        await reload();
    },

    /** Vuelve a leerlo todo del servidor. */
    async refresh(): Promise<void> {
        await reload();
    },

    /**
     * Las listas existentes, con la portada y el recuento ya resueltos.
     * Vacío mientras no se haya cargado.
     */
    all(): ListRef[] {
        if (!cache) return [];
        return cache.lists.map((l) => {
            const key = keyOf(l.kind, l.id);
            return {
                ...l,
                // Manda el fondo que haya puesto el usuario. Si no hay, la
                // portada automática: el último título añadido. La imagen que
                // trae el servidor por su cuenta (`l.image`) se deja la
                // última porque suele ser el collage, que es feo.
                image: LIST_COVERS.has(key) ?
                    coverImage(l.id) ?? l.image :
                    cache?.covers.get(key) ?? l.image,
                hasCustomCover: LIST_COVERS.has(key),
                // El `ChildCount` del servidor cuenta episodios sueltos: una
                // lista con una película y una serie de 14 capítulos diría 15.
                // Se cuenta sobre los títulos plegados, que es lo que el
                // usuario metió.
                count: cache?.entries.get(key)?.size ?? l.count
            };
        });
    },

    /** Solo las de un tipo. */
    ofKind(kind: ListKind): ListRef[] {
        return this.all().filter((l) => l.kind === kind);
    },

    /** Una lista concreta, para pintar su cabecera. */
    find(kind: ListKind, id: string): ListRef | undefined {
        return this.all().find((l) => l.kind === kind && l.id === id);
    },

    /** True si el título está en al menos una lista, del tipo que sea. */
    has(itemId: string): boolean {
        if (!cache) return false;
        for (const entries of cache.entries.values()) {
            if (entries.has(itemId)) return true;
        }
        return false;
    },

    /** Claves (`tipo:id`) de las listas que contienen el título. */
    keysOf(itemId: string): string[] {
        if (!cache) return [];
        return cache.lists
            .map((l) => keyOf(l.kind, l.id))
            .filter((key) => cache?.entries.get(key)?.has(itemId));
    },

    /** True si esa lista concreta contiene el título. */
    contains(kind: ListKind, listId: string, itemId: string): boolean {
        return cache?.entries.get(keyOf(kind, listId))?.has(itemId) ?? false;
    },

    /**
     * Mete el título en la lista o lo saca, según esté.
     *
     * La caché se actualiza antes de que conteste el servidor para que el
     * botón responda al instante; si la llamada falla se revierte y se
     * propaga el error, que es quien enseña el aviso.
     */
    async toggle(kind: ListKind, listId: string, itemId: string): Promise<void> {
        const entries = cache?.entries.get(keyOf(kind, listId));
        if (!entries) return;
        const ids = entries.get(itemId);

        if (ids) {
            entries.delete(itemId);
            emit();
            try {
                // Todas de una vez: quitar una serie de una lista de
                // reproducción es borrar las entradas de sus episodios, y el
                // endpoint acepta varias separadas por coma.
                const joined = ids.join(',');
                if (kind === 'playlist') await removeFromPlaylist(listId, joined);
                else await removeFromCollection(listId, joined);
            } catch (e) {
                entries.set(itemId, ids);
                emit();
                throw e;
            }
        } else {
            // Marcador provisional: los ids reales de borrado solo los sabe el
            // servidor, y hasta el refresco no hacen falta para nada más que
            // para saber que el título está dentro.
            entries.set(itemId, []);
            emit();
            try {
                if (kind === 'playlist') await addToPlaylist(listId, itemId);
                else await addToCollection(listId, itemId);
            } catch (e) {
                entries.delete(itemId);
                emit();
                throw e;
            }
        }
        // Se recarga para quedarse con los ids reales y el recuento que enseña
        // el diálogo.
        await reload();
    },

    /** Crea una lista del tipo pedido con el título dentro. */
    async create(kind: ListKind, name: string, itemId: string): Promise<void> {
        if (kind === 'playlist') await createPlaylist(name, itemId);
        else await createCollection(name, itemId);
        await reload();
    },

    /**
     * Pone un fondo propio a la lista, desde una URL o desde un fichero.
     *
     * Se sube al servidor como imagen `Primary` —así se ve desde cualquier
     * cliente— y además se anota en local que es del usuario, que es lo único
     * que permite distinguirla luego del collage que genera Jellyfin.
     */
    async setCover(kind: ListKind, listId: string, source: string | File): Promise<void> {
        if (typeof source === 'string') await setImageByUrl(listId, 'Primary', source);
        else await uploadImageFile(listId, 'Primary', source);
        LIST_COVERS.mark(keyOf(kind, listId));
        coverVersion++;
        await reload();
    },

    /** Quita el fondo propio y vuelve a la portada automática. */
    async clearCover(kind: ListKind, listId: string): Promise<void> {
        // Se desmarca antes de borrar: si el borrado falla porque la imagen ya
        // no estaba, el resultado que quiere el usuario —volver a la portada
        // automática— se cumple igual.
        LIST_COVERS.unmark(keyOf(kind, listId));
        coverVersion++;
        try {
            await deleteImage(listId, 'Primary');
        } catch {
            // Sin imagen que borrar; nada que reparar.
        }
        await reload();
    },

    /** True si esa lista tiene un fondo puesto a mano. */
    hasCustomCover(kind: ListKind, listId: string): boolean {
        return LIST_COVERS.has(keyOf(kind, listId));
    },

    /** Solo para tests. */
    _reset() {
        cache = null;
        inflight = null;
    }
};
