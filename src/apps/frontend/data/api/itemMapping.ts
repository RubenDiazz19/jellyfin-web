// Piezas compartidas al traducir un JFItem del servidor a los modelos de
// dominio. Series, películas y los slides de la Home describen cosas
// distintas, pero las sacan de los mismos campos y con los mismos criterios
// (tamaños de imagen, qué cuenta como "visto", cómo se formatea el
// runtime). Tenerlas aquí evita que las tres copias se separen: cuando el
// póster de la ficha pasó a pedirse con `tag`, el de la Home se quedó atrás
// y seguía sirviendo la carátula vieja desde la caché del navegador.

import type { CastMember, Rating } from '../models';
import { imageUrl } from './images';
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

export function ratingOf(item: JFItem): Rating {
    return {
        imdb: item.CommunityRating ?? 0,
        // El servidor no expone Rotten Tomatoes; el modelo lo reserva.
        rt: 0,
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
