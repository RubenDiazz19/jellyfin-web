import { describe, it, expect } from 'vitest';
import { CatalogViewModel } from '../CatalogViewModel';

class TestCatalogViewModel extends CatalogViewModel {}

describe('CatalogViewModel', () => {
    it('initializes with empty lists', () => {
        const vm = new TestCatalogViewModel();
        expect(vm.shows.value).toEqual([]);
        expect(vm.movies.value).toEqual([]);
        expect(vm.loading.value).toBe(false);
    });

    it('can initialize with loadsOnMount', () => {
        const vm = new TestCatalogViewModel({ loadsOnMount: true });
        expect(vm.loading.value).toBe(true);
    });
});
