// Tests del caché de series: TTL de 5 minutos, alcance por usuario e
// invalidación por mutación.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearShowCache, showCache } from '../cache';
import type { Show } from '../../models';

const fakeShow = Promise.resolve({ id: 's1' } as Show);
const USER = 'u1';

describe('showCache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearShowCache();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('devuelve la entrada dentro del TTL', () => {
        showCache.set(USER, 's1', fakeShow);
        vi.advanceTimersByTime(4 * 60_000);
        expect(showCache.get(USER, 's1')).toBe(fakeShow);
    });

    test('expira pasados 5 minutos', () => {
        showCache.set(USER, 's1', fakeShow);
        vi.advanceTimersByTime(5 * 60_000 + 1);
        expect(showCache.get(USER, 's1')).toBeUndefined();
    });

    test('delete y clear invalidan', () => {
        showCache.set(USER, 's1', fakeShow);
        showCache.delete(USER, 's1');
        expect(showCache.get(USER, 's1')).toBeUndefined();

        showCache.set(USER, 's2', fakeShow);
        clearShowCache();
        expect(showCache.get(USER, 's2')).toBeUndefined();
    });

    // Un Show lleva visto/progreso del usuario: si la clave fuese solo el id,
    // cambiar de cuenta en la misma pestaña serviría los datos del anterior.
    test('la misma serie no se comparte entre usuarios', () => {
        showCache.set(USER, 's1', fakeShow);
        expect(showCache.get('u2', 's1')).toBeUndefined();
    });

    test('invalidar para un usuario no toca la entrada del otro', () => {
        const otherShow = Promise.resolve({ id: 's1' } as Show);
        showCache.set(USER, 's1', fakeShow);
        showCache.set('u2', 's1', otherShow);
        showCache.delete(USER, 's1');
        expect(showCache.get('u2', 's1')).toBe(otherShow);
    });
});
