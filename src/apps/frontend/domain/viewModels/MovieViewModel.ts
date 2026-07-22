import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { ITEM_MUTATED_EVENT, type ItemMutatedDetail } from '../../data/api/mutations';
import { PROTO_DATA, type Movie } from '../../data/models';

export class MovieViewModel {
    movie = signal<Movie | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    private seq = 0;
    private subscribed = false;

    constructor(private api: ApiService) {
        this.subscribeToMutations();
    }

    async load(id: string, force = false) {
        // Si ya tenemos esa película cargada desde API y no ha cambiado la id,
        // solo refrescamos si viene de PROTO_DATA (primera carga) o si el caller
        // fuerza (p. ej. tras editar imagen/metadatos del item activo).
        const cached = this.movie.value;
        if (!force && cached && cached.id === id && !this.error.value && !PROTO_DATA.movies[id]) return;

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

    // Refresca la película actual si alguien mutó ese mismo item (edición de
    // imagen, metadatos, played, favorito). Sin esto el usuario necesitaría
    // recargar la página para ver la nueva portada.
    private subscribeToMutations() {
        if (this.subscribed || typeof window === 'undefined') return;
        this.subscribed = true;
        window.addEventListener(ITEM_MUTATED_EVENT, (e: Event) => {
            const detail = (e as CustomEvent<ItemMutatedDetail>).detail;
            const current = this.movie.value;
            if (!current) return;
            if (detail?.itemId && detail.itemId !== current.id) return;
            void this.load(current.id, true);
        });
    }
}

export const movieVM = new MovieViewModel(apiService);
