import { describe, it, expect, vi } from 'vitest';
import { getItemImageInfos, setImageByUrl, deleteImage, moveImage, uploadImageFile, getRemoteImages } from '../remote-images';
import * as httpModule from '../http';
import * as cacheModule from '../cache';
import * as mutationsModule from '../mutations';

vi.mock('../http');
vi.mock('../cache');
vi.mock('../mutations');

describe('remote-images API', () => {
    it('getItemImageInfos fetches image infos', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce([{ ImageType: 'Primary' }]);
        const res = await getItemImageInfos('item1');
        expect(res).toHaveLength(1);
    });

    it('setImageByUrl sends post, waits, and clears cache', async () => {
        vi.useFakeTimers();
        const p = setImageByUrl('item1', 'Primary', 'http://img');

        await Promise.resolve(); // flush microtasks so setTimeout is queued
        expect(httpModule.apiSend).toHaveBeenCalledWith('/Items/item1/RemoteImages/Download?Type=Primary&ImageUrl=http%3A%2F%2Fimg', 'POST');

        vi.runAllTimers();
        await p;

        expect(cacheModule.clearShowCache).toHaveBeenCalled();
        expect(mutationsModule.emitItemMutated).toHaveBeenCalledWith('item1');
        vi.useRealTimers();
    });

    it('deleteImage sends delete', async () => {
        await deleteImage('item1', 'Primary', 1);
        expect(httpModule.apiSend).toHaveBeenCalledWith('/Items/item1/Images/Primary/1', 'DELETE');
        expect(mutationsModule.emitItemMutated).toHaveBeenCalledWith('item1');
    });

    it('moveImage sends post', async () => {
        await moveImage('item1', 'Primary', 0, 1);
        expect(httpModule.apiSend).toHaveBeenCalledWith('/Items/item1/Images/Primary/0/Index?newIndex=1', 'POST');
    });

    it('uploadImageFile uploads file and emits mutation', async () => {
        const file = new File([], 'img.jpg');
        await uploadImageFile('item1', 'Primary', file);
        expect(httpModule.uploadImage).toHaveBeenCalledWith('/Items/item1/Images/Primary', file);
    });

    it('getRemoteImages fetches remote images', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({ Images: [{ Url: 'http://rem' }], Providers: ['TMDB'] });
        const res = await getRemoteImages('item1', 'Primary');
        expect(res.images).toHaveLength(1);
        expect(res.providers).toHaveLength(1);
    });
});
