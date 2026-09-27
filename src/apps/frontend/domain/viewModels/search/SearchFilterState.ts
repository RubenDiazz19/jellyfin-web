import { signal, computed } from '@preact/signals-core';
import type { FilterCategory, RatingFilter, RatingOperator, StateFilter, TypeFilter } from '../utils/searchViews';
import { toggleArrayItem } from '../utils/toggleArrayItem';
import { normalizeTagForSearch } from '../../tags';
import type { SortKey } from '../../../data/stores/librarySortStore';

export type SearchSortKey = 'relevance' | SortKey;

export class SearchFilterState {
    query = signal('');
    sortKey = signal<SearchSortKey>('relevance');
    typeFilters = signal<TypeFilter[]>([]);
    stateFilters = signal<StateFilter[]>([]);
    categoryMode = signal<FilterCategory | null>(null);
    categoryQuery = signal<string>('');
    ratingFilters = signal<RatingFilter[]>([]);
    tagFilters = signal<string[]>([]);

    anyFilterActive = computed(() =>
        this.typeFilters.value.length > 0
        || this.stateFilters.value.length > 0
        || this.tagFilters.value.length > 0
        || this.ratingFilters.value.length > 0
        || !!this.query.value.trim()
    );

    setQuery = (q: string) => { this.query.value = q; };
    
    setTypeFilter = (f: TypeFilter) => {
        this.typeFilters.value = (f === 'todo' || !f) ? [] : [f];
    };
    
    setStateFilter = (f: StateFilter) => {
        this.stateFilters.value = (f === 'todo' || !f) ? [] : [f];
    };
    
    toggleTypeFilter = (t: TypeFilter) => {
        toggleArrayItem(this.typeFilters, t);
    };
    
    toggleStateFilter = (s: StateFilter) => {
        toggleArrayItem(this.stateFilters, s);
    };
    
    hasTypeFilter = (t: TypeFilter): boolean => this.typeFilters.value.includes(t);
    
    hasStateFilter = (s: StateFilter): boolean => this.stateFilters.value.includes(s);

    setSort = (k: SearchSortKey) => { this.sortKey.value = k; };

    clearTypeFilters = () => { this.typeFilters.value = []; };
    clearStateFilters = () => { this.stateFilters.value = []; };
    clearQuery = () => { this.query.value = ''; };

    openCategory = (cat: FilterCategory) => {
        this.categoryMode.value = cat;
        this.categoryQuery.value = '';
    };

    closeCategory = () => {
        this.categoryMode.value = null;
        this.categoryQuery.value = '';
    };

    toggleCategory = (cat: FilterCategory) => {
        if (this.categoryMode.value === cat) {
            this.closeCategory();
        } else {
            this.openCategory(cat);
        }
    };

    setCategoryQuery = (q: string) => {
        this.categoryQuery.value = q;
    };

    hasTagFilter = (tag: string): boolean => {
        const key = normalizeTagForSearch(tag);
        return this.tagFilters.value.some((t) => normalizeTagForSearch(t) === key);
    };

    toggleTagFilter = (tag: string) => {
        toggleArrayItem(
            this.tagFilters,
            tag,
            (a, b) => normalizeTagForSearch(a) === normalizeTagForSearch(b)
        );
    };

    clearTagFilters = () => { this.tagFilters.value = []; };

    setRatingFilter = (operator: RatingOperator, value: number, index = 0) => {
        const current = [...this.ratingFilters.value];
        if (index < current.length) {
            current[index] = { operator, value };
        } else {
            current.push({ operator, value });
        }
        this.ratingFilters.value = current;
    };

    addRatingFilter = (operator: RatingOperator, value: number) => {
        this.ratingFilters.value = [...this.ratingFilters.value, { operator, value }];
    };

    removeRatingFilter = (index: number) => {
        const current = [...this.ratingFilters.value];
        if (index >= 0 && index < current.length) {
            current.splice(index, 1);
            this.ratingFilters.value = current;
        }
    };

    clearRatingFilter = () => {
        this.ratingFilters.value = [];
    };
    
    reset = () => {
        this.query.value = '';
        this.categoryMode.value = null;
        this.categoryQuery.value = '';
        this.typeFilters.value = [];
        this.stateFilters.value = [];
        this.tagFilters.value = [];
        this.ratingFilters.value = [];
        this.sortKey.value = 'relevance';
    };
}
