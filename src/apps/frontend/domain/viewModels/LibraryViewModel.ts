// ViewModel del listado de biblioteca (series o películas).
// Con sesión Jellyfin ambas vienen del server; sin sesión, del catálogo proto.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { ITEM_MUTATED_EVENT } from '../../data/api/mutations';
import { PROTO_DATA, type Movie, type Show } from '../../data/models';

export type LibraryKind = 'series' | 'movies';

export class LibraryViewModel {
    kind = signal<LibraryKind>('series');
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);

    private seq = 0;
    private subscribed = false;

    constructor(private api: ApiService) {
        this.subscribeToMutations();
    }

    async load(kind: LibraryKind) {
        const seq = ++this.seq;
        this.kind.value = kind;
        this.error.value = null;

        const authed = !!this.api.session.load()?.accessToken;
        if (!authed) {
            if (kind === 'movies') this.movies.value = Object.values(PROTO_DATA.movies);
            else this.shows.value = Object.values(PROTO_DATA.shows);
            this.loading.value = false;
            return;
        }

        this.loading.value = true;
        try {
            if (kind === 'movies') {
                const movies = await this.api.catalog.getMovies();
                if (seq !== this.seq) return;
                this.movies.value = movies;
            } else {
                const shows = await this.api.catalog.getShows();
                if (seq !== this.seq) return;
                this.shows.value = shows;
            }
        } catch (e) {
            if (seq !== this.seq) return;
            this.error.value = (e as Error).message;
        } finally {
            if (seq === this.seq) this.loading.value = false;
        }
    }

    // Cualquier mutación de item recarga la biblioteca activa: no sabemos si
    // el item afectado está en la lista visible, y una lista de N pósters es
    // barata frente a la fricción de recargar la página a mano.
    private subscribeToMutations() {
        if (this.subscribed || typeof window === 'undefined') return;
        this.subscribed = true;
        window.addEventListener(ITEM_MUTATED_EVENT, () => {
            // Solo refetcheamos si la lista ya se pintó (no en montaje inicial
            // sin datos, para no forzar cargas concurrentes).
            const hasData = this.shows.value.length > 0 || this.movies.value.length > 0;
            if (!hasData) return;
            void this.load(this.kind.value);
        });
    }
}

export const libraryVM = new LibraryViewModel(apiService);
