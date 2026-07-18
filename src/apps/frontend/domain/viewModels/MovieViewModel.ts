import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie } from '../../data/models';

export class MovieViewModel {
    movie = signal<Movie | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    private seq = 0;

    constructor(private api: ApiService) {}

    async load(id: string) {
        // Si ya tenemos esa película cargada desde API y no ha cambiado la id,
        // solo refrescamos si viene de PROTO_DATA (primera carga).
        const cached = this.movie.value;
        if (cached && cached.id === id && !this.error.value && !PROTO_DATA.movies[id]) return;

        // Limpiamos el error si cambiamos de id
        if (cached?.id !== id) this.error.value = null;

        const seq = ++this.seq;
        // Primero mostramos proto data instantáneamente si existe
        const proto = PROTO_DATA.movies[id];
        if (proto) {
            this.movie.value = proto;
            this.loading.value = false;
            this.error.value = null;
        } else {
            this.movie.value = null;
            this.loading.value = true;
        }

        try {
            const movie = await this.api.catalog.getMovie(id);
            if (seq !== this.seq) return;
            this.movie.value = movie;
            this.loading.value = false;
            this.error.value = null;
        } catch (e) {
            if (seq !== this.seq) return;
            // Si ya teníamos proto data, no sobreescribimos con error
            if (proto) return;
            this.error.value = (e as Error).message;
            this.loading.value = false;
        }
    }

    movieFor(id: string): Movie | null {
        const m = this.movie.value;
        return m && m.id === id ? m : null;
    }
}

export const movieVM = new MovieViewModel(apiService);
