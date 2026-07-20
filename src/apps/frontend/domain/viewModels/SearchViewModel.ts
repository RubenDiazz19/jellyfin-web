// ViewModel de la búsqueda: query + filtros como signals y resultados como
// computed. Toda la lógica de filtrado vive aquí; la View solo pinta.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { computed, signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie, type Show } from '../../data/models';
import { FAVS } from '../../data/stores/favsStore';
import { WATCHED } from '../../data/stores/watchedStore';

export type TypeFilter = 'todo' | 'series' | 'peliculas';
export type StateFilter = 'todo' | 'favs' | 'vistos' | 'no-vistos';

export type SearchResult =
    | (Show & { _type: 'show' })
    | (Movie & { _type: 'movie' });

function isSeriesWatched(show: Show): boolean {
    const ids = (show.seasons || []).flatMap((s) =>
        (s.episodes || []).map((e) => `${show.id}-s${s.n}-e${e.n}`)
    );
    return ids.length > 0 && ids.every((id) => WATCHED.has(id));
}

function isMovieWatched(movie: Movie): boolean {
    return (movie.watched ?? 0) >= 1 || WATCHED.has(`movie-${movie.id}`);
}

export class SearchViewModel {
    query = signal('');
    typeFilter = signal<TypeFilter>('todo');
    stateFilter = signal<StateFilter>('todo');

    /** Biblioteca real de Jellyfin (vacía sin sesión). */
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    loading = signal(false);

    // Los stores de favoritos/vistos notifican por eventos del DOM; estos
    // contadores los convierten en dependencias reactivas del computed.
    private favsVersion = signal(0);
    private watchedVersion = signal(0);

    private seq = 0;

    constructor(private api: ApiService) {}

    results = computed<SearchResult[]>(() => {
        // Lecturas intencionadas: registran los contadores como dependencias
        // del computed para re-filtrar cuando cambian favoritos/vistos.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.favsVersion.value;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.watchedVersion.value;

        const jf = this.shows.value.map((s) => ({ ...s, _type: 'show' as const }));
        const jfIds = new Set(jf.map((s) => s.id));
        const protoShows = Object.values(PROTO_DATA.shows)
            .filter((s) => !jfIds.has(s.id))
            .map((s) => ({ ...s, _type: 'show' as const }));
        const jfMovies = this.movies.value.map((m) => ({ ...m, _type: 'movie' as const }));
        const jfMovieIds = new Set(jfMovies.map((m) => m.id));
        const protoMovies = Object.values(PROTO_DATA.movies)
            .filter((m) => !jfMovieIds.has(m.id))
            .map((m) => ({ ...m, _type: 'movie' as const }));
        const all: SearchResult[] = [...jf, ...protoShows, ...jfMovies, ...protoMovies];

        const type = this.typeFilter.value;
        const state = this.stateFilter.value;
        const q = this.query.value.trim().toLowerCase();

        return all.filter((item) => {
            if (type === 'series' && item._type !== 'show') return false;
            if (type === 'peliculas' && item._type !== 'movie') return false;

            if (state !== 'todo') {
                const isFav = item._type === 'show' ?
                    FAVS.has(item.id) :
                    FAVS.has(`movie-${item.id}`);
                const isWatched = item._type === 'show' ?
                    isSeriesWatched(item) :
                    isMovieWatched(item);
                if (state === 'favs' && !isFav) return false;
                if (state === 'vistos' && !isWatched) return false;
                if (state === 'no-vistos' && isWatched) return false;
            }

            if (!q) return true;
            return (
                item.title?.toLowerCase().includes(q)
                || item.synopsis?.toLowerCase().includes(q)
                || item.genres?.some((g) => g.toLowerCase().includes(q))
                || item.cast?.some((c) => c.name?.toLowerCase().includes(q))
            );
        });
    });

    anyFilterActive = computed(() =>
        this.typeFilter.value !== 'todo'
        || this.stateFilter.value !== 'todo'
        || !!this.query.value.trim()
    );

    setQuery = (q: string) => { this.query.value = q; };
    setTypeFilter = (f: TypeFilter) => { this.typeFilter.value = f; };
    setStateFilter = (f: StateFilter) => { this.stateFilter.value = f; };
    clearQuery = () => { this.query.value = ''; };

    /** Carga la biblioteca real para buscar sobre ella (si hay sesión). */
    async load() {
        if (!this.api.session.load()?.accessToken) return;
        const seq = ++this.seq;
        this.loading.value = true;
        try {
            const [shows, movies] = await Promise.all([
                this.api.catalog.getShows(),
                this.api.catalog.getMovies().catch(() => [] as Movie[])
            ]);
            if (seq !== this.seq) return;
            this.shows.value = shows;
            this.movies.value = movies;
        } catch {
            if (seq !== this.seq) return;
            this.shows.value = [];
            this.movies.value = [];
        } finally {
            if (seq === this.seq) this.loading.value = false;
        }
    }

    /** Suscribe el VM a los eventos de favoritos/vistos. Devuelve cleanup. */
    start(): () => void {
        if (typeof window === 'undefined') return () => {};
        const bumpFavs = () => { this.favsVersion.value++; };
        const bumpWatched = () => { this.watchedVersion.value++; };
        window.addEventListener(FAVS.event, bumpFavs);
        window.addEventListener(WATCHED.event, bumpWatched);
        return () => {
            window.removeEventListener(FAVS.event, bumpFavs);
            window.removeEventListener(WATCHED.event, bumpWatched);
        };
    }
}

export const searchVM = new SearchViewModel(apiService);
