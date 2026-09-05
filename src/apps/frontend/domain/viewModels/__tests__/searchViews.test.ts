import { describe, it, expect } from 'vitest';
import {
    buildCurrentView,
    extractAppliedViewFilters,
    isStateFilter,
    isTypeFilter
} from '../searchViews';
import type { SavedView } from '../../../data/stores/viewsStore';

describe('searchViews', () => {
    describe('isTypeFilter & isStateFilter', () => {
        it('valida tipos permitidos', () => {
            expect(isTypeFilter('todo')).toBe(true);
            expect(isTypeFilter('series')).toBe(true);
            expect(isTypeFilter('peliculas')).toBe(true);
            expect(isTypeFilter('otraCosa')).toBe(false);
        });

        it('valida estados permitidos', () => {
            expect(isStateFilter('todo')).toBe(true);
            expect(isStateFilter('favs')).toBe(true);
            expect(isStateFilter('vistos')).toBe(true);
            expect(isStateFilter('no-vistos')).toBe(true);
            expect(isStateFilter('desconocido')).toBe(false);
        });
    });

    describe('buildCurrentView', () => {
        it('construye una SavedView a partir del estado de filtros', () => {
            const view = buildCurrentView('Mi Vista', {
                typeFilters: ['series'],
                stateFilters: ['favs'],
                tagFilters: ['anime', 'accion'],
                query: ' naruto ',
                ratingFilters: [{ operator: '>=', value: 8 }]
            });

            expect(view).toEqual({
                name: 'Mi Vista',
                typeFilter: 'series',
                stateFilter: 'favs',
                tags: ['anime', 'accion'],
                query: 'naruto',
                ratingFilter: { operator: '>=', value: 8 },
                ratingFilters: [{ operator: '>=', value: 8 }]
            });
        });

        it('usa valores por defecto cuando no hay filtros activos', () => {
            const view = buildCurrentView('Vista Vacía', {
                typeFilters: [],
                stateFilters: [],
                tagFilters: [],
                query: '',
                ratingFilters: []
            });

            expect(view).toEqual({
                name: 'Vista Vacía',
                typeFilter: 'todo',
                stateFilter: 'todo',
                tags: undefined,
                query: undefined,
                ratingFilter: undefined,
                ratingFilters: undefined
            });
        });
    });

    describe('extractAppliedViewFilters', () => {
        it('restaura estado completo de una SavedView moderna', () => {
            const saved: SavedView = {
                id: 'v1',
                name: 'Test',
                typeFilter: 'peliculas',
                stateFilter: 'vistos',
                tags: ['terror'],
                query: 'alien',
                ratingFilters: [{ operator: '>=', value: 7.5 }]
            };

            const extracted = extractAppliedViewFilters(saved);
            expect(extracted.typeFilters).toEqual(['peliculas']);
            expect(extracted.stateFilters).toEqual(['vistos']);
            expect(extracted.tagFilters).toEqual(['terror']);
            expect(extracted.query).toBe('alien');
            expect(extracted.ratingFilters).toEqual([{ operator: '>=', value: 7.5 }]);
        });

        it('soporta vistas antiguas con tag singular y ratingFilter único', () => {
            const legacy: SavedView = {
                id: 'v2',
                name: 'Legacy',
                typeFilter: 'series',
                stateFilter: 'todo',
                tag: 'drama',
                ratingFilter: { operator: '<=', value: 6 }
            };

            const extracted = extractAppliedViewFilters(legacy);
            expect(extracted.typeFilters).toEqual(['series']);
            expect(extracted.stateFilters).toEqual([]);
            expect(extracted.tagFilters).toEqual(['drama']);
            expect(extracted.ratingFilters).toEqual([{ operator: '<=', value: 6 }]);
        });
    });
});
