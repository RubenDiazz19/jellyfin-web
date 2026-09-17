import { describe, it, expect, vi } from 'vitest';
import { markPlayed, toggleFavorite, refreshItemMetadata, deleteItem, downloadUrl, nativeItemUrl } from '../items';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';
import * as cacheModule from '../cache';
import * as mutationsModule from '../mutations';
import * as deletedModule from '../deleted';

vi.mock('../http', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../http')>();
    return {
        ...actual,
        apiSend: vi.fn(),
        uploadImage: vi.fn()
    };
});
vi.mock('../../session/session');
vi.mock('../cache');
vi.mock('../mutations');
vi.mock('../deleted');

describe('items API', () => {
    it('markPlayed posts or deletes to playedItems', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        await markPlayed('item1', true);

        expect(httpModule.apiSend).toHaveBeenCalledWith('/Users/u1/PlayedItems/item1', 'POST');
        expect(cacheModule.clearShowCache).toHaveBeenCalled();
        expect(mutationsModule.emitItemMutated).toHaveBeenCalledWith('item1');

        await markPlayed('item1', false);
        expect(httpModule.apiSend).toHaveBeenCalledWith('/Users/u1/PlayedItems/item1', 'DELETE');
    });

    it('toggleFavorite posts or deletes to favoriteItems', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        await toggleFavorite('item1', true);

        expect(httpModule.apiSend).toHaveBeenCalledWith('/Users/u1/FavoriteItems/item1', 'POST');

        await toggleFavorite('item1', false);
        expect(httpModule.apiSend).toHaveBeenCalledWith('/Users/u1/FavoriteItems/item1', 'DELETE');
    });

    it('refreshItemMetadata configures correct query params', async () => {
        await refreshItemMetadata('item1', { mode: 'all', replaceImages: true, replaceTrickplay: true });

        expect(httpModule.apiSend).toHaveBeenCalledWith(
            expect.stringContaining('metadataRefreshMode=FullRefresh'),
            'POST'
        );
        expect(httpModule.apiSend).toHaveBeenCalledWith(
            expect.stringContaining('replaceAllMetadata=true'),
            'POST'
        );
        expect(httpModule.apiSend).toHaveBeenCalledWith(
            expect.stringContaining('replaceAllImages=true'),
            'POST'
        );
        expect(mutationsModule.emitItemMutated).toHaveBeenCalledWith('item1');

        await refreshItemMetadata('item1', { mode: 'scan' });
        expect(httpModule.apiSend).toHaveBeenCalledWith(
            expect.stringContaining('metadataRefreshMode=Default'),
            'POST'
        );
        expect(httpModule.apiSend).toHaveBeenCalledWith(
            expect.stringContaining('replaceAllImages=false'),
            'POST'
        );
    });

    it('deleteItem calls API and marks deleted', async () => {
        await deleteItem('item1');

        expect(httpModule.apiSend).toHaveBeenCalledWith('/Items/item1', 'DELETE');
        expect(deletedModule.markDeleted).toHaveBeenCalledWith('item1');
        expect(cacheModule.clearShowCache).toHaveBeenCalled();
        expect(mutationsModule.emitItemDeleted).toHaveBeenCalledWith('item1');
    });

    it('downloadUrl constructs correct URL', () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ serverUrl: 'http://srv', accessToken: 'token1' } as any);
        expect(downloadUrl('item1')).toBe('http://srv/Items/item1/Download?api_key=token1');
    });

    it('nativeItemUrl constructs correct URL', () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ serverUrl: 'http://srv', serverId: 'server1' } as any);
        expect(nativeItemUrl('item1')).toBe('http://srv/web/#/details?id=item1&serverId=server1');
    });
});
