// ViewModel del detalle de película. La API de Jellyfin del frontend aún no
// expone películas (solo series), así que resuelve contra el catálogo proto.
// Cuando exista catalog.getMovie(), este VM es el único punto a tocar.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie } from '../../data/models';

export class MovieViewModel {
    movie = signal<Movie | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    constructor(private api: ApiService) {}

    load(id: string) {
        this.movie.value = PROTO_DATA.movies[id] ?? null;
        this.error.value = null;
        this.loading.value = false;
    }

    /** Película cargada solo si coincide con la id pedida. */
    movieFor(id: string): Movie | null {
        const m = this.movie.value;
        return m && m.id === id ? m : null;
    }
}

export const movieVM = new MovieViewModel(apiService);
