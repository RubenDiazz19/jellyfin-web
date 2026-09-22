import { describe, it, expect } from 'vitest';
import { LoadGuard } from '../loadGuard';

describe('LoadGuard', () => {
    it('returns true for a single load', () => {
        const guard = new LoadGuard();
        const isValid = guard.begin();
        expect(isValid()).toBe(true);
    });

    it('returns false for the first load if a second one starts', () => {
        const guard = new LoadGuard();
        const isValidFirst = guard.begin();
        const isValidSecond = guard.begin();

        expect(isValidFirst()).toBe(false);
        expect(isValidSecond()).toBe(true);
    });

    it('always considers the latest load valid', () => {
        const guard = new LoadGuard();
        guard.begin();
        guard.begin();
        const isValidLast = guard.begin();

        expect(isValidLast()).toBe(true);
    });
});
