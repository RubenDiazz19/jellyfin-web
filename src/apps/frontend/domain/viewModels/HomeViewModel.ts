// ViewModel de la Home: carrusel del hero + biblioteca de series.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { CarouselSlide, Show } from '../../data/models';

export class HomeViewModel {
    slides = signal<CarouselSlide[]>([]);
    shows = signal<Show[]>([]);
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

    constructor(private api: ApiService) {}

    async load() {
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
            const shows = await this.api.catalog.getShows();
            if (seq !== this.seq) return;
            this.shows.value = shows;
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
}

export const homeVM = new HomeViewModel(apiService);
