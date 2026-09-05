import type { RatingOperator, SavedView } from '../../data/stores/viewsStore';

export type { RatingOperator };
export type TypeFilter = 'todo' | 'series' | 'peliculas';
export type StateFilter = 'todo' | 'favs' | 'vistos' | 'no-vistos';
export type FilterCategory = 'tipo' | 'estado' | 'generos' | 'valoracion';
export type RatingFilter = { operator: RatingOperator; value: number };

export const TYPE_FILTERS: readonly string[] = ['todo', 'series', 'peliculas'];
export const STATE_FILTERS: readonly string[] = ['todo', 'favs', 'vistos', 'no-vistos'];

export function isTypeFilter(v: string): v is TypeFilter {
    return TYPE_FILTERS.includes(v);
}

export function isStateFilter(v: string): v is StateFilter {
    return STATE_FILTERS.includes(v);
}

export type SearchFiltersState = {
    typeFilters: TypeFilter[];
    stateFilters: StateFilter[];
    tagFilters: string[];
    query: string;
    ratingFilters: RatingFilter[];
};

/**
 * Convierte el estado de filtros actual a un objeto listo para persistir como SavedView.
 */
export function buildCurrentView(
    name: string,
    state: SearchFiltersState
): Omit<SavedView, 'id'> {
    const tags = state.tagFilters;
    const rFilters = state.ratingFilters;
    return {
        name,
        typeFilter: state.typeFilters[0] ?? 'todo',
        stateFilter: state.stateFilters[0] ?? 'todo',
        tags: tags.length > 0 ? [...tags] : undefined,
        query: state.query.trim() || undefined,
        ratingFilter: rFilters[0] ?? undefined,
        ratingFilters: rFilters.length > 0 ? rFilters : undefined
    };
}

/**
 * Extrae y valida los filtros de una vista guardada para aplicarlos de forma segura en el ViewModel.
 * Garantiza compatibilidad retroactiva con formatos previos de vistas.
 */
export function extractAppliedViewFilters(view: SavedView): SearchFiltersState {
    const type = isTypeFilter(view.typeFilter) ? view.typeFilter : 'todo';
    const state = isStateFilter(view.stateFilter) ? view.stateFilter : 'todo';
    const tagFilters = view.tags ?? (view.tag ? [view.tag] : []);
    const query = view.query ?? '';

    let ratingFilters: RatingFilter[] = [];
    if (view.ratingFilters && Array.isArray(view.ratingFilters) && view.ratingFilters.length > 0) {
        ratingFilters = view.ratingFilters.map((rf) => ({
            operator: rf.operator,
            value: rf.value
        }));
    } else if (view.ratingFilter) {
        ratingFilters = [{
            operator: view.ratingFilter.operator,
            value: view.ratingFilter.value
        }];
    }

    return {
        typeFilters: type === 'todo' ? [] : [type],
        stateFilters: state === 'todo' ? [] : [state],
        tagFilters,
        query,
        ratingFilters
    };
}
