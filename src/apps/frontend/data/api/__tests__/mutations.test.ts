import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emitItemMutated, emitItemDeleted, emitListsRefreshed, ITEM_MUTATED_EVENT } from '../mutations';
import * as listCacheModule from '../listCache';
import * as playbackCacheModule from '../playbackCache';

vi.mock('../listCache');
vi.mock('../playbackCache');

describe('mutations API', () => {
    let dispatchSpy: any;

    beforeEach(() => {
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        vi.clearAllMocks();
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
    });

    it('emitItemMutated invalidates caches and dispatches event', () => {
        emitItemMutated('item1');

        expect(listCacheModule.invalidateLists).toHaveBeenCalled();
        expect(playbackCacheModule.invalidatePlayback).toHaveBeenCalledWith('item1');

        expect(dispatchSpy).toHaveBeenCalled();
        const event = dispatchSpy.mock.calls[0][0];
        expect(event.type).toBe(ITEM_MUTATED_EVENT);
        expect(event.detail).toEqual({ itemId: 'item1', deleted: undefined });
    });

    it('emitItemDeleted invalidates caches and dispatches event with deleted true', () => {
        emitItemDeleted('item1');

        expect(listCacheModule.invalidateLists).toHaveBeenCalled();
        expect(playbackCacheModule.invalidatePlayback).toHaveBeenCalledWith('item1');

        expect(dispatchSpy).toHaveBeenCalled();
        const event = dispatchSpy.mock.calls[0][0];
        expect(event.type).toBe(ITEM_MUTATED_EVENT);
        expect(event.detail).toEqual({ itemId: 'item1', deleted: true });
    });

    it('emitListsRefreshed dispatches event without invalidating caches', () => {
        emitListsRefreshed();

        expect(listCacheModule.invalidateLists).not.toHaveBeenCalled();
        expect(playbackCacheModule.invalidatePlayback).not.toHaveBeenCalled();

        expect(dispatchSpy).toHaveBeenCalled();
        const event = dispatchSpy.mock.calls[0][0];
        expect(event.type).toBe(ITEM_MUTATED_EVENT);
        expect(event.detail).toEqual({});
    });
});
