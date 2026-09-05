import type { Season, Show } from '../data/models';
import { episodeKey } from '../data/stores/itemKeys';
import { WATCHED } from './stores';

/**
 * Devuelve todas las claves de episodios de una serie para comprobación en almacenes locales.
 */
export function getShowEpisodeKeys(show: Pick<Show, 'id' | 'seasons'> | null | undefined): string[] {
    if (!show || !show.seasons) return [];
    return show.seasons.flatMap((s) =>
        (s.episodes || []).map((ep) => episodeKey(show.id, s.n, ep.n))
    );
}

/**
 * Devuelve todas las claves de episodios de una temporada concreta.
 */
export function getSeasonEpisodeKeys(
    showId: string,
    season: Pick<Season, 'n' | 'episodes'> | null | undefined
): string[] {
    if (!season || !season.episodes) return [];
    return season.episodes.map((ep) => episodeKey(showId, season.n, ep.n));
}

/**
 * Comprueba si una serie está completamente vista.
 *
 * Si la serie tiene episodios cargados, exige que todos ellos estén en el almacén de vistos.
 * Si no tiene episodios cargados en memoria, comprueba directamente el identificador de la serie.
 */
export function isShowFullyWatched(
    show: Pick<Show, 'id' | 'seasons'> | null | undefined,
    watchedStore = WATCHED
): boolean {
    if (!show) return false;
    const epKeys = getShowEpisodeKeys(show);
    if (epKeys.length > 0) {
        return epKeys.every((id) => watchedStore.has(id));
    }
    return watchedStore.has(show.id);
}

/**
 * Comprueba si una temporada concreta está completamente vista.
 */
export function isSeasonFullyWatched(
    showId: string,
    season: Pick<Season, 'n' | 'episodes'> | null | undefined,
    watchedStore = WATCHED
): boolean {
    if (!season) return false;
    const epKeys = getSeasonEpisodeKeys(showId, season);
    return epKeys.length > 0 && epKeys.every((id) => watchedStore.has(id));
}
