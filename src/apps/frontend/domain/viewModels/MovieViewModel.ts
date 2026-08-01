import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie } from '../../data/models';
import { ItemMutationSubscription } from './itemMutations';
import { LoadGuard } from './loadGuard';

export class MovieViewModel {
    movie = signal<Movie | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    private loads = new LoadGuard();
    private mutations = new ItemMutationSubscription();

    constructor(private api: ApiService) {}

    async load(id: string, force = false) {
        this.subscribeToMutations();
        // Si ya tenemos esa película cargada desde API y no ha cambiado la id,
        // solo refrescamos si viene de PROTO_DATA (primera carga) o si el caller
        // fuerza (p. ej. tras editar imagen/metadatos del item activo).
        const cached = this.movie.value;
        if (!force && cached && cached.id === id && !this.error.value && !PROTO_DATA.movies[id]) return;

        // Limpiamos el error si cambiamos de id
        if (cached?.id !== id) this.error.value = null;

        const isLatest = this.loads.begin();
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
            if (!isLatest()) return;
            this.movie.value = movie;
            this.loading.value = false;
            this.error.value = null;
        } catch (e) {
            if (!isLatest()) return;
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

    // Refresca la película actual si alguien mutó ese mismo item (edición de
    // imagen, metadatos, played, favorito). Sin esto el usuario necesitaría
    // recargar la página para ver la nueva portada.
    private subscribeToMutations() {
        this.mutations.ensure((itemId) => {
            const current = this.movie.value;
            if (!current) return;
            if (itemId && itemId !== current.id) return;
            void this.load(current.id, true);
        });
    }
}

export const movieVM = new MovieViewModel(apiService);
