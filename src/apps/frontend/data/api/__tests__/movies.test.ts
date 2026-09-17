import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMovies, getMovie, getMovieSaga } from '../movies';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';
import { WATCHED } from '../../stores/watchedStore';
import * as deletedModule from '../deleted';

vi.mock('../http');
vi.mock('../../session/session');
vi.mock('../../stores/watchedStore', () => ({
    WATCHED: { sync: vi.fn() }
}));
vi.mock('../deleted');
vi.mock('../listCache', () => ({
    cachedList: vi.fn((key, fetcher) => fetcher()),
    invalidateLists: vi.fn()
}));

describe('movies API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getMovies fetches and maps movies, and syncs watched state', async () => {
        vi.mocked(httpModule.fetchUserItems).mockResolvedValueOnce([
            { Id: 'm1', Name: 'Movie 1', UserData: { Played: true } }
        ]);

        const movies = await getMovies();

        expect(movies).toHaveLength(1);
        expect(movies[0].title).toBe('Movie 1');
        expect(movies[0].watched).toBe(1);

        expect(WATCHED.sync).toHaveBeenCalledWith(['movie-m1'], ['movie-m1']);
    });

    it('getMovie fetches single movie and syncs watched state', async () => {
        vi.mocked(deletedModule.isDeleted).mockReturnValue(false);
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            Id: 'm2', Name: 'Movie 2', UserData: { Played: false }
        });

        const movie = await getMovie('m2');

        expect(movie.title).toBe('Movie 2');
        expect(movie.watched).toBe(0);

        expect(WATCHED.sync).toHaveBeenCalledWith(['movie-m2'], []);
    });

    it('getMovie throws if item is deleted', async () => {
        vi.mocked(deletedModule.isDeleted).mockReturnValue(true);
        vi.mocked(deletedModule.itemGoneError).mockReturnValue(new Error('Gone'));

        await expect(getMovie('m3')).rejects.toThrow('Gone');
    });

    it('getMovieSaga fetches ancestors and boxset items', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);

        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce([
            { Id: 'box1', Name: 'The Boxset', Type: 'BoxSet' }
        ]);

        vi.mocked(httpModule.fetchUserItems).mockResolvedValueOnce([
            { Id: 'm1', Name: 'Part 1' },
            { Id: 'm2', Name: 'Part 2' }
        ]);

        const saga = await getMovieSaga('m1');

        expect(saga?.id).toBe('box1');
        expect(saga?.name).toBe('The Boxset');
        expect(saga?.items).toHaveLength(2);
    });

    it('getMovieSaga returns null if no boxset', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce([]); // No ancestors

        const saga = await getMovieSaga('m1');
        expect(saga).toBeNull();
    });
});
