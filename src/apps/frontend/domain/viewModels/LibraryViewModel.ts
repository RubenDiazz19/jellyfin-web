// ViewModel del listado de biblioteca (series o películas).
// Las series vienen de Jellyfin cuando hay sesión; las películas siguen en el
// catálogo proto hasta que la API las exponga.
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

        if (kind === 'movies') {
            this.movies.value = Object.values(PROTO_DATA.movies);
            this.loading.value = false;
            return;
        }

        const authed = !!this.api.session.load()?.accessToken;
        if (!authed) {
            this.shows.value = Object.values(PROTO_DATA.shows);
            this.loading.value = false;
            return;
        }

        this.loading.value = true;
        try {
            const shows = await this.api.catalog.getShows();
            if (seq !== this.seq) return;
            this.shows.value = shows;
        } catch (e) {
            if (seq !== this.seq) return;
            this.error.value = (e as Error).message;
        } finally {
            if (seq === this.seq) this.loading.value = false;
        }
    }
}

export const libraryVM = new LibraryViewModel(apiService);
