// ViewModel del listado de biblioteca (series o películas).
// Con sesión Jellyfin ambas vienen del server; sin sesión, del catálogo proto.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { computed, signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie, type Show } from '../../data/models';
import { DEFAULT_SORT, LIBRARY_SORT, type SortKey } from '../../data/stores/librarySortStore';
import {
    ItemMutationSubscription, MUTATION_DEBOUNCE_MS, subscribeToMutations
} from './itemMutations';
import { registerTagSource } from './knownTags';

import { CatalogViewModel } from './CatalogViewModel';

export type LibraryKind = 'series' | 'movies';
export type { SortKey };

/** Lo que hace falta de un item para ordenarlo; lo cumplen Show y Movie. */
type Sortable = Pick<Show | Movie, 'id' | 'title' | 'year' | 'rating' | 'runtime'>;

// `numeric` para que «Temporada 2» vaya antes que «Temporada 10», y
// `sensitivity: 'base'` para que los acentos no manden a «Ángel» al final.
const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** El runtime del modelo es texto («120 min», «—»); para ordenar hace falta el número. */
function runtimeMinutes(item: Sortable): number {
    return parseInt(item.runtime, 10) || 0;
}

// Hash estable (FNV-1a) del id + semilla. El orden aleatorio tiene que
// sobrevivir a los re-renders: barajar dentro del computed reordenaría la
// rejilla en cada pintada.
function hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function compareBy(key: SortKey, seed: number) {
    return (a: Sortable, b: Sortable): number => {
        switch (key) {
            // Lo más nuevo y lo mejor valorado primero: en esos dos criterios
            // lo que se busca es la cabeza de la lista, no la cola.
            case 'year': return (b.year || 0) - (a.year || 0) || COLLATOR.compare(a.title, b.title);
            case 'rating':
                return (b.rating?.imdb || 0) - (a.rating?.imdb || 0)
                    || COLLATOR.compare(a.title, b.title);
            case 'runtime':
                return runtimeMinutes(a) - runtimeMinutes(b) || COLLATOR.compare(a.title, b.title);
            case 'random': return hash(a.id + seed) - hash(b.id + seed);
            default: return COLLATOR.compare(a.title, b.title);
        }
    };
}

export class LibraryViewModel extends CatalogViewModel {
    kind = signal<LibraryKind>('series');
    /** Criterio de orden, recordado entre visitas. */
    sortKey = signal<SortKey>(DEFAULT_SORT);

    // Cambia al volver a elegir «aleatorio»: es la forma de pedir otra baraja.
    private randomSeed = signal(0);
    private mutations = new ItemMutationSubscription();

    // Sin `loadsOnMount`: con los listados cacheados, volver a una biblioteca
    // ya visitada resuelve en el mismo tick y el spinner sería un parpadeo.
    constructor(private api: ApiService) {
        super();
        // El servidor ya manda por SortName; el resto de criterios se aplican
        // aquí sobre la lista que ya está en memoria.
        this.sortKey.value = LIBRARY_SORT.load();
        registerTagSource(() => [...this.shows.peek(), ...this.movies.peek()]);
    }

    /** Series ya ordenadas según `sortKey`. Es lo que pinta la vista. */
    sortedShows = computed<Show[]>(() =>
        [...this.shows.value].sort(compareBy(this.sortKey.value, this.randomSeed.value))
    );

    /** Películas ya ordenadas según `sortKey`. */
    sortedMovies = computed<Movie[]>(() =>
        [...this.movies.value].sort(compareBy(this.sortKey.value, this.randomSeed.value))
    );

    setSort = (key: SortKey) => {
        // Volver a pulsar «aleatorio» rebaraja en vez de no hacer nada.
        if (key === 'random') this.randomSeed.value++;
        else if (key === this.sortKey.peek()) return;
        this.sortKey.value = key;
        LIBRARY_SORT.save(key);
    };

    private hasDataFor(kind: LibraryKind): boolean {
        return (kind === 'movies' ? this.movies : this.shows).peek().length > 0;
    }

    async load(kind: LibraryKind) {
        this.subscribeToMutations();
        await this.guarded(async (isLatest) => {
            this.kind.value = kind;
            this.error.value = null;

            const authed = !!this.api.session.load()?.accessToken;
            if (!authed) {
                if (kind === 'movies') this.movies.value = Object.values(PROTO_DATA.movies);
                else this.shows.value = Object.values(PROTO_DATA.shows);
                return;
            }

            // El esqueleto solo si no hay nada que enseñar. Con los listados
            // cacheados, volver a una biblioteca ya visitada resuelve en el
            // mismo tick: pintar el esqueleto sería un parpadeo de un frame, y
            // en la recarga por mutación sería tirar la rejilla para volver a
            // pintarla igual.
            this.loading.value = !this.hasDataFor(kind);
            if (kind === 'movies') {
                const movies = await this.api.catalog.getMovies();
                if (!isLatest()) return;
                this.movies.value = movies;
            } else {
                const shows = await this.api.catalog.getShows();
                if (!isLatest()) return;
                this.shows.value = shows;
            }
        });
    }

    // Cualquier mutación de item recarga la biblioteca activa: no sabemos si
    // el item afectado está en la lista visible, y una lista de N pósters es
    // barata frente a la fricción de recargar la página a mano.
    //
    // Con debounce porque una acción del usuario emite muchas mutaciones
    // seguidas (ver MUTATION_DEBOUNCE_MS): la biblioteca entera se recarga una
    // vez por lote, no una vez por episodio.
    private subscribeToMutations() {
        subscribeToMutations(this.mutations, () => {
            // Solo refetcheamos si la lista ya se pintó (no en montaje inicial
            // sin datos, para no forzar cargas concurrentes).
            const hasData = this.shows.value.length > 0 || this.movies.value.length > 0;
            if (!hasData) return;
            void this.load(this.kind.value);
        }, MUTATION_DEBOUNCE_MS);
    }
}

export const libraryVM = new LibraryViewModel(apiService);

