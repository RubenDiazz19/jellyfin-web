import { describe, it, expect } from 'vitest';
import { LoadableViewModel } from '../LoadableViewModel';

class TestViewModel extends LoadableViewModel {
    constructor(loadsOnMount = false) {
        super({ loadsOnMount });
    }
}

describe('LoadableViewModel', () => {
    it('initializes with default state', () => {
        const vm = new TestViewModel();
        expect(vm.loading.value).toBe(false);
        expect(vm.error.value).toBeNull();
    });

    it('initializes with loading true if loadsOnMount is true', () => {
        const vm = new TestViewModel(true);
        expect(vm.loading.value).toBe(true);
        expect(vm.error.value).toBeNull();
    });
});
