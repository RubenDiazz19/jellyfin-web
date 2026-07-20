// ViewModel del listado de biblioteca (series o películas).
// Con sesión Jellyfin ambas vienen del server; sin sesión, del catálogo proto.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie, type Show } from '../../data/models';

export type LibraryKind = 'series' | 'movies';

export class LibraryViewModel {
    kind = signal<LibraryKind>('series');
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);

    private seq = 0;

    constructor(private api: ApiService) {}

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
}

export const libraryVM = new LibraryViewModel(apiService);
