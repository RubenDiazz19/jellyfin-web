import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mutationOnLoad, MUTATION_DEBOUNCE_MS } from '../mutationSubscription';
import { ITEM_MUTATED_EVENT } from '../../../data/api/mutations';

describe('mutationOnLoad', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('subscribes to window events and triggers callback without debounce', () => {
        const cb = vi.fn();
        const start = mutationOnLoad(cb);
        start();

        window.dispatchEvent(new CustomEvent(ITEM_MUTATED_EVENT, { detail: { itemId: '1' } }));
        expect(cb).toHaveBeenCalledWith({ itemId: '1' });
    });

    it('debounces calls if requested', () => {
        const cb = vi.fn();
        const start = mutationOnLoad(cb, { debounce: true });
        start();

        window.dispatchEvent(new CustomEvent(ITEM_MUTATED_EVENT, { detail: { itemId: '1' } }));
        window.dispatchEvent(new CustomEvent(ITEM_MUTATED_EVENT, { detail: { itemId: '2' } }));

        expect(cb).not.toHaveBeenCalled();

        vi.advanceTimersByTime(MUTATION_DEBOUNCE_MS);

        // Only called once with the detail of the last event
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({ itemId: '2' });
    });
});
