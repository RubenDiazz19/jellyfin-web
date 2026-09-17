import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getShows, getShow } from '../shows';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';
import { WATCHED } from '../../stores/watchedStore';
import * as deletedModule from '../deleted';
import { showCache } from '../cache';

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
vi.mock('../cache', () => ({
    showCache: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
}));

describe('shows API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getShows fetches and maps shows, and syncs watched state', async () => {
        vi.mocked(httpModule.fetchUserItems).mockResolvedValueOnce([
            { Id: 's1', Name: 'Show 1', UserData: { Played: true } }
        ]);

        const shows = await getShows();

        expect(shows).toHaveLength(1);
        expect(shows[0].title).toBe('Show 1');
        expect(shows[0].watched).toBe(1);

        // It syncs the show ID
        expect(WATCHED.sync).toHaveBeenCalledWith(['s1'], ['s1']);
    });

    it('getShow throws if item is deleted', async () => {
        vi.mocked(deletedModule.isDeleted).mockReturnValue(true);
        vi.mocked(deletedModule.itemGoneError).mockReturnValue(new Error('Gone'));

        await expect(getShow('s1')).rejects.toThrow('Gone');
    });

    it('getShow returns from cache if available', async () => {
        vi.mocked(deletedModule.isDeleted).mockReturnValue(false);
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        vi.mocked(showCache.get as any).mockReturnValueOnce(Promise.resolve({ title: 'Cached' }));

        const show = await getShow('s1');

        expect(show.title).toBe('Cached');
        expect(httpModule.apiFetch).not.toHaveBeenCalled();
    });

    it('getShow fetches show and episodes, and computes runtime and progress', async () => {
        vi.mocked(deletedModule.isDeleted).mockReturnValue(false);
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        vi.mocked(showCache.get as any).mockReturnValueOnce(undefined);

        // Mock main show fetch
        vi.mocked(httpModule.apiFetch)
            .mockResolvedValueOnce({ Id: 's1', Name: 'Show 1' }) // show
            .mockResolvedValueOnce({ Items: [{ Id: 'sea1', IndexNumber: 1 }] }) // seasons
            .mockResolvedValueOnce({
                Items: [
                    { Id: 'ep1', Name: 'Ep 1', ParentIndexNumber: 1, IndexNumber: 1, UserData: { Played: true }, RunTimeTicks: 600000000 },
                    { Id: 'ep2', Name: 'Ep 2', ParentIndexNumber: 1, IndexNumber: 2, UserData: { Played: false }, RunTimeTicks: 600000000 }
                ]
            }); // episodes

        const show = await getShow('s1');

        expect(show.title).toBe('Show 1');
        expect(show.seasons).toHaveLength(1);
        expect(show.seasons[0].episodes).toHaveLength(2);

        // Progress for incomplete episode
        expect(show.cont).toBeDefined();
        expect(show.cont?.epN).toBe(2);

        // Verify cache set
        expect(showCache.set).toHaveBeenCalledWith('u1', 's1', expect.any(Promise));

        // Verify WATCHED sync
        expect(WATCHED.sync).toHaveBeenCalled();
    });
});
