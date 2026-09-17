import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInLists, useListsSync, useListSync } from '../useLists';
import { LISTS } from '../../stores';
import * as useStoreModule from '../useStore';
import { renderHook } from './testUtils';

vi.mock('../useStore', () => ({
    useStoreValue: vi.fn()
}));

describe('useInLists hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(LISTS, 'ensure').mockResolvedValue(undefined);
    });

    it('ensures LISTS are loaded and returns the in-list state', () => {
        vi.spyOn(useStoreModule, 'useStoreValue').mockReturnValue({ inAny: true, keys: ['list-1'] });

        const { result } = renderHook(() => useInLists('item-1'));

        expect(LISTS.ensure).toHaveBeenCalled();
        expect(result.current).toEqual({ inAny: true, keys: ['list-1'] });
    });

    it('passes the correct read callback to useStoreValue', () => {
        const useStoreValueSpy = vi.spyOn(useStoreModule, 'useStoreValue').mockReturnValue({ inAny: true, keys: [] });
        renderHook(() => useInLists('item-2'));

        const readCallback = useStoreValueSpy.mock.calls[0][2];

        vi.spyOn(LISTS, 'has').mockReturnValue(true);
        vi.spyOn(LISTS, 'keysOf').mockReturnValue(['list-A', 'list-B']);

        expect(readCallback()).toEqual({ inAny: true, keys: ['list-A', 'list-B'] });
    });
});

describe('useListsSync hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(LISTS, 'all').mockReturnValue([]);
        vi.spyOn(LISTS, 'refresh').mockResolvedValue(undefined);
    });

    it('initializes and synchronizes with LISTS.event', () => {
        const { result } = renderHook(() => useListsSync());

        expect(LISTS.all).toHaveBeenCalled();
        expect(LISTS.refresh).toHaveBeenCalled();

        expect(result.current.lists).toEqual([]);
        expect(result.current.loading).toBe(true); // wait for promise to settle in actual environment (mocked here, state settles differently)
        expect(typeof result.current.refresh).toBe('function');
    });
});

describe('useListSync hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(LISTS, 'find').mockReturnValue(undefined);
        vi.spyOn(LISTS, 'ensure').mockResolvedValue(undefined);
    });

    it('finds the specific list and listens for changes', () => {
        const { result } = renderHook(() => useListSync('playlist', 'pl-1'));

        expect(LISTS.find).toHaveBeenCalledWith('playlist', 'pl-1');
        expect(LISTS.ensure).toHaveBeenCalled();
        expect(result.current.list).toBeUndefined();
        expect(typeof result.current.refresh).toBe('function');
    });
});
