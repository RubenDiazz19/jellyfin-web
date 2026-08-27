// ViewModel de la Home: carrusel del hero + biblioteca (series y películas).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { CarouselSlide, Movie, Show } from '../../data/models';
import {
    ItemMutationSubscription, MUTATION_DEBOUNCE_MS, subscribeToMutations
} from './itemMutations';
import { LoadGuard } from './loadGuard';

export class HomeViewModel {
    slides = signal<CarouselSlide[]>([]);

    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    heroLoading = signal(false);
    showsLoading = signal(false);
    showsError = signal<string | null>(null);
    // "Ready" = ya se resolvió al menos una carga. Distingue el estado
    // inicial (aún sin pedir datos: la View pinta skeleton, no "vacío")
    // de una respuesta real sin resultados.
    heroReady = signal(false);
    showsReady = signal(false);

    private loads = new LoadGuard();
    private mutations = new ItemMutationSubscription();

    constructor(private api: ApiService) {}

    async load() {
        this.subscribeToMutations();
        const isLatest = this.loads.begin();
        // Los esqueletos solo la primera vez. Con los listados cacheados una
        // vuelta a la Home resuelve en el mismo tick, y en la recarga por
        // mutación tirar el hero y las filas para volver a pintar lo mismo se
        // ve como un parpadeo.
        this.heroLoading.value = !this.heroReady.peek();
        this.showsLoading.value = !this.showsReady.peek();
        this.showsError.value = null;

        // Hero y biblioteca en paralelo con estados independientes: el hero es
        // opcional (si falla, la Home sigue mostrando la biblioteca).
        void this.api.catalog.getHomeCarousel()
            .then((slides) => {
                if (!isLatest()) return;
                this.slides.value = slides;
            })
            .catch(() => {
                if (!isLatest()) return;
                this.slides.value = [];
            })
            .finally(() => {
                if (!isLatest()) return;
                this.heroLoading.value = false;
                this.heroReady.value = true;
            });

        try {
            // Series y películas en paralelo; las películas son opcionales
            // (si fallan, la Home sigue mostrando las series).
            const [shows, movies] = await Promise.all([
                this.api.catalog.getShows(),
                this.api.catalog.getMovies().catch(() => [] as Movie[])
            ]);
            if (!isLatest()) return;
            this.shows.value = shows;
            this.movies.value = movies;
        } catch (e) {
            if (!isLatest()) return;
            this.showsError.value = (e as Error).message;
        } finally {
            if (isLatest()) {
                this.showsLoading.value = false;
                this.showsReady.value = true;
            }
        }
    }

    // Cualquier mutación de item recarga la Home si ya hay datos: la lista
    // de series/películas y el hero pueden contener el item afectado y no
    // queremos que el usuario tenga que recargar para verlo. Con debounce: un
    // lote de mutaciones (marcar una temporada entera) es una recarga, no una
    // por episodio. Ver MUTATION_DEBOUNCE_MS.
    private subscribeToMutations() {
        subscribeToMutations(this.mutations, () => {
            if (!this.showsReady.value) return;
            void this.load();
        }, MUTATION_DEBOUNCE_MS);
    }
}

export const homeVM = new HomeViewModel(apiService);

