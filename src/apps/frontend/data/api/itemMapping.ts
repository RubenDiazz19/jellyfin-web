// Piezas compartidas al traducir un JFItem del servidor a los modelos de
// dominio. Series, películas y los slides de la Home describen cosas
// distintas, pero las sacan de los mismos campos y con los mismos criterios
// (tamaños de imagen, qué cuenta como "visto", cómo se formatea el
// runtime). Tenerlas aquí evita que las tres copias se separen: cuando el
// póster de la ficha pasó a pedirse con `tag`, el de la Home se quedó atrás
// y seguía sirviendo la carátula vieja desde la caché del navegador.

import { autoTagsFor } from '../autotag';
import type { CastMember, Movie, Rating, Show } from '../models';
import { imageUrl, type ImageType } from './images';
import { ticksToMinutes, type JFItem } from './types';

/** Ancho al que se piden los fondos del hero. */
const BACKDROP_WIDTH = 2560;
/** Alto al que se piden las carátulas. */
const POSTER_HEIGHT = 900;
const LOGO_HEIGHT = 400;
const CAST_PHOTO_HEIGHT = 320;
/** Reparto que llega a pintarse en la ficha. */
const CAST_LIMIT = 14;

export function mapCast(item: JFItem): CastMember[] {
    return (item.People ?? [])
        .filter((p) => p.Type === 'Actor')
        .slice(0, CAST_LIMIT)
        .map((p) => ({
            name: p.Name,
            role: p.Role || '',
            photo: p.PrimaryImageTag && p.Id ?
                imageUrl(p.Id, 'Primary', { tag: p.PrimaryImageTag, maxHeight: CAST_PHOTO_HEIGHT }) :
                null
        }));
}

// El tag es el etag de esa imagen concreta: sin él, cambiar el póster en el
// editor no invalida la caché del navegador porque la URL sigue siendo la
// misma. Vale para las tres URLs de abajo.

/** Carátula del item, o '' si no tiene. */
export function posterUrl(itemId: string | undefined, tag?: string): string {
    return imageUrl(itemId, 'Primary', { tag, maxHeight: POSTER_HEIGHT }) ?? '';
}

/**
 * Logo del item, o null si no tiene — la View cae entonces al título en
 * texto. Sin `tag` se devuelve null en vez de una URL sin etag: esa URL no
 * se invalidaría nunca en la caché del navegador, y un item sin tag de logo
 * es justamente un item sin logo.
 */
export function logoUrl(itemId: string | undefined, tag?: string): string | null {
    if (!itemId || !tag) return null;
    return imageUrl(itemId, 'Logo', { tag, maxHeight: LOGO_HEIGHT }) ?? null;
}

/** Todos los fondos del item, en orden, listos para rotar en el hero. */
export function backdropUrls(itemId: string | undefined, tags: string[] | undefined): string[] {
    return (tags ?? [])
        .map((tag, i) => imageUrl(itemId, 'Backdrop', { tag, maxWidth: BACKDROP_WIDTH, index: i }))
        .filter((u): u is string => !!u);
}

/** Un sitio de donde puede salir una imagen: tipo, item que la tiene y su tag. */
export type ImageSource = [ImageType, string | undefined, string | undefined];

/**
 * La primera imagen que exista, probando los candidatos en orden.
 *
 * Un episodio casi nunca tiene fondo propio y lo hereda de su serie, y una
 * carátula puede venir del item o de su padre: sin este encadenado las
 * rejillas quedan con huecos grises. Un candidato sin id o sin tag se salta —
 * una URL sin etag no se invalidaría nunca en la caché del navegador.
 */
export function firstImageUrl(
    sources: readonly ImageSource[],
    opts: { maxWidth?: number; maxHeight?: number }
): string | undefined {
    for (const [type, itemId, tag] of sources) {
        if (!itemId || !tag) continue;
        const url = imageUrl(itemId, type, { tag, ...opts });
        if (url) return url;
    }
    return undefined;
}

export function ratingOf(item: JFItem): Rating {
    return {
        imdb: item.CommunityRating ?? 0,
        age: item.OfficialRating ?? 'N/A'
    };
}

/** Runtime ya formateado para la ficha; '—' cuando el servidor no lo sabe. */
export function runtimeLabel(item: JFItem): string {
    const minutes = ticksToMinutes(item.RunTimeTicks);
    return minutes ? `${minutes} min` : '—';
}

/**
 * Progreso de visionado en 0..1. `Played` gana sobre el porcentaje: un item
 * marcado como visto a mano no trae PlayedPercentage y se quedaría en 0.
 */
export function watchedFraction(item: JFItem): number {
    if (item.UserData?.Played) return 1;
    const pct = item.UserData?.PlayedPercentage;
    return pct != null ? pct / 100 : 0;
}

/**
 * Lo que Show y Movie sacan igual del mismo JFItem: ficha, imágenes y
 * etiquetas. Lo propio de cada uno (temporadas, director, progreso) lo pone
 * su mapper encima.
 */
export type CommonItemFields = Pick<
    Show & Movie,
    'id' | 'title' | 'year' | 'runtime' | 'rating' | 'genres' | 'tags' | 'autoTags'
    | 'studio' | 'country' | 'premiere' | 'cast' | 'synopsis'
    | 'backdrop' | 'backdrops' | 'poster' | 'logo'
>;

export function mapCommonFields(item: JFItem): CommonItemFields {
    const backdrops = backdropUrls(item.Id, item.BackdropImageTags);
    return {
        id: item.Id,
        title: item.Name,
        year: item.ProductionYear ?? 0,
        runtime: runtimeLabel(item),
        rating: ratingOf(item),
        genres: item.Genres ?? [],
        tags: item.Tags ?? [],
        autoTags: autoTagsFor(item.Id),
        studio: (item.Studios ?? []).map((s) => s.Name).filter(Boolean).join(', '),
        country: (item.ProductionLocations ?? []).filter(Boolean).join(', '),
        premiere: item.PremiereDate ?? '',
        cast: mapCast(item),
        synopsis: item.Overview ?? '',
        backdrop: backdrops[0] ?? '',
        backdrops,
        poster: posterUrl(item.Id, item.ImageTags?.Primary),
        logo: logoUrl(item.Id, item.ImageTags?.Logo)
    };
}
