// El corte que impide pedir la ficha de un item recién borrado.
//
// Avisar uno a uno a los que piden fichas es la parte frágil del asunto:
// basta con que aparezca un llamante nuevo para que el 404 vuelva. Aquí se
// prueba el corte de abajo, que no depende de que nadie se entere de nada.

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { _resetDeleted, isDeleted, markDeleted } from '../deleted';

const TTL_MS = 10 * 60 * 1000;

beforeEach(() => {
    _resetDeleted();
    vi.useRealTimers();
});

describe('items borrados', () => {
    test('lo no borrado se pide con normalidad', () => {
        expect(isDeleted('m1')).toBe(false);
    });

    test('lo borrado deja de pedirse', () => {
        markDeleted('m1');
        expect(isDeleted('m1')).toBe(true);
    });

    test('la marca es de ese id, no de todos', () => {
        markDeleted('m1');
        expect(isDeleted('m2')).toBe(false);
    });

    test('la marca caduca', () => {
        // Jellyfin deriva el id del contenido: volver a meter el mismo fichero
        // y reescanear devuelve el MISMO id, así que recordarlo para siempre
        // dejaría la ficha inaccesible sin motivo.
        vi.useFakeTimers();
        markDeleted('m1');
        vi.advanceTimersByTime(TTL_MS + 1);
        expect(isDeleted('m1')).toBe(false);
    });

    test('dentro del plazo sigue marcado', () => {
        vi.useFakeTimers();
        markDeleted('m1');
        vi.advanceTimersByTime(TTL_MS - 1000);
        expect(isDeleted('m1')).toBe(true);
    });
});
