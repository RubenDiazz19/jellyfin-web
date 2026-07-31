// ViewModel de la búsqueda: query + filtros como signals y resultados como
// computed. Toda la lógica de filtrado vive aquí; la View solo pinta.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { computed, signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { ITEM_MUTATED_EVENT } from '../../data/api/mutations';
import { PROTO_DATA, type Movie, type Show } from '../../data/models';
import { FAVS } from '../../data/stores/favsStore';
import { MANUAL_TAGS } from '../../data/stores/manualTagsStore';
import { WATCHED } from '../../data/stores/watchedStore';
import type { SavedView } from '../../data/stores/viewsStore';

export type TypeFilter = 'todo' | 'series' | 'peliculas';
export type StateFilter = 'todo' | 'favs' | 'vistos' | 'no-vistos';

const TYPE_FILTERS: readonly string[] = ['todo', 'series', 'peliculas'];
const STATE_FILTERS: readonly string[] = ['todo', 'favs', 'vistos', 'no-vistos'];

function isTypeFilter(v: string): v is TypeFilter {
    return TYPE_FILTERS.includes(v);
}
function isStateFilter(v: string): v is StateFilter {
    return STATE_FILTERS.includes(v);
}

/** Sin filtro de etiqueta. Vacío en vez de null para que case con los chips. */
export const NO_TAG = '';

export type SearchResult =
    | (Show & { _type: 'show' })
    | (Movie & { _type: 'movie' });

/**
 * Separa los `#tag` del texto libre.
 *
 * Escribir `#anime cine` busca «cine» entre lo etiquetado como anime. Un `#`
 * suelto o a medio escribir no filtra nada todavía: si no, al teclear la
 * almohadilla la lista se vaciaba de golpe.
 */
export function parseQuery(raw: string): { text: string; tags: string[] } {
    const tags: string[] = [];
    const words: string[] = [];
    for (const word of raw.trim().split(/\s+/)) {
        if (!word) continue;
        if (word.startsWith('#')) {
            // Una almohadilla sola se descarta del todo: como etiqueta aún no
            // dice nada, y dejarla caer al texto libre buscaría «#» literal y
            // vaciaría la lista mientras se teclea.
            if (word.length > 1) tags.push(word.slice(1).toLowerCase());
            continue;
        }
        words.push(word);
    }
    return { text: words.join(' ').toLowerCase(), tags };
}

/**
 * Todas las etiquetas por las que se puede filtrar un item: las del servidor
 * (donde conviven los keywords de TMDB y lo que ha escrito el usuario) más las
 * automáticas del vocabulario. La búsqueda mira las dos fuentes aunque la fila
 * de chips solo enseñe unas pocas: escribir `#slasher` tiene que encontrar
 * tanto lo etiquetado a mano como lo que dedujo el script.
 */
function tagsOf(item: SearchResult): string[] {
    return [...(item.tags ?? []), ...(item.autoTags ?? [])];
}

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
    /** Etiqueta elegida en la fila de chips. NO_TAG = sin filtro. */
    tagFilter = signal<string>(NO_TAG);

    /** Biblioteca real de Jellyfin (vacía sin sesión). */
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    loading = signal(false);

    // Los stores de favoritos/vistos notifican por eventos del DOM; estos
    // contadores los convierten en dependencias reactivas del computed.
    private favsVersion = signal(0);
    private watchedVersion = signal(0);
    // Las etiquetas viven en el servidor, así que no basta con re-filtrar:
    // hay que volver a traer la biblioteca para verlas.
    private mutationVersion = signal(0);

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
        const { text: q, tags: queryTags } = parseQuery(this.query.value);
        // La etiqueta del chip y las que se escriban con `#` se acumulan: hay
        // que llevarlas todas para aparecer en los resultados.
        const chipTag = this.tagFilter.value;
        const requiredTags = chipTag ? [...queryTags, chipTag.toLowerCase()] : queryTags;

        return all.filter((item) => {
            if (type === 'series' && item._type !== 'show') return false;
            if (type === 'peliculas' && item._type !== 'movie') return false;

            if (requiredTags.length > 0) {
                const own = tagsOf(item).map((t) => t.toLowerCase());
                if (!requiredTags.every((t) => own.includes(t))) return false;
            }

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

    /**
     * Las etiquetas que se pintan como chips. NO son todas las del item: de
     * `tags` solo pasan las que el usuario haya escrito a mano, porque ahí
     * dentro vienen también los cientos de keywords de TMDB —«adventurer»,
     * «aftercreditsstinger», «blind girl»— que como filtro no sirven de nada:
     * casan con uno o dos items y convierten la fila en una tira infinita.
     *
     * Lo que se descarta aquí sigue siendo buscable escribiendo `#keyword`.
     * Se agrupan ignorando mayúsculas y se enseña la primera grafía vista.
     */
    allTags = computed<string[]>(() => {
        // Depende de las mutaciones: al etiquetar un item, la lista de chips
        // tiene que incluir la etiqueta nueva.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.mutationVersion.value;
        const seen = new Map<string, string>();
        for (const item of [...this.shows.value, ...this.movies.value]) {
            for (const tag of item.autoTags ?? []) {
                const key = tag.toLowerCase();
                if (!seen.has(key)) seen.set(key, tag);
            }
            for (const tag of item.tags ?? []) {
                const key = tag.toLowerCase();
                if (!seen.has(key) && MANUAL_TAGS.has(tag)) seen.set(key, tag);
            }
        }
        return [...seen.values()].sort((a, b) => a.localeCompare(b));
    });

    anyFilterActive = computed(() =>
        this.typeFilter.value !== 'todo'
        || this.stateFilter.value !== 'todo'
        || this.tagFilter.value !== NO_TAG
        || !!this.query.value.trim()
    );

    setQuery = (q: string) => { this.query.value = q; };
    setTypeFilter = (f: TypeFilter) => { this.typeFilter.value = f; };
    setStateFilter = (f: StateFilter) => { this.stateFilter.value = f; };
    setTagFilter = (t: string) => { this.tagFilter.value = t; };
    clearQuery = () => { this.query.value = ''; };

    /** Los filtros actuales, listos para guardarlos como vista. */
    currentView(name: string): Omit<SavedView, 'id'> {
        return {
            name,
            typeFilter: this.typeFilter.value,
            stateFilter: this.stateFilter.value,
            tag: this.tagFilter.value || undefined,
            query: this.query.value.trim() || undefined
        };
    }

    /**
     * Aplica una vista guardada. Los filtros se validan contra los valores
     * que el VM entiende: una vista vieja puede apuntar a un filtro que ya no
     * existe, y aplicarla a ciegas dejaría la búsqueda en un estado imposible.
     */
    applyView(view: SavedView) {
        this.typeFilter.value = isTypeFilter(view.typeFilter) ? view.typeFilter : 'todo';
        this.stateFilter.value = isStateFilter(view.stateFilter) ? view.stateFilter : 'todo';
        this.tagFilter.value = view.tag ?? NO_TAG;
        this.query.value = view.query ?? '';
    }

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

    /** Suscribe el VM a favoritos/vistos y a las mutaciones. Devuelve cleanup. */
    start(): () => void {
        if (typeof window === 'undefined') return () => {};
        const bumpFavs = () => { this.favsVersion.value++; };
        const bumpWatched = () => { this.watchedVersion.value++; };
        const onMutated = () => {
            this.mutationVersion.value++;
            // Refetch, no solo re-filtrado: una etiqueta nueva no está en los
            // datos que ya tenemos en memoria.
            void this.load();
        };
        window.addEventListener(FAVS.event, bumpFavs);
        window.addEventListener(WATCHED.event, bumpWatched);
        window.addEventListener(ITEM_MUTATED_EVENT, onMutated);
        return () => {
            window.removeEventListener(FAVS.event, bumpFavs);
            window.removeEventListener(WATCHED.event, bumpWatched);
            window.removeEventListener(ITEM_MUTATED_EVENT, onMutated);
        };
    }
}

export const searchVM = new SearchViewModel(apiService);
