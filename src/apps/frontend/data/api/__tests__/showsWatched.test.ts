// La clave de «visto» de una serie.
//
// El fallo que esto fija: «serie vista» tenía dos representaciones locales sin
// reconciliar —la clave suelta de la serie y el conjunto de sus episodios— y
// cada pantalla leía la que tuviera a mano. La tarjeta de la Home no puede
// agregar nada (no tiene episodios cargados), así que depende de que el
// listado hidrate la clave de la serie; la ficha sí agrega y de ahí tiene que
// salir la misma respuesta.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchUserItems: vi.fn(),
    apiFetch: vi.fn(),
    loadSession: vi.fn(() => ({ userId: 'u1', accessToken: 'tok' }))
}));

vi.mock('../http', () => ({
    fetchUserItems: mocks.fetchUserItems,
    apiFetch: mocks.apiFetch,
    noSessionError: () => new Error('sin sesión')
}));
vi.mock('../../session/session', () => ({ loadSession: mocks.loadSession }));
vi.mock('../playback', () => ({ settlePlaybackReports: () => Promise.resolve() }));

import { getShows } from '../shows';
import { invalidateLists } from '../listCache';
import { WATCHED } from '../../stores/watchedStore';

/** Un item de serie tal como lo devuelve el servidor para la rejilla. */
function seriesItem(id: string, played: boolean) {
    return {
        Id: id,
        Name: `Serie ${id}`,
        Type: 'Series',
        UserData: { Played: played }
    };
}

beforeEach(() => {
    WATCHED._reset();
    localStorage.clear();
    invalidateLists();
    mocks.fetchUserItems.mockReset();
});

describe('hidratación del «visto» de las series', () => {
    test('el listado marca en local las series que el servidor da por vistas', async () => {
        mocks.fetchUserItems.mockResolvedValue([
            seriesItem('vista', true),
            seriesItem('pendiente', false)
        ]);

        await getShows();

        expect(WATCHED.has('vista')).toBe(true);
        expect(WATCHED.has('pendiente')).toBe(false);
    });

    test('el listado también DESMARCA lo que el servidor ya no da por visto', async () => {
        // Estado local heredado: se marcó desde una tarjeta y nadie lo
        // reconciliaba nunca, así que quedaba pegado para siempre.
        WATCHED.setMany(['vieja'], true);
        mocks.fetchUserItems.mockResolvedValue([seriesItem('vieja', false)]);

        await getShows();

        expect(WATCHED.has('vieja')).toBe(false);
    });

    test('no toca las series que no vienen en el listado', async () => {
        WATCHED.setMany(['de-otra-biblioteca'], true);
        mocks.fetchUserItems.mockResolvedValue([seriesItem('vista', true)]);

        await getShows();

        expect(WATCHED.has('de-otra-biblioteca')).toBe(true);
    });

    test('expone el agregado del servidor en el modelo', async () => {
        mocks.fetchUserItems.mockResolvedValue([
            seriesItem('vista', true),
            seriesItem('pendiente', false)
        ]);

        const shows = await getShows();

        expect(shows.find((s) => s.id === 'vista')?.watched).toBe(1);
        expect(shows.find((s) => s.id === 'pendiente')?.watched).toBe(0);
    });
});
