import type { Movie, Show } from '../../../data/models';
import { FAVS } from '../../../data/stores/favsStore';
import { movieKey } from '../../../data/stores/itemKeys';
import { WATCHED } from '../../../data/stores/watchedStore';
import type { RatingFilter, StateFilter, TypeFilter } from '../utils/searchViews';

export type FilterCriteria = {
    types: readonly TypeFilter[];
    states: readonly StateFilter[];
    requiredTags: readonly string[];
    ratingFilters: readonly RatingFilter[];
};

export function isMovieWatched(movie: Movie): boolean {
    return (movie.watched ?? 0) >= 1 || WATCHED.has(movieKey(movie.id));
}

export function matchesRating(score: number, filters: readonly RatingFilter[]): boolean {
    for (const rf of filters) {
        switch (rf.operator) {
            case '>=': if (score < rf.value) return false; break;
            case '>': if (score <= rf.value) return false; break;
            case '<=': if (score > rf.value) return false; break;
            case '<': if (score >= rf.value) return false; break;
            case '=': if (Math.abs(score - rf.value) >= 0.05) return false; break;
        }
    }
    return true;
}

export function matchesState(
    kind: 'show' | 'movie' | 'collection',
    id: string,
    isWatched: boolean,
    states: readonly StateFilter[]
): boolean {
    const isFav = (kind === 'show' || kind === 'collection') ? FAVS.has(id) : FAVS.has(movieKey(id));
    if (states.includes('favs') && !isFav) return false;
    if (states.includes('vistos') && !states.includes('no-vistos') && !isWatched) return false;
    if (states.includes('no-vistos') && !states.includes('vistos') && isWatched) return false;
    return true;
}

/**
 * Comprueba si un elemento cumple con los criterios de filtrado seleccionados.
 */
export function matchesFilters(
    item: {
        kind: 'show' | 'movie' | 'collection';
        id: string;
        tags: readonly string[];
        genres?: readonly string[];
        imdb: number;
    },
    isWatched: () => boolean,
    criteria: FilterCriteria
): boolean {
    if (criteria.types.length > 0) {
        const matchesType = (criteria.types.includes('series') && item.kind === 'show')
            || (criteria.types.includes('peliculas') && item.kind === 'movie')
            || (criteria.types.includes('colecciones') && item.kind === 'collection');
        if (!matchesType) return false;
    }

    if (criteria.requiredTags.length > 0) {
        if (!criteria.requiredTags.every((t) => item.tags.includes(t) || item.genres?.includes(t))) return false;
    }

    if (criteria.states.length > 0) {
        if (!matchesState(item.kind, item.id, isWatched(), criteria.states)) return false;
    }

    return criteria.ratingFilters.length === 0 || matchesRating(item.imdb, criteria.ratingFilters);
}
