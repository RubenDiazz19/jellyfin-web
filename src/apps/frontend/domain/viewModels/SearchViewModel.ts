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

import { computed, effect, signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { ITEM_MUTATED_EVENT } from '../../data/api/mutations';
import { PROTO_DATA, type Movie, type Show } from '../../data/models';
import { FAVS } from '../../data/stores/favsStore';
import { episodeKey, movieKey } from '../../data/stores/itemKeys';
import { MANUAL_TAGS } from '../../data/stores/manualTagsStore';
import { WATCHED } from '../../data/stores/watchedStore';
import type { RatingOperator, SavedView } from '../../data/stores/viewsStore';
import { MUTATION_DEBOUNCE_MS } from './itemMutations';
import { registerTagSource } from './knownTags';
import { LoadGuard } from './loadGuard';
import { translateGenre } from '../genres';

export type { RatingOperator };
export type TypeFilter = 'todo' | 'series' | 'peliculas';
export type StateFilter = 'todo' | 'favs' | 'vistos' | 'no-vistos';
export type FilterCategory = 'tipo' | 'estado' | 'generos' | 'valoracion';
export type RatingFilter = { operator: RatingOperator; value: number };

const TYPE_FILTERS: readonly string[] = ['todo', 'series', 'peliculas'];
const STATE_FILTERS: readonly string[] = ['todo', 'favs', 'vistos', 'no-vistos'];

function isTypeFilter(v: string): v is TypeFilter {
    return TYPE_FILTERS.includes(v);
}
function isStateFilter(v: string): v is StateFilter {
    return STATE_FILTERS.includes(v);
}

/**
 * Un título del catálogo con la marca de qué es. `kind` y no `_type`: así el
 * resultado cumple `CatalogItem` tal cual y las tarjetas lo pintan sin
 * conocer este ViewModel.
 */
export type SearchResult =
    | (Show & { kind: 'show' })
    | (Movie & { kind: 'movie' });

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
    const translatedGenres = (item.genres ?? []).map((g) => translateGenre(g));
    return [...(item.tags ?? []), ...(item.autoTags ?? []), ...translatedGenres];
}

function isSeriesWatched(show: Show): boolean {
    const ids = (show.seasons || []).flatMap((s) =>
        (s.episodes || []).map((e) => episodeKey(show.id, s.n, e.n))
    );
    return ids.length > 0 && ids.every((id) => WATCHED.has(id));
}

function isMovieWatched(movie: Movie): boolean {
    return (movie.watched ?? 0) >= 1 || WATCHED.has(movieKey(movie.id));
}

function matchesRating(score: number, filters: readonly RatingFilter[]): boolean {
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

function matchesState(
    kind: 'show' | 'movie',
    id: string,
    isWatched: boolean,
    states: readonly StateFilter[]
): boolean {
    const isFav = kind === 'show' ? FAVS.has(id) : FAVS.has(movieKey(id));
    if (states.includes('favs') && !isFav) return false;
    if (states.includes('vistos') && !states.includes('no-vistos') && !isWatched) return false;
    if (states.includes('no-vistos') && !states.includes('vistos') && isWatched) return false;
    return true;
}

/**
 * A partir de cuántas letras se le pregunta al servidor. Con una sola el
 * ranking no dice nada y la petición se dispararía en cuanto se toca el campo.
 */
const MIN_REMOTE_QUERY = 2;

/**
 * Espera antes de salir a la red. Se teclea letra a letra: sin esto, escribir
 * «expediente» son diez búsquedas y solo importa la última.
 */
const REMOTE_DEBOUNCE_MS = 400;

type IndexedItem = {
    item: SearchResult;
    id: string;
    kind: 'show' | 'movie';
    lowerTitle: string;
    lowerSynopsis: string;
    genres: string[];
    cast: string[];
    tags: string[];
    imdb: number;
    seriesEpisodeKeys?: string[];
};

export class SearchViewModel {
    query = signal('');
    typeFilters = signal<TypeFilter[]>([]);
    stateFilters = signal<StateFilter[]>([]);
    /**
     * Categoría padre activa cuando se despliega su submenú horizontal.
     * Si no es null, el buscador principal pasa a buscar en las subcategorías.
     */
    categoryMode = signal<FilterCategory | null>(null);
    categoryQuery = signal<string>('');
    ratingFilters = signal<RatingFilter[]>([]);
    ratingFilter = computed<RatingFilter | null>(() => this.ratingFilters.value[0] ?? null);
    /**
     * Etiquetas elegidas en la fila de chips. Se acumulan en Y: pulsar
     * «Anime» y «Instituto» deja lo que tenga las dos, no la unión. Es lo que
     * hace útil un vocabulario con géneros y matices a la vez — el género
     * acota y el matiz afina.
     */
    tagFilters = signal<string[]>([]);

    /** Acceso y compatibilidad con TypeFilter / StateFilter unitario */
    typeFilter = computed<TypeFilter>(() => {
        if (this.typeFilters.value.length === 1) {
            return this.typeFilters.value[0] as TypeFilter;
        }
        return 'todo';
    });

    stateFilter = computed<StateFilter>(() => {
        if (this.stateFilters.value.length === 1) {
            return this.stateFilters.value[0] as StateFilter;
        }
        return 'todo';
    });

    /**
     * La búsqueda como superposición sobre la página actual, que es lo que
     * abre la lupa de la barra. Vive aquí y no en la vista porque `/search`
     * y la superposición comparten VM: al abrir una hay que saber si la otra
     * ya tenía filtros puestos.
     */
    overlayOpen = signal(false);

    /** Biblioteca real de Jellyfin (vacía sin sesión). */
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    loading = signal(false);

    /**
     * Lo que ha encontrado el buscador del servidor para el texto actual. Se
     * guarda aparte de la biblioteca cargada porque no se filtra igual: el
     * servidor ya ha decidido que casan con el texto, y volver a comprobarlo
     * aquí descartaría justo lo que él encuentra mejor que nosotros —«senyor»
     * contra «Señor»—.
     */
    remote = signal<SearchResult[]>([]);
    /** true mientras el servidor contesta a la búsqueda actual. */
    searching = signal(false);

    // Los stores de favoritos/vistos notifican por eventos del DOM; estos
    // contadores los convierten en dependencias reactivas del computed.
    private favsVersion = signal(0);
    private watchedVersion = signal(0);
    // Las etiquetas viven en el servidor, así que no basta con re-filtrar:
    // hay que volver a traer la biblioteca para verlas.
    private mutationVersion = signal(0);

    private loads = new LoadGuard();
    private remoteLoads = new LoadGuard();
    private remoteTimer: ReturnType<typeof setTimeout> | null = null;
    private mutationTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private api: ApiService) {
        registerTagSource(() => [...this.shows.peek(), ...this.movies.peek()]);
    }

    /**
     * Índice pre-calculado del catálogo local.
     * Solo se recalcula cuando cambian `shows` o `movies`, de modo que teclear
     * o filtrar por etiquetas no genera ninguna asignación ni recorridos pesados.
     */
    private catalog = computed<IndexedItem[]>(() => {
        const jf = this.shows.value.map((s) => ({ ...s, kind: 'show' as const }));
        const jfIds = new Set(jf.map((s) => s.id));
        const protoShows = Object.values(PROTO_DATA.shows)
            .filter((s) => !jfIds.has(s.id))
            .map((s) => ({ ...s, kind: 'show' as const }));
        const jfMovies = this.movies.value.map((m) => ({ ...m, kind: 'movie' as const }));
        const jfMovieIds = new Set(jfMovies.map((m) => m.id));
        const protoMovies = Object.values(PROTO_DATA.movies)
            .filter((m) => !jfMovieIds.has(m.id))
            .map((m) => ({ ...m, kind: 'movie' as const }));
        const all: SearchResult[] = [...jf, ...protoShows, ...jfMovies, ...protoMovies];

        return all.map((item) => {
            const rawGenres = item.genres ?? [];
            const translatedGenres = rawGenres.map((g) => {
                const tr = translateGenre(g);
                return (tr || g).toLowerCase();
            });
            const ownTags = [
                ...(item.tags ?? []).map((t) => t.toLowerCase()),
                ...(item.autoTags ?? []).map((t) => t.toLowerCase()),
                ...translatedGenres
            ];
            const seriesEpisodeKeys = item.kind === 'show' ?
                (item.seasons || []).flatMap((s) => (s.episodes || []).map((e) => episodeKey(item.id, s.n, e.n))) :
                undefined;

            return {
                item,
                id: item.id,
                kind: item.kind,
                lowerTitle: (item.title ?? '').toLowerCase(),
                lowerSynopsis: (item.synopsis ?? '').toLowerCase(),
                genres: translatedGenres,
                cast: (item.cast ?? []).map((c) => (c.name ?? '').toLowerCase()),
                tags: ownTags,
                imdb: item.rating?.imdb ?? 0,
                seriesEpisodeKeys
            };
        });
    });

    knownCatalogIds = computed<Set<string>>(() => new Set(this.catalog.value.map((i) => i.id)));

    results = computed<SearchResult[]>(() => {
        // Lecturas intencionadas: registran los contadores como dependencias
        // del computed para re-filtrar cuando cambian favoritos/vistos.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.favsVersion.value;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.watchedVersion.value;

        const indexedCatalog = this.catalog.value;
        const types = this.typeFilters.value;
        const states = this.stateFilters.value;
        const { text: q, tags: queryTags } = parseQuery(this.query.value);
        const requiredTags = [
            ...queryTags,
            ...this.tagFilters.value.map((t) => t.toLowerCase())
        ];
        const rFilters = this.ratingFilters.value;
        const hasTypes = types.length > 0;
        const hasTags = requiredTags.length > 0;
        const hasStates = states.length > 0;
        const hasRatings = rFilters.length > 0;

        const local: SearchResult[] = [];
        for (const entry of indexedCatalog) {
            if (hasTypes) {
                const matchesType = (types.includes('series') && entry.kind === 'show')
                    || (types.includes('peliculas') && entry.kind === 'movie');
                if (!matchesType) continue;
            }

            if (hasTags) {
                const allMatch = requiredTags.every((t) => entry.tags.includes(t));
                if (!allMatch) continue;
            }

            if (hasStates) {
                const isWatched = entry.kind === 'show' ?
                    !!entry.seriesEpisodeKeys && entry.seriesEpisodeKeys.length > 0 && entry.seriesEpisodeKeys.every((k) => WATCHED.has(k)) :
                    ((entry.item.watched ?? 0) >= 1 || WATCHED.has(movieKey(entry.id)));
                if (!matchesState(entry.kind, entry.id, isWatched, states)) continue;
            }

            if (hasRatings && !matchesRating(entry.imdb, rFilters)) {
                continue;
            }

            if (q) {
                const textMatch = entry.lowerTitle.includes(q)
                    || entry.lowerSynopsis.includes(q)
                    || entry.genres.some((g) => g.includes(q))
                    || entry.cast.some((c) => c.includes(q));
                if (!textMatch) continue;
            }

            local.push(entry.item);
        }

        // Lo del servidor que no estuviera ya cargado, al final: son los
        // títulos que la búsqueda local no podía encontrar.
        const remoteItems = this.remote.value;
        if (remoteItems.length === 0) return local;

        const known = this.knownCatalogIds.value;
        const extra: SearchResult[] = [];
        for (const item of remoteItems) {
            if (known.has(item.id)) continue;

            if (hasTypes) {
                const matchesType = (types.includes('series') && item.kind === 'show')
                    || (types.includes('peliculas') && item.kind === 'movie');
                if (!matchesType) continue;
            }

            if (hasTags) {
                const itemTags = tagsOf(item).map((t) => t.toLowerCase());
                if (!requiredTags.every((t) => itemTags.includes(t))) continue;
            }

            if (hasStates) {
                const isWatched = item.kind === 'show' ?
                    isSeriesWatched(item) :
                    isMovieWatched(item);
                if (!matchesState(item.kind, item.id, isWatched, states)) continue;
            }

            if (hasRatings) {
                const score = item.rating?.imdb ?? 0;
                if (!matchesRating(score, rFilters)) continue;
            }

            extra.push(item);
        }

        return [...local, ...extra];
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
            for (const g of item.genres ?? []) {
                const translated = translateGenre(g);
                if (translated) {
                    const key = translated.toLowerCase();
                    if (!seen.has(key)) seen.set(key, translated);
                }
            }
        }
        return [...seen.values()].sort((a, b) => a.localeCompare(b));
    });

    anyFilterActive = computed(() =>
        this.typeFilters.value.length > 0
        || this.stateFilters.value.length > 0
        || this.tagFilters.value.length > 0
        || this.ratingFilters.value.length > 0
        || !!this.query.value.trim()
    );

    setQuery = (q: string) => { this.query.value = q; };
    setTypeFilter = (f: TypeFilter) => {
        this.typeFilters.value = (f === 'todo' || !f) ? [] : [f];
    };
    setStateFilter = (f: StateFilter) => {
        this.stateFilters.value = (f === 'todo' || !f) ? [] : [f];
    };
    toggleTypeFilter = (t: TypeFilter) => {
        const current = this.typeFilters.value;
        this.typeFilters.value = current.includes(t) ?
            current.filter((x) => x !== t) :
            [...current, t];
    };
    toggleStateFilter = (s: StateFilter) => {
        const current = this.stateFilters.value;
        this.stateFilters.value = current.includes(s) ?
            current.filter((x) => x !== s) :
            [...current, s];
    };
    hasTypeFilter = (t: TypeFilter): boolean => this.typeFilters.value.includes(t);
    hasStateFilter = (s: StateFilter): boolean => this.stateFilters.value.includes(s);

    clearTypeFilters = () => { this.typeFilters.value = []; };
    clearStateFilters = () => { this.stateFilters.value = []; };
    clearQuery = () => { this.query.value = ''; };

    openCategory = (cat: FilterCategory) => {
        this.categoryMode.value = cat;
        this.categoryQuery.value = '';
    };

    closeCategory = () => {
        this.categoryMode.value = null;
        this.categoryQuery.value = '';
    };

    toggleCategory = (cat: FilterCategory) => {
        if (this.categoryMode.value === cat) {
            this.closeCategory();
        } else {
            this.openCategory(cat);
        }
    };

    setCategoryQuery = (q: string) => {
        this.categoryQuery.value = q;
    };

    /** True si esa etiqueta está entre los filtros activos. */
    hasTagFilter = (tag: string): boolean =>
        this.tagFilters.value.some((t) => t.toLowerCase() === tag.toLowerCase());

    /** Añade o quita una etiqueta del filtro. */
    toggleTagFilter = (tag: string) => {
        const key = tag.toLowerCase();
        const current = this.tagFilters.value;
        this.tagFilters.value = current.some((t) => t.toLowerCase() === key) ?
            current.filter((t) => t.toLowerCase() !== key) :
            [...current, tag];
    };

    clearTagFilters = () => { this.tagFilters.value = []; };

    setRatingFilter = (operator: RatingOperator, value: number, index = 0) => {
        const current = [...this.ratingFilters.value];
        if (index < current.length) {
            current[index] = { operator, value };
        } else {
            current.push({ operator, value });
        }
        this.ratingFilters.value = current;
    };

    addRatingFilter = (operator: RatingOperator, value: number) => {
        this.ratingFilters.value = [...this.ratingFilters.value, { operator, value }];
    };

    removeRatingFilter = (index: number) => {
        const current = [...this.ratingFilters.value];
        if (index >= 0 && index < current.length) {
            current.splice(index, 1);
            this.ratingFilters.value = current;
        }
    };

    clearRatingFilter = () => {
        this.ratingFilters.value = [];
    };

    openOverlay = () => {
        void this.load();
        this.overlayOpen.value = true;
    };

    /**
     * Cierra la superposición y deja los filtros como estaban al abrirla.
     *
     * Se limpia a propósito: la superposición se abre encima de otra página y
     * al cerrarla el usuario vuelve a lo que estaba viendo. Conservar la
     * búsqueda anterior haría que la siguiente vez se abriera con resultados
     * viejos de algo que ya no recuerda haber pedido.
     */
    closeOverlay = () => {
        this.overlayOpen.value = false;
        this.query.value = '';
        this.categoryMode.value = null;
        this.categoryQuery.value = '';
        this.typeFilters.value = [];
        this.stateFilters.value = [];
        this.tagFilters.value = [];
        this.ratingFilters.value = [];
    };

    /** Los filtros actuales, listos para guardarlos como vista. */
    currentView(name: string): Omit<SavedView, 'id'> {
        const tags = this.tagFilters.value;
        const rFilters = this.ratingFilters.value;
        return {
            name,
            typeFilter: this.typeFilters.value[0] ?? 'todo',
            stateFilter: this.stateFilters.value[0] ?? 'todo',
            tags: tags.length > 0 ? [...tags] : undefined,
            query: this.query.value.trim() || undefined,
            ratingFilter: rFilters[0] ?? undefined,
            ratingFilters: rFilters.length > 0 ? rFilters : undefined
        };
    }

    /**
     * Aplica una vista guardada. Los filtros se validan contra los valores
     * que el VM entiende: una vista vieja puede apuntar a un filtro que ya no
     * existe, y aplicarla a ciegas dejaría la búsqueda en un estado imposible.
     */
    applyView(view: SavedView) {
        const type = isTypeFilter(view.typeFilter) ? view.typeFilter : 'todo';
        this.typeFilters.value = type === 'todo' ? [] : [type];
        const state = isStateFilter(view.stateFilter) ? view.stateFilter : 'todo';
        this.stateFilters.value = state === 'todo' ? [] : [state];
        // `tag` en singular es el formato viejo, de cuando solo se podía
        // filtrar por una: las vistas guardadas entonces siguen funcionando.
        this.tagFilters.value = view.tags ?? (view.tag ? [view.tag] : []);
        this.query.value = view.query ?? '';
        if (view.ratingFilters && Array.isArray(view.ratingFilters) && view.ratingFilters.length > 0) {
            this.ratingFilters.value = view.ratingFilters.map((rf) => ({
                operator: rf.operator,
                value: rf.value
            }));
        } else if (view.ratingFilter) {
            this.ratingFilters.value = [{
                operator: view.ratingFilter.operator,
                value: view.ratingFilter.value
            }];
        } else {
            this.ratingFilters.value = [];
        }
    }

    /** Carga la biblioteca real para buscar sobre ella (si hay sesión). */
    async load() {
        if (!this.api.session.load()?.accessToken) return;
        const isLatest = this.loads.begin();
        this.loading.value = true;
        try {
            const [shows, movies] = await Promise.all([
                this.api.catalog.getShows(),
                this.api.catalog.getMovies().catch(() => [] as Movie[])
            ]);
            if (!isLatest()) return;
            this.shows.value = shows;
            this.movies.value = movies;
        } catch {
            if (!isLatest()) return;
            this.shows.value = [];
            this.movies.value = [];
        } finally {
            if (isLatest()) this.loading.value = false;
        }
    }

    /**
     * Programa la búsqueda en el servidor para `text`. No sale a la red hasta
     * que se deja de teclear, y por debajo del mínimo se limpia lo anterior:
     * borrar la caja tiene que borrar también lo que trajo el servidor.
     */
    private scheduleRemoteSearch(text: string) {
        if (this.remoteTimer) clearTimeout(this.remoteTimer);
        if (text.length < MIN_REMOTE_QUERY) {
            // Invalida la petición en vuelo: si no, su respuesta repoblaría
            // los resultados de una búsqueda que el usuario ya ha borrado.
            this.remoteLoads.begin();
            this.remoteTimer = null;
            this.searching.value = false;
            this.remote.value = [];
            return;
        }
        this.remoteTimer = setTimeout(() => { void this.searchRemote(text); }, REMOTE_DEBOUNCE_MS);
    }

    private async searchRemote(text: string) {
        if (!this.api.session.load()?.accessToken) return;
        const isLatest = this.remoteLoads.begin();
        this.searching.value = true;
        try {
            const { shows, movies } = await this.api.discover.searchCatalog(text);
            if (!isLatest()) return;
            this.remote.value = [
                ...shows.map((s) => ({ ...s, kind: 'show' as const })),
                ...movies.map((m) => ({ ...m, kind: 'movie' as const }))
            ];
        } catch {
            // El servidor no contesta: quedan los resultados locales, que es
            // exactamente lo que había antes de que existiera esta llamada.
            if (isLatest()) this.remote.value = [];
        } finally {
            if (isLatest()) this.searching.value = false;
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
            // datos que ya tenemos en memoria. Agrupado como el de la
            // biblioteca: etiquetar diez items de una selección son diez
            // mutaciones y una sola recarga. Ver MUTATION_DEBOUNCE_MS.
            if (this.mutationTimer) clearTimeout(this.mutationTimer);
            this.mutationTimer = setTimeout(() => {
                this.mutationTimer = null;
                void this.load();
            }, MUTATION_DEBOUNCE_MS);
        };
        window.addEventListener(FAVS.event, bumpFavs);
        window.addEventListener(WATCHED.event, bumpWatched);
        window.addEventListener(ITEM_MUTATED_EVENT, onMutated);
        // Se vigila el signal y no se engancha a `setQuery`: la caja no es el
        // único sitio desde donde cambia el texto (aplicar una vista guardada,
        // cerrar la superposición), y todos tienen que buscar igual.
        const stopWatchingQuery = effect(() => {
            this.scheduleRemoteSearch(parseQuery(this.query.value).text);
        });
        return () => {
            window.removeEventListener(FAVS.event, bumpFavs);
            window.removeEventListener(WATCHED.event, bumpWatched);
            window.removeEventListener(ITEM_MUTATED_EVENT, onMutated);
            stopWatchingQuery();
            if (this.remoteTimer) clearTimeout(this.remoteTimer);
            if (this.mutationTimer) clearTimeout(this.mutationTimer);
        };
    }
}

export const searchVM = new SearchViewModel(apiService);
