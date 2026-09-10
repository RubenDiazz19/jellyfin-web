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
import { PROTO_DATA, type Movie, type Show } from '../../data/models';
import { FAVS } from '../../data/stores/favsStore';
import { episodeKey, movieKey } from '../../data/stores/itemKeys';
import { WATCHED } from '../../data/stores/watchedStore';
import type { SavedView } from '../../data/stores/viewsStore';
import { MUTATION_DEBOUNCE_MS } from './itemMutations';
import { registerTagSource } from './knownTags';
import { guardedLoad } from './guardedLoad';
import { LoadGuard } from './loadGuard';
import { getItemGenres } from '../genres';
import { isShowFullyWatched } from '../showWatched';
import { getItemTags, normalizeTagForSearch } from '../tags';
import {
    buildCurrentView,
    extractAppliedViewFilters,
    type FilterCategory,
    type RatingFilter,
    type RatingOperator,
    type StateFilter,
    type TypeFilter
} from './searchViews';
import { computeAllTags, computeAvailableTags } from './searchTags';

export type {
    FilterCategory,
    RatingFilter,
    RatingOperator,
    StateFilter,
    TypeFilter
};

const CATALOG_TTL_MS = 60_000;

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

export type FilterCriteria = {
    types: readonly TypeFilter[];
    states: readonly StateFilter[];
    requiredTags: readonly string[];
    ratingFilters: readonly RatingFilter[];
};

/**
 * Comprueba si un elemento cumple con los criterios de filtrado seleccionados.
 */
export function matchesFilters(
    item: {
        kind: 'show' | 'movie';
        id: string;
        tags: readonly string[];
        imdb: number;
    },
    isWatched: () => boolean,
    criteria: FilterCriteria
): boolean {
    if (criteria.types.length > 0) {
        const matchesType = (criteria.types.includes('series') && item.kind === 'show')
            || (criteria.types.includes('peliculas') && item.kind === 'movie');
        if (!matchesType) return false;
    }

    if (criteria.requiredTags.length > 0) {
        if (!criteria.requiredTags.every((t) => item.tags.includes(t))) return false;
    }

    if (criteria.states.length > 0) {
        if (!matchesState(item.kind, item.id, isWatched(), criteria.states)) return false;
    }

    return criteria.ratingFilters.length === 0 || matchesRating(item.imdb, criteria.ratingFilters);
}

/**
 * Helper genérico para alternar elementos en señales con arrays.
 */
export function toggleArrayItem<T>(
    sig: Signal<T[]>,
    item: T,
    equals: (a: T, b: T) => boolean = (a, b) => a === b
): void {
    const current = sig.value;
    sig.value = current.some((x) => equals(x, item)) ?
        current.filter((x) => !equals(x, item)) :
        [...current, item];
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

/**
 * Normaliza texto para búsqueda libre e indexación:
 * - A minúsculas.
 * - Descompone y elimina acentos / marcas diacríticas (NFD).
 * - Reemplaza signos de puntuación y símbolos por espacios para buscar palabras limpias.
 * - Colapsa espacios en blanco repetidos.
 */
export function normalizeSearchText(text: string | undefined | null): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

type IndexedItem = {
    item: SearchResult;
    id: string;
    kind: 'show' | 'movie';
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
    /**
     * Etiquetas elegidas en la fila de chips. Se acumulan en Y: pulsar
     * «Anime» y «Instituto» deja lo que tenga las dos, no la unión. Es lo que
     * hace útil un vocabulario con géneros y matices a la vez — el género
     * acota y el matiz afina.
     */
    tagFilters = signal<string[]>([]);

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
            const rawGenres = getItemGenres(item);
            const genres = [
                ...rawGenres.map((g) => normalizeTagForSearch(g)),
                ...rawGenres.map((g) => normalizeSearchText(g))
            ].filter(Boolean);
            const tags = getItemTags(item).map((t) => normalizeTagForSearch(t));
            const seriesEpisodeKeys = item.kind === 'show' ?
                (item.seasons || []).flatMap((s) => (s.episodes || []).map((e) => episodeKey(item.id, s.n, e.n))) :
                undefined;

            return {
                item,
                id: item.id,
                kind: item.kind,
                normTitle: normalizeSearchText(item.title),
                normOriginalTitle: normalizeSearchText(item.originalTitle),
                normSynopsis: normalizeSearchText(item.synopsis),
                genres,
                cast: (item.cast ?? []).map((c) => normalizeSearchText(c.name)).filter(Boolean),
                tags,
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
        const { text: rawText, tags: queryTags } = parseQuery(this.query.value);
        const normQ = normalizeSearchText(rawText);
        const qWords = normQ ? normQ.split(' ').filter(Boolean) : [];
        const requiredTags = [
            ...queryTags,
            ...this.tagFilters.value.map((t) => t.toLowerCase())
        ];
        const rFilters = this.ratingFilters.value;
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
                () => entry.kind === 'show' ?
                    !!entry.seriesEpisodeKeys && entry.seriesEpisodeKeys.length > 0 && entry.seriesEpisodeKeys.every((k) => WATCHED.has(k)) :
                    ((entry.item.watched ?? 0) >= 1 || WATCHED.has(movieKey(entry.id))),
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

        if (normQ) {
            localScored.sort((a, b) => b.score - a.score);
        }
        const local = localScored.map((l) => l.item);

        // Lo del servidor que no estuviera ya cargado, al final: son los
        // títulos que la búsqueda local no podía encontrar.
        const remoteItems = this.remote.value;
        if (remoteItems.length === 0) return local;

        const known = this.knownCatalogIds.value;
        const extra: SearchResult[] = [];
        for (const item of remoteItems) {
            if (known.has(item.id)) continue;

            const itemTags = getItemTags(item).map((t) => t.toLowerCase());
            const score = item.rating?.imdb ?? 0;
            const matches = matchesFilters(
                { kind: item.kind, id: item.id, tags: itemTags, imdb: score },
                () => item.kind === 'show' ? isShowFullyWatched(item) : isMovieWatched(item),
                criteria
            );
            if (!matches) continue;

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
        return computeAllTags([...this.shows.value, ...this.movies.value]);
    });

    /**
     * Etiquetas disponibles según los resultados actuales de la búsqueda.
     * Si no hay filtros activos que acoten, devuelve todas las etiquetas (allTags).
     * Si hay filtros activos, solo devuelve las etiquetas que tienen las obras
     * resultantes (más las etiquetas ya seleccionadas, para poder desmarcarlas).
     */
    availableTags = computed<string[]>(() => {
        const hasOtherFilters = this.typeFilters.value.length > 0
            || this.stateFilters.value.length > 0
            || this.ratingFilters.value.length > 0
            || !!this.query.value.trim();

        return computeAvailableTags({
            allTags: this.allTags.value,
            activeTags: this.tagFilters.value,
            currentResults: this.results.value,
            hasOtherFilters
        });
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
        toggleArrayItem(this.typeFilters, t);
    };
    toggleStateFilter = (s: StateFilter) => {
        toggleArrayItem(this.stateFilters, s);
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
    hasTagFilter = (tag: string): boolean => {
        const key = normalizeTagForSearch(tag);
        return this.tagFilters.value.some((t) => normalizeTagForSearch(t) === key);
    };

    /** Añade o quita una etiqueta del filtro. */
    toggleTagFilter = (tag: string) => {
        toggleArrayItem(
            this.tagFilters,
            tag,
            (a, b) => normalizeTagForSearch(a) === normalizeTagForSearch(b)
        );
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
        return buildCurrentView(name, {
            typeFilters: this.typeFilters.value,
            stateFilters: this.stateFilters.value,
            tagFilters: this.tagFilters.value,
            query: this.query.value,
            ratingFilters: this.ratingFilters.value
        });
    }

    /**
     * Aplica una vista guardada. Los filtros se validan contra los valores
     * que el VM entiende: una vista vieja puede apuntar a un filtro que ya no
     * existe, y aplicarla a ciegas dejaría la búsqueda en un estado imposible.
     */
    applyView(view: SavedView) {
        const state = extractAppliedViewFilters(view);
        this.typeFilters.value = state.typeFilters;
        this.stateFilters.value = state.stateFilters;
        this.tagFilters.value = state.tagFilters;
        this.query.value = state.query;
        this.ratingFilters.value = state.ratingFilters;
    }

    private guarded = guardedLoad(this.loading, undefined, this.loads).guarded;
    private remoteGuarded = guardedLoad(this.searching, undefined, this.remoteLoads).guarded;
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
            const [shows, movies] = await Promise.all([
                this.api.catalog.getShows(),
                this.api.catalog.getMovies().catch(() => [] as Movie[])
            ]);
            if (!isLatest()) return;
            this.shows.value = shows;
            this.movies.value = movies;
            this.lastLoadedAt = Date.now();
        }, () => {
            this.shows.value = [];
            this.movies.value = [];
            return false;
        });
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
        this.searching.value = true;
        await this.remoteGuarded(async (isLatest) => {
            const { shows, movies } = await this.api.discover.searchCatalog(text);
            if (!isLatest()) return;
            this.remote.value = [
                ...shows.map((s) => ({ ...s, kind: 'show' as const })),
                ...movies.map((m) => ({ ...m, kind: 'movie' as const }))
            ];
        }, () => {
            this.remote.value = [];
            return false;
        });
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
                void this.load({ force: true });
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
