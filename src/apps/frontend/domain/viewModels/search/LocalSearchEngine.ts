import { computed, type Signal } from '@preact/signals-core';
import { PROTO_DATA, type Movie, type Show, type ListEntry } from '../../../data/models';
import { episodeKey } from '../../../data/stores/itemKeys';
import { getItemGenres, type GenresItem } from '../../genres';
import { runtimeMinutes } from '../../utils/runtime';
import { isShowFullyWatched } from '../../showWatched';
import { getItemTags, normalizeTagForSearch } from '../../tags';
import { parseQuery, normalizeSearchText } from './SearchQueryParser';
import { type FilterCriteria, matchesFilters, isMovieWatched } from './SearchFilters';
import type { SearchFilterState, SearchSortKey } from './SearchFilterState';
import type { RemoteSearchManager } from './RemoteSearchManager';
import type { SearchResult } from '../SearchViewModel'; // Assuming SearchResult stays in SearchViewModel for now, or I can extract it to models

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

type SortableItem = { year?: number; title?: string; name?: string; runtime?: string | number; imdb?: number };

function compareBy(key: SearchSortKey) {
    return (a: SortableItem, b: SortableItem): number => {
        const titleA = a.title || a.name || '';
        const titleB = b.title || b.name || '';
        switch (key) {
            case 'year': return (b.year || 0) - (a.year || 0) || COLLATOR.compare(titleA, titleB);
            case 'rating': return (b.imdb || 0) - (a.imdb || 0) || COLLATOR.compare(titleA, titleB);
            case 'runtime': return runtimeMinutes(a.runtime) - runtimeMinutes(b.runtime) || COLLATOR.compare(titleA, titleB);
            case 'title': return COLLATOR.compare(titleA, titleB);
            default: return 0; // relevance or random handled differently
        }
    };
}

type IndexedItem = {
    item: SearchResult;
    id: string;
    kind: 'show' | 'movie' | 'collection';
    normTitle: string;
    normOriginalTitle: string;
    normSynopsis: string;
    genres: string[];
    cast: string[];
    tags: string[];
    imdb: number;
    seriesEpisodeKeys?: string[];
};

/**
 * Evalúa la coincidencia de una consulta contra un item indexado.
 * Devuelve una puntuación de relevancia (>0 si coincide, 0 si no coincide).
 * Permite buscar indistintamente por título oficial localizado o por título original,
 * tolerando omisión de palabras conectoras (ej: "guerra galaxias" o "star wars").
 */
function calculateMatchScore(entry: IndexedItem, q: string, qWords: string[]): number {
    if (!q) return 1;

    // 1. Coincidencia exacta de la frase en título o título original
    if (entry.normTitle === q || (entry.normOriginalTitle && entry.normOriginalTitle === q)) {
        return 100;
    }

    // 2. Empieza por la frase de búsqueda
    if (entry.normTitle.startsWith(q) || (entry.normOriginalTitle && entry.normOriginalTitle.startsWith(q))) {
        return 80;
    }

    // 3. Contiene la frase completa de búsqueda en título o título original
    if (entry.normTitle.includes(q) || (entry.normOriginalTitle && entry.normOriginalTitle.includes(q))) {
        return 65;
    }

    // 4. Todas las palabras de la consulta están en el título o en el título original (ej: "guerra galaxias" o "star wars")
    const inTitle = qWords.every((w) => entry.normTitle.includes(w));
    const inOrig = entry.normOriginalTitle ? qWords.every((w) => entry.normOriginalTitle.includes(w)) : false;
    if (inTitle || inOrig) {
        return 50;
    }

    // 5. Palabras repartidas entre título, título original, géneros o reparto
    const inMetadata = qWords.every((w) =>
        entry.normTitle.includes(w)
        || (entry.normOriginalTitle && entry.normOriginalTitle.includes(w))
        || entry.genres.some((g) => g.includes(w))
        || entry.cast.some((c) => c.includes(w))
    );
    if (inMetadata) {
        return 30;
    }

    // 6. Coincidencia en la sinopsis
    if (entry.normSynopsis.includes(q) || (qWords.length > 0 && qWords.every((w) => entry.normSynopsis.includes(w)))) {
        return 10;
    }

    return 0;
}

export type LocalSearchState = {
    shows: Signal<Show[]>;
    movies: Signal<Movie[]>;
    collections: Signal<ListEntry[]>;
    filters: SearchFilterState;
    remoteManager: RemoteSearchManager;
    favsVersion: Signal<number>;
    watchedVersion: Signal<number>;
};

export class LocalSearchEngine {
    constructor(private state: LocalSearchState) {}

    /**
     * Índice pre-calculado del catálogo local.
     * Solo se recalcula cuando cambian `shows` o `movies`, de modo que teclear
     * o filtrar por etiquetas no genera ninguna asignación ni recorridos pesados.
     */
    private catalog = computed<IndexedItem[]>(() => {
        const jf = this.state.shows.value.map((s) => ({ ...s, kind: 'show' as const }));
        const jfIds = new Set(jf.map((s) => s.id));
        const protoShows = Object.values(PROTO_DATA.shows)
            .filter((s) => !jfIds.has(s.id))
            .map((s) => ({ ...s, kind: 'show' as const }));
        const jfMovies = this.state.movies.value.map((m) => ({ ...m, kind: 'movie' as const }));
        const jfMovieIds = new Set(jfMovies.map((m) => m.id));
        const protoMovies = Object.values(PROTO_DATA.movies)
            .filter((m) => !jfMovieIds.has(m.id))
            .map((m) => ({ ...m, kind: 'movie' as const }));
        const jfCollections = this.state.collections.value.map((c) => ({ ...c, kind: 'collection' as const }));
        const all: SearchResult[] = [...jf, ...protoShows, ...jfMovies, ...protoMovies, ...jfCollections];

        return all.map((item) => {
            const rawGenres = 'genres' in item ? getItemGenres(item) : [];
            const genres = [
                ...rawGenres.map((g) => normalizeTagForSearch(g)),
                ...rawGenres.map((g) => normalizeSearchText(g))
            ].filter(Boolean);
            const tags = 'tags' in item ? getItemTags(item).map((t) => normalizeTagForSearch(t)) : [];
            const seriesEpisodeKeys = item.kind === 'show' ?
                (item.seasons || []).flatMap((s) => (s.episodes || []).map((e) => episodeKey(item.id, s.n, e.n))) :
                undefined;

            return {
                item,
                id: item.id,
                kind: item.kind,
                normTitle: normalizeSearchText('title' in item ? item.title : item.name),
                normOriginalTitle: 'originalTitle' in item ? normalizeSearchText(item.originalTitle) : '',
                normSynopsis: 'synopsis' in item ? normalizeSearchText(item.synopsis) : '',
                genres,
                cast: ('cast' in item && item.cast ? item.cast : []).map((c) => normalizeSearchText(c.name)).filter(Boolean),
                tags,
                imdb: 'rating' in item ? (item.rating?.imdb ?? 0) : 0,
                seriesEpisodeKeys
            };
        });
    });

    knownCatalogIds = computed<Set<string>>(() => new Set(this.catalog.value.map((i) => i.id)));

    results = computed<SearchResult[]>(() => {
        // Lecturas intencionadas: registran los contadores como dependencias
        // del computed para re-filtrar cuando cambian favoritos/vistos.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.state.favsVersion.value;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.state.watchedVersion.value;

        const indexedCatalog = this.catalog.value;
        const types = this.state.filters.typeFilters.value;
        const states = this.state.filters.stateFilters.value;
        const { text: rawText, tags: queryTags } = parseQuery(this.state.filters.query.value);
        const normQ = normalizeSearchText(rawText);
        const qWords = normQ ? normQ.split(' ').filter(Boolean) : [];
        const requiredTags = [
            ...queryTags,
            ...this.state.filters.tagFilters.value.map((t) => t.toLowerCase())
        ];
        const rFilters = this.state.filters.ratingFilters.value;
        const criteria: FilterCriteria = {
            types,
            states,
            requiredTags,
            ratingFilters: rFilters
        };

        const localScored: { item: SearchResult; score: number }[] = [];
        for (const entry of indexedCatalog) {
            const matches = matchesFilters(
                entry,
                () => {
                    if (entry.kind === 'show') {
                        return isShowFullyWatched(entry.item as Show);
                    }
                    if (entry.kind === 'movie') {
                        return isMovieWatched(entry.item as Movie);
                    }
                    return false; // Collections no tienen estado de visto
                },
                criteria
            );
            if (!matches) continue;

            let score = 1;
            if (normQ) {
                score = calculateMatchScore(entry, normQ, qWords);
                if (score === 0) continue;
            }

            localScored.push({ item: entry.item, score });
        }

        const sortKeyValue = this.state.filters.sortKey.value;
        if (sortKeyValue === 'relevance' && normQ) {
            localScored.sort((a, b) => b.score - a.score);
        } else if (sortKeyValue !== 'relevance') {
            const cmp = compareBy(sortKeyValue);
            localScored.sort((a, b) => {
                const itemA = { ...a.item, title: 'title' in a.item ? a.item.title : a.item.name, imdb: 'rating' in a.item ? (a.item.rating?.imdb ?? 0) : 0 };
                const itemB = { ...b.item, title: 'title' in b.item ? b.item.title : b.item.name, imdb: 'rating' in b.item ? (b.item.rating?.imdb ?? 0) : 0 };
                return cmp(itemA, itemB);
            });
        }
        const local = localScored.map((l) => l.item);

        // Lo del servidor que no estuviera ya cargado, al final: son los
        // títulos que la búsqueda local no podía encontrar.
        const remoteItems = this.state.remoteManager.remote.value;
        if (remoteItems.length === 0) return local;

        const known = this.knownCatalogIds.value;
        const extra: SearchResult[] = [];
        for (const item of remoteItems) {
            if (known.has(item.id)) continue;

            const itemTags = 'tags' in item ? getItemTags(item).map((t) => t.toLowerCase()) : [];
            const itemGenres = 'genres' in item ? getItemGenres(item as GenresItem).map((t) => normalizeTagForSearch(t)) : [];
            const score = 'rating' in item ? (item.rating?.imdb ?? 0) : 0;
            const matches = matchesFilters(
                { kind: item.kind, id: item.id, tags: itemTags, genres: itemGenres, imdb: score },
                () => item.kind === 'show' ? isShowFullyWatched(item) : item.kind === 'movie' ? isMovieWatched(item) : false,
                criteria
            );
            if (!matches) continue;

            extra.push(item);
        }

        const combined = [...local, ...extra];
        if (sortKeyValue !== 'relevance') {
            const cmp = compareBy(sortKeyValue);
            combined.sort((a, b) => {
                const itemA = { ...a, title: 'title' in a ? a.title : a.name, imdb: 'rating' in a ? (a.rating?.imdb ?? 0) : 0 };
                const itemB = { ...b, title: 'title' in b ? b.title : b.name, imdb: 'rating' in b ? (b.rating?.imdb ?? 0) : 0 };
                return cmp(itemA, itemB);
            });
        }
        return combined;
    });
}
