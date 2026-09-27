import { signal, computed, type Signal } from '@preact/signals-core';
import type { Movie, Show } from '../../../data/models';
import { computeAllTags, computeAvailableTags } from '../utils/searchTags';
import { MUTATION_DEBOUNCE_MS } from '../utils/mutationSubscription';
import type { SearchFilterState } from './SearchFilterState';
import type { SearchResult } from '../SearchViewModel'; // Assuming SearchResult is here

export class TagManager {
    mutationVersion = signal(0);
    private mutationTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private shows: Signal<Show[]>,
        private movies: Signal<Movie[]>,
        private filters: SearchFilterState,
        private results: Signal<SearchResult[]>,
        private loadData: (opts: { force?: boolean }) => Promise<void>
    ) {}

    /**
     * Las etiquetas que se pintan como chips. NO son todas las del item: de
     * `tags` solo pasan las que el usuario haya escrito a mano, porque ahí
     * dentro vienen también los cientos de keywords de TMDB —«adventurer»,
     * «aftercreditsstinger», «blind girl»— que como filtro no sirven de nada:
     * casan con uno o dos items y convierten la fila en una tira infinita.
     *
     * Lo que se descarta aquí sigue siendo buscable escribiendo `#keyword`.
     * Se agrupan ignorando mayúsculas y se enseña la primera grafía vista.
     */
    allTags = computed<string[]>(() => {
        // Depende de las mutaciones: al etiquetar un item, la lista de chips
        // tiene que incluir la etiqueta nueva.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.mutationVersion.value;
        return computeAllTags([...this.shows.value, ...this.movies.value]);
    });

    /**
     * Etiquetas disponibles según los resultados actuales de la búsqueda.
     * Si no hay filtros activos que acoten, devuelve todas las etiquetas (allTags).
     * Si hay filtros activos, solo devuelve las etiquetas que tienen las obras
     * resultantes (más las etiquetas ya seleccionadas, para poder desmarcarlas).
     */
    availableTags = computed<string[]>(() => {
        const hasOtherFilters = this.filters.typeFilters.value.length > 0
            || this.filters.stateFilters.value.length > 0
            || this.filters.ratingFilters.value.length > 0
            || !!this.filters.query.value.trim();

        return computeAvailableTags({
            allTags: this.allTags.value,
            activeTags: this.filters.tagFilters.value,
            currentResults: this.results.value,
            hasOtherFilters
        });
    });

    onMutated = () => {
        this.mutationVersion.value++;
        // Refetch, no solo re-filtrado: una etiqueta nueva no está en los
        // datos que ya tenemos en memoria. Agrupado como el de la
        // biblioteca: etiquetar diez items de una selección son diez
        // mutaciones y una sola recarga. Ver MUTATION_DEBOUNCE_MS.
        if (this.mutationTimer) clearTimeout(this.mutationTimer);
        this.mutationTimer = setTimeout(() => {
            this.mutationTimer = null;
            void this.loadData({ force: true });
        }, MUTATION_DEBOUNCE_MS);
    };

    cleanup() {
        if (this.mutationTimer) clearTimeout(this.mutationTimer);
    }
}
