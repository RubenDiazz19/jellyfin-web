import { signal } from '@preact/signals-core';
import type { SavedView } from '../../../data/stores/viewsStore';
import { buildCurrentView, extractAppliedViewFilters } from '../utils/searchViews';
import type { SearchFilterState } from './SearchFilterState';

export class SearchViewManager {
    overlayOpen = signal(false);

    constructor(
        private filters: SearchFilterState,
        private loadData: () => Promise<void>
    ) {}

    openOverlay = () => {
        void this.loadData();
        this.overlayOpen.value = true;
    };

    closeOverlay = () => {
        this.overlayOpen.value = false;
        this.filters.reset();
    };

    /** Los filtros actuales, listos para guardarlos como vista. */
    currentView(name: string): Omit<SavedView, 'id'> {
        return buildCurrentView(name, {
            typeFilters: this.filters.typeFilters.value,
            stateFilters: this.filters.stateFilters.value,
            tagFilters: this.filters.tagFilters.value,
            query: this.filters.query.value,
            ratingFilters: this.filters.ratingFilters.value
        });
    }

    /**
     * Aplica una vista guardada. Los filtros se validan contra los valores
     * que el VM entiende: una vista vieja puede apuntar a un filtro que ya no
     * existe, y aplicarla a ciegas dejaría la búsqueda en un estado imposible.
     */
    applyView(view: SavedView) {
        const state = extractAppliedViewFilters(view);
        this.filters.typeFilters.value = state.typeFilters;
        this.filters.stateFilters.value = state.stateFilters;
        this.filters.tagFilters.value = state.tagFilters;
        this.filters.query.value = state.query;
        this.filters.ratingFilters.value = state.ratingFilters;
    }
}
