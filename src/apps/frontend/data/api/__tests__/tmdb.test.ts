import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTmdbConfigured, searchTmdbCharacters } from '../tmdb';

describe('tmdb API', () => {
    /* eslint-disable @typescript-eslint/naming-convention -- formato de la API de TMDB */
    let globalFetch: any;

    beforeEach(() => {
        globalFetch = vi.fn();
        vi.stubGlobal('fetch', globalFetch);
        vi.stubEnv('VITE_TMDB_API_KEY', 'my-key');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('isTmdbConfigured returns true if key exists', () => {
        expect(isTmdbConfigured()).toBe(true);
        vi.stubEnv('VITE_TMDB_API_KEY', '');
        expect(isTmdbConfigured()).toBe(false);
    });

    it('searchTmdbCharacters returns empty if no key', async () => {
        vi.stubEnv('VITE_TMDB_API_KEY', '');
        expect(await searchTmdbCharacters('char')).toEqual([]);
    });

    it('searchTmdbCharacters performs multi search and gets credits', async () => {
        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                results: [
                    { id: 1, 'media_type': 'movie', title: 'Movie 1' },
                    { id: 2, 'media_type': 'person', name: 'Actor 1' } // should be filtered out
                ]
            })
        });

        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                cast: [
                    { id: 10, name: 'Actor 1', character: 'Char 1', 'profile_path': '/img1.jpg' },
                    { id: 11, name: 'Actor 2', 'profile_path': null } // should be filtered out
                ]
            })
        });

        const res = await searchTmdbCharacters('movie');

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('tmdb-1-10');
        expect(res[0].name).toBe('Char 1');
        expect(res[0].subtitle).toBe('Movie 1 · Actor 1');
        expect(res[0].imageUrl).toBe('https://image.tmdb.org/t/p/h632/img1.jpg');
        expect(res[0].source).toBe('tmdb');
    });
    /* eslint-enable @typescript-eslint/naming-convention */
});
