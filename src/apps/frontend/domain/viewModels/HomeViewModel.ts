// ViewModel de la Home: carrusel del hero + biblioteca (series y películas).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { ITEM_MUTATED_EVENT } from '../../data/api/mutations';
import type { CarouselSlide, Movie, Show } from '../../data/models';

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

    // Token de carga: si el usuario navega y vuelve antes de que termine un
    // load() anterior, solo la última llamada escribe estado.
    private seq = 0;
    private mutationHandler: (() => void) | null = null;

    constructor(private api: ApiService) {}

    async load() {
        this.subscribeToMutations();
        const seq = ++this.seq;
        this.heroLoading.value = true;
        this.showsLoading.value = true;
        this.showsError.value = null;

        // Hero y biblioteca en paralelo con estados independientes: el hero es
        // opcional (si falla, la Home sigue mostrando la biblioteca).
        void this.api.catalog.getHomeCarousel()
            .then((slides) => {
                if (seq !== this.seq) return;
                this.slides.value = slides;
            })
            .catch(() => {
                if (seq !== this.seq) return;
                this.slides.value = [];
            })
            .finally(() => {
                if (seq !== this.seq) return;
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
            if (seq !== this.seq) return;
            this.shows.value = shows;
            this.movies.value = movies;
        } catch (e) {
            if (seq !== this.seq) return;
            this.showsError.value = (e as Error).message;
        } finally {
            if (seq === this.seq) {
                this.showsLoading.value = false;
                this.showsReady.value = true;
            }
        }
    }

    // Cualquier mutación de item recarga la Home si ya hay datos: la lista
    // de series/películas y el hero pueden contener el item afectado y no
    // queremos que el usuario tenga que recargar para verlo.
    //
    // Se engancha en el primer `load()`, no en el constructor: el VM es un
    // singleton de módulo, así que hacerlo al construirlo dejaba un listener
    // global colgado por el mero hecho de importar el fichero — y si `window`
    // no existía en ese momento, no había segunda oportunidad. Hasta que hay
    // datos el handler no haría nada de todos modos.
    //
    // No hay `dispose()`: el listener dura lo que el singleton, que dura lo
    // que el documento. Desengancharlo no tendría a quién beneficiar.
    private subscribeToMutations() {
        if (this.mutationHandler || typeof window === 'undefined') return;
        this.mutationHandler = () => {
            if (!this.showsReady.value) return;
            void this.load();
        };
        window.addEventListener(ITEM_MUTATED_EVENT, this.mutationHandler);
    }
}

export const homeVM = new HomeViewModel(apiService);
