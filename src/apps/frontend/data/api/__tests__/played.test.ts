import { describe, it, expect, vi } from 'vitest';
import { getMostPlayed } from '../played';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';

vi.mock('../http');
vi.mock('../listCache', () => ({
    cachedList: vi.fn((key, fetcher) => fetcher()),
    invalidateLists: vi.fn()
}));
vi.mock('../../session/session');

describe('played API', () => {
    it('getMostPlayed calls apiFetch with correct limit and maps items', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            Items: [{ Id: '1', Name: 'Movie 1', Type: 'Movie' }]
        });

        const items = await getMostPlayed(5);
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('1');
        expect(items[0].title).toBe('Movie 1');

        expect(httpModule.apiFetch).toHaveBeenCalledWith(expect.stringContaining('Limit=5'));
    });

    it('getMostPlayed handles empty items and fallback array', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);

        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce([]);
        let items = await getMostPlayed();
        expect(items).toEqual([]);

        vi.mocked(httpModule.apiFetch).mockRejectedValueOnce(new Error('fail'));
        items = await getMostPlayed();
        expect(items).toEqual([]);
    });
});
