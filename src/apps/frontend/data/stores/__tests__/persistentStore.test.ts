// Escrituras por lotes: la caché en memoria y el evento van síncronos, y lo
// único que se aplaza es serializar a localStorage.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createSetStore, flushPersistentStores } from '../persistentStore';

const KEY = 'jfp-test-lotes';

function makeStore() {
    return createSetStore({ key: KEY, event: 'jfp-test-lotes-change' });
}

const stored = () => JSON.parse(localStorage.getItem(KEY) || 'null') as string[] | null;

beforeEach(() => {
    vi.useFakeTimers();
    flushPersistentStores();
    localStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('persistencia diferida', () => {
    test('la lectura del store no espera al disco', () => {
        const store = makeStore();
        store.add(['a']);
        // Aún no ha tocado localStorage…
        expect(stored()).toBeNull();
        // …pero el store ya responde con el valor nuevo.
        expect(store.has('a')).toBe(true);
    });

    test('varias mutaciones seguidas se escriben una sola vez', () => {
        const store = makeStore();
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        store.add(['a']);
        store.add(['b']);
        store.add(['c']);
        expect(setItem).not.toHaveBeenCalled();

        vi.advanceTimersByTime(500);
        expect(setItem).toHaveBeenCalledTimes(1);
        expect(stored()).toEqual(['a', 'b', 'c']);
    });

    test('el evento de cambio sí es inmediato', () => {
        const store = makeStore();
        const seen = vi.fn();
        window.addEventListener('jfp-test-lotes-change', seen);
        store.add(['a']);
        window.removeEventListener('jfp-test-lotes-change', seen);
        expect(seen).toHaveBeenCalledTimes(1);
    });

    test('ocultar la página vuelca lo pendiente', () => {
        const store = makeStore();
        store.add(['a']);
        expect(stored()).toBeNull();

        Object.defineProperty(document, 'visibilityState', {
            value: 'hidden', configurable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));

        expect(stored()).toEqual(['a']);
        Object.defineProperty(document, 'visibilityState', {
            value: 'visible', configurable: true
        });
    });

    test('_reset() descarta lo pendiente: tras un clear() el store queda vacío', () => {
        const store = makeStore();
        store.add(['a']);
        localStorage.clear();
        store._reset();
        vi.advanceTimersByTime(500);

        expect(store.has('a')).toBe(false);
        expect(stored()).toBeNull();
    });
});
