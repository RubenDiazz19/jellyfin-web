import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchUserItems: vi.fn()
}));

vi.mock('../http', () => ({
    fetchUserItems: mocks.fetchUserItems,
    apiFetch: vi.fn(),
    noSessionError: () => new Error('sin sesión')
}));

vi.mock('../session/session', () => ({ loadSession: () => ({ userId: 'u1' }) }));
vi.mock('../../session/session', () => ({ loadSession: () => ({ userId: 'u1' }) }));
vi.mock('../playback', () => ({ settlePlaybackReports: () => Promise.resolve() }));

import { getByGenre } from '../discover';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getByGenre', () => {
    test('consulta tanto Genres como Tags y fusiona resultados deduplicando por Id', async () => {
        mocks.fetchUserItems.mockImplementation(async (query: string) => {
            if (query.includes('Genres=Romance')) {
                return [
                    { Id: 's1', Name: 'Toradora', Type: 'Series', Genres: ['Romance'] }
                ];
            }
            if (query.includes('Tags=Romance')) {
                return [
                    { Id: 's1', Name: 'Toradora', Type: 'Series', Genres: ['Romance'] }, // duplicado
                    { Id: 'm1', Name: 'Your Name', Type: 'Movie', Tags: ['Romance'] }
                ];
            }
            return [];
        });

        const slice = await getByGenre('Romance');

        expect(slice.shows).toHaveLength(1);
        expect(slice.shows[0].id).toBe('s1');
        expect(slice.movies).toHaveLength(1);
        expect(slice.movies[0].id).toBe('m1');
    });

    test('soporta variantes de género (español e inglés)', async () => {
        mocks.fetchUserItems.mockImplementation(async (query: string) => {
            if (query.includes('Genres=Acci%C3%B3n')) {
                return [{ Id: 'm1', Name: 'Peli Acción ES', Type: 'Movie' }];
            }
            if (query.includes('Genres=Action')) {
                return [{ Id: 'm2', Name: 'Peli Acción EN', Type: 'Movie' }];
            }
            return [];
        });

        const slice = await getByGenre('Acción', ['Acción', 'Action']);

        expect(slice.movies).toHaveLength(2);
        const ids = slice.movies.map((m) => m.id);
        expect(ids).toContain('m1');
        expect(ids).toContain('m2');
    });
});
