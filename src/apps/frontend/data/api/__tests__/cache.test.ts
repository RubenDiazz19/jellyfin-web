// Tests del caché de series: TTL de 5 minutos + invalidación por mutación.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearShowCache, showCache } from '../cache';
import type { Show } from '../../models';

const fakeShow = Promise.resolve({ id: 's1' } as Show);

describe('showCache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearShowCache();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('devuelve la entrada dentro del TTL', () => {
        showCache.set('s1', fakeShow);
        vi.advanceTimersByTime(4 * 60_000);
        expect(showCache.get('s1')).toBe(fakeShow);
    });

    test('expira pasados 5 minutos', () => {
        showCache.set('s1', fakeShow);
        vi.advanceTimersByTime(5 * 60_000 + 1);
        expect(showCache.get('s1')).toBeUndefined();
    });

    test('delete y clear invalidan', () => {
        showCache.set('s1', fakeShow);
        showCache.delete('s1');
        expect(showCache.get('s1')).toBeUndefined();

        showCache.set('s2', fakeShow);
        clearShowCache();
        expect(showCache.get('s2')).toBeUndefined();
    });
});
