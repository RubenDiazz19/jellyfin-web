import { describe, it, expect } from 'vitest';
import { loadingError } from '../loadingState';

describe('loadingState', () => {
    it('initializes with loading: false by default', () => {
        const state = loadingError();
        expect(state.loading.value).toBe(false);
        expect(state.error.value).toBe(null);
    });

    it('initializes with loading: true if provided', () => {
        const state = loadingError(true);
        expect(state.loading.value).toBe(true);
        expect(state.error.value).toBe(null);
    });

    it('returns mutable preact signals', () => {
        const state = loadingError();

        state.loading.value = true;
        expect(state.loading.value).toBe(true);

        state.error.value = 'Network error';
        expect(state.error.value).toBe('Network error');
    });
});
