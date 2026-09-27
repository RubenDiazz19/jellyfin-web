// ViewModel de la búsqueda: query + filtros como signals y resultados como
// computed. Toda la lógica de filtrado vive aquí; la View solo pinta.
//
// Los resultados salen de dos sitios. El catálogo cargado se filtra en el
// navegador, que responde a cada tecla sin ir a la red; y en paralelo se le
// pregunta al servidor, que además de ignorar acentos y mayúsculas ve las
// bibliotecas que este frontend no lista. Lo que trae el servidor y no estaba
// cargado se añade al final.
//
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { computed, effect, signal, type Signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { ITEM_MUTATED_EVENT } from '../../data/api/mutations';
import { PROTO_DATA, type Movie, type Show, type ListEntry } from '../../data/models';
import { FAVS } from '../../data/stores/favsStore';
import { episodeKey } from '../../data/stores/itemKeys';
import { WATCHED } from '../../data/stores/watchedStore';
import type { SavedView } from '../../data/stores/viewsStore';
import type { SortKey } from '../../data/stores/librarySortStore';
import { MUTATION_DEBOUNCE_MS } from './utils/mutationSubscription';
import { registerTagSource } from './utils/knownTags';
import { guardedLoad } from './utils/guardedLoad';
import { LoadGuard } from './utils/loadGuard';
import { getItemGenres, type GenresItem } from '../genres';
import { runtimeMinutes } from '../utils/runtime';
import { isShowFullyWatched } from '../showWatched';
import { getItemTags, normalizeTagForSearch } from '../tags';
import { SearchViewManager } from './search/SearchViewManager';
import { RemoteSearchManager } from './search/RemoteSearchManager';
import { LocalSearchEngine, type LocalSearchState } from './search/LocalSearchEngine';
import { TagManager } from './search/TagManager';

import { parseQuery, normalizeSearchText } from './search/SearchQueryParser';
import { type FilterCriteria, matchesFilters, isMovieWatched } from './search/SearchFilters';

export type {
    FilterCategory,
    RatingFilter,
    RatingOperator,
    StateFilter,
    TypeFilter
} from './utils/searchViews';

const CATALOG_TTL_MS = 60_000;

/**
 * Un título del catálogo con la marca de qué es. `kind` y no `_type`: así el
 * resultado cumple `CatalogItem` tal cual y las tarjetas lo pintan sin
 * conocer este ViewModel.
 */
export type SearchResult =
    | (Show & { kind: 'show' })
    | (Movie & { kind: 'movie' })
    | (ListEntry & { kind: 'collection' });



import { SearchFilterState, type SearchSortKey } from './search/SearchFilterState';

export type { SearchSortKey };

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });





export class SearchViewModel {
    filters = new SearchFilterState();
    views = new SearchViewManager(this.filters, () => this.load());
    remoteManager: RemoteSearchManager;
    localEngine: LocalSearchEngine;
    tagManager: TagManager;

    get query() { return this.filters.query; }
    get sortKey() { return this.filters.sortKey; }
    get typeFilters() { return this.filters.typeFilters; }
    get stateFilters() { return this.filters.stateFilters; }
    get categoryMode() { return this.filters.categoryMode; }
    get categoryQuery() { return this.filters.categoryQuery; }
    get ratingFilters() { return this.filters.ratingFilters; }
    get tagFilters() { return this.filters.tagFilters; }
    get anyFilterActive() { return this.filters.anyFilterActive; }

    get overlayOpen() { return this.views.overlayOpen; }

    /** Biblioteca real de Jellyfin (vacía sin sesión). */
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    collections = signal<ListEntry[]>([]);
    loading = signal(false);

    get remote() { return this.remoteManager.remote; }
    get searching() { return this.remoteManager.searching; }

    // Los stores de favoritos/vistos notifican por eventos del DOM; estos
    // contadores los convierten en dependencias reactivas del computed.
    private favsVersion = signal(0);
    private watchedVersion = signal(0);

    private loads = new LoadGuard();

    constructor(private api: ApiService) {
        this.remoteManager = new RemoteSearchManager(api);
        this.localEngine = new LocalSearchEngine({
            shows: this.shows,
            movies: this.movies,
            collections: this.collections,
            filters: this.filters,
            remoteManager: this.remoteManager,
            favsVersion: this.favsVersion,
            watchedVersion: this.watchedVersion
        });
        this.tagManager = new TagManager(this.shows, this.movies, this.filters, this.results, (opts) => this.load(opts));
        registerTagSource(() => [...this.shows.peek(), ...this.movies.peek()]);
    }

    get knownCatalogIds() { return this.localEngine.knownCatalogIds; }
    get results() { return this.localEngine.results; }

    get allTags() { return this.tagManager.allTags; }
    get availableTags() { return this.tagManager.availableTags; }

    setQuery = this.filters.setQuery;
    setTypeFilter = this.filters.setTypeFilter;
    setStateFilter = this.filters.setStateFilter;
    toggleTypeFilter = this.filters.toggleTypeFilter;
    toggleStateFilter = this.filters.toggleStateFilter;
    hasTypeFilter = this.filters.hasTypeFilter;
    hasStateFilter = this.filters.hasStateFilter;

    setSort = this.filters.setSort;

    clearTypeFilters = this.filters.clearTypeFilters;
    clearStateFilters = this.filters.clearStateFilters;
    clearQuery = this.filters.clearQuery;

    openCategory = this.filters.openCategory;
    closeCategory = this.filters.closeCategory;
    toggleCategory = this.filters.toggleCategory;
    setCategoryQuery = this.filters.setCategoryQuery;

    /** True si esa etiqueta está entre los filtros activos. */
    hasTagFilter = this.filters.hasTagFilter;
    /** Añade o quita una etiqueta del filtro. */
    toggleTagFilter = this.filters.toggleTagFilter;
    clearTagFilters = this.filters.clearTagFilters;

    setRatingFilter = this.filters.setRatingFilter;
    addRatingFilter = this.filters.addRatingFilter;
    removeRatingFilter = this.filters.removeRatingFilter;
    clearRatingFilter = this.filters.clearRatingFilter;

    openOverlay = this.views.openOverlay;
    closeOverlay = this.views.closeOverlay;
    currentView = (name: string) => this.views.currentView(name);
    applyView = (view: SavedView) => this.views.applyView(view);

    private guarded = guardedLoad(this.loading, undefined, this.loads).guarded;
    private lastLoadedAt = 0;

    /** Carga la biblioteca real para buscar sobre ella (si hay sesión). */
    async load(opts: { force?: boolean } = {}) {
        if (!this.api.session.load()?.accessToken) return;
        const now = Date.now();
        if (!opts.force && (this.shows.value.length > 0 || this.movies.value.length > 0) && now - this.lastLoadedAt < CATALOG_TTL_MS) {
            return;
        }
        this.loading.value = true;
        await this.guarded(async (isLatest) => {
            const [shows, movies, collections] = await Promise.all([
                this.api.catalog.getShows(),
                this.api.catalog.getMovies().catch(() => [] as Movie[]),
                this.api.catalog.getCollections().catch(() => [] as ListEntry[])
            ]);
            if (!isLatest()) return;
            this.shows.value = shows;
            this.movies.value = movies;
            this.collections.value = collections;
            this.lastLoadedAt = Date.now();
        }, () => {
            this.shows.value = [];
            this.movies.value = [];
            this.collections.value = [];
            return false;
        });
    }



    private activeSubs = 0;
    private cleanupEvents: (() => void) | null = null;

    /** Suscribe el VM a favoritos/vistos y a las mutaciones. Devuelve cleanup. */
    start(): () => void {
        if (typeof window === 'undefined') return () => {};

        this.activeSubs++;

        if (this.activeSubs === 1) {
            const bumpFavs = () => { this.favsVersion.value++; };
            const bumpWatched = () => { this.watchedVersion.value++; };
            
            window.addEventListener(FAVS.event, bumpFavs);
            window.addEventListener(WATCHED.event, bumpWatched);
            window.addEventListener(ITEM_MUTATED_EVENT, this.tagManager.onMutated);
            this.remoteManager.startAutoSearch(this.filters.query);

            this.cleanupEvents = () => {
                window.removeEventListener(FAVS.event, bumpFavs);
                window.removeEventListener(WATCHED.event, bumpWatched);
                window.removeEventListener(ITEM_MUTATED_EVENT, this.tagManager.onMutated);
                this.remoteManager.cleanup();
                this.tagManager.cleanup();
            };
        }

        return () => {
            this.activeSubs--;
            if (this.activeSubs === 0 && this.cleanupEvents) {
                this.cleanupEvents();
                this.cleanupEvents = null;
            }
        };
    }
}

export const searchVM = new SearchViewModel(apiService);
