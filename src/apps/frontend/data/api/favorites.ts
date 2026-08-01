// El puente entre los favoritos del servidor y el store local FAVS.
//
// Los dos hablan idiomas distintos: el servidor identifica cada cosa por su id
// (también las temporadas y los episodios), y el store por claves compuestas
// que sitúan la temporada o el episodio dentro de su serie (ver itemKeys). Aquí
// se traduce en ambos sentidos:
//
//   servidor → store   `hydrateFavorites`, al abrir Favoritos y al arrancar
//   store → servidor   `favoriteServerId`, para que el corazón sepa a quién marcar
//
// El servidor manda: lo que ya no esté marcado allí sale de aquí, y así
// desfavoritear desde el móvil llega al navegador de casa.

import { FAVS } from '../stores/favsStore';
import { episodeKey, movieKey, parseItemKey, seasonKey, serverIdFromKey } from '../stores/itemKeys';
import { fetchUserItems } from './http';
import { toggleFavorite } from './items';
import { getShow } from './shows';
import type { JFItem } from './types';

/** Lo que el servidor considera favoriteable dentro de este frontend. */
const FAV_TYPES = 'Movie,Series,Season,Episode';

/**
 * Marca de que los favoritos de este navegador ya se subieron al servidor.
 * Vive suelta en localStorage y no en un store: se lee y se escribe una única
 * vez en la vida de la instalación.
 */
const MIGRATED_KEY = 'jfp-favs-synced';

type JFFavorite = JFItem & { Type?: string };

/**
 * Clave local del item favorito que manda el servidor, o null si no sabemos
 * situarlo — una temporada suelta sin serie, o un tipo que este frontend no
 * pinta (un álbum, un libro).
 */
function favKeyOf(item: JFFavorite): string | null {
    switch (item.Type) {
        case 'Movie':
            return movieKey(item.Id);
        case 'Series':
            return item.Id || null;
        case 'Season':
            return item.SeriesId && typeof item.IndexNumber === 'number' ?
                seasonKey(item.SeriesId, item.IndexNumber) :
                null;
        case 'Episode':
            return item.SeriesId
                && typeof item.ParentIndexNumber === 'number'
                && typeof item.IndexNumber === 'number' ?
                episodeKey(item.SeriesId, item.ParentIndexNumber, item.IndexNumber) :
                null;
        default:
            return null;
    }
}

/** Los favoritos del usuario en el servidor, ya como claves del store. */
export async function getFavoriteKeys(): Promise<string[]> {
    const items = await fetchUserItems<JFFavorite>(
        `Filters=IsFavorite&Recursive=true&IncludeItemTypes=${FAV_TYPES}&SortBy=SortName`
    );
    return items.map(favKeyOf).filter((k): k is string => !!k);
}

/**
 * Id con el que llamar al servidor para una clave del store.
 *
 * Películas y series lo llevan dentro de la clave. Temporadas y episodios no,
 * así que hay que sacarlo de la serie —que viene del caché de `getShow`, no de
 * una petición nueva, si la ficha está abierta—. Devuelve null si el item ya no
 * existe en la biblioteca.
 */
export async function favoriteServerId(key: string): Promise<string | null> {
    const direct = serverIdFromKey(key);
    if (direct) return direct;

    const ref = parseItemKey(key);
    if (ref.kind !== 'season' && ref.kind !== 'episode') return null;
    const show = await getShow(ref.showId);
    const season = show.seasons.find((s) => s.n === ref.seasonN);
    if (!season) return null;
    if (ref.kind === 'season') return season.jfId ?? null;
    return season.episodes.find((e) => e.n === ref.epN)?.jfId ?? null;
}

/**
 * Sube al servidor los favoritos que solo existían en este navegador, una
 * única vez.
 *
 * Hasta ahora el corazón no salía de localStorage, así que la primera
 * hidratación borraría de golpe todo lo marcado antes de esta versión: el
 * servidor no sabe nada de ello y manda. Este empujón lo adopta primero.
 *
 * Devuelve las claves que sí llegaron al servidor, para contarlas como
 * favoritas ya en esa primera pasada. Lo que falle —un item borrado de la
 * biblioteca, una serie que ya no está— se queda fuera y la hidratación lo
 * retira del store, que es exactamente lo que queremos.
 */
async function adoptLocalFavorites(remoteKeys: readonly string[]): Promise<string[]> {
    if (migrationDone()) return [];

    const remote = new Set(remoteKeys);
    const adopted: string[] = [];
    // En serie y no en paralelo: son los favoritos de un usuario, no un
    // listado, y resolver temporadas/episodios puede traerse la serie entera.
    for (const key of FAVS.all()) {
        if (remote.has(key)) continue;
        try {
            const serverId = await favoriteServerId(key);
            if (!serverId) continue;
            await toggleFavorite(serverId, true);
            adopted.push(key);
        } catch {
            // Ver arriba: lo que no se puede adoptar se pierde a propósito.
        }
    }

    markMigrationDone();
    return adopted;
}

/**
 * La hidratación en curso, si la hay. Al arrancar coinciden dos: la del
 * inicio de sesión y la de la pantalla de Favoritos, que se abre de inmediato
 * si es la ruta de entrada. Compartir la promesa evita repetir la petición y,
 * sobre todo, que la adopción de abajo corra dos veces en paralelo.
 */
let inFlight: Promise<void> | null = null;

/**
 * Trae los favoritos del servidor al store local. FAVS emite un único evento
 * si algo cambia, y ninguno si no, así que llamarla de más no repinta de más.
 */
export function hydrateFavorites(): Promise<void> {
    inFlight ??= pullFavorites().finally(() => { inFlight = null; });
    return inFlight;
}

async function pullFavorites(): Promise<void> {
    const remoteKeys = await getFavoriteKeys();
    const adopted = await adoptLocalFavorites(remoteKeys);
    const truth = [...new Set([...remoteKeys, ...adopted])];
    // El scope incluye lo que ya había en local: así lo que el servidor no
    // liste sale del store en vez de quedarse como un corazón fantasma.
    FAVS.sync([...FAVS.all(), ...truth], truth);
}

function migrationDone(): boolean {
    try {
        return localStorage.getItem(MIGRATED_KEY) === '1';
    } catch {
        // Sin localStorage tampoco hay favoritos viejos que adoptar.
        return true;
    }
}

function markMigrationDone(): void {
    try {
        localStorage.setItem(MIGRATED_KEY, '1');
    } catch {
        // Se reintentará en la próxima hidratación; adoptar dos veces lo
        // mismo es inofensivo (marcar un favorito ya marcado es un no-op).
    }
}
