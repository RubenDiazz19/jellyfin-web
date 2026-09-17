import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWatched, useWatchedVersion } from '../useWatched';
import { renderHook } from './testUtils';
import { WATCHED } from '../../stores';
import * as useStoreModule from '../useStore';

vi.mock('../useStore', () => ({
    useStoreValue: vi.fn(),
    useStoreVersion: vi.fn()
}));

describe('useWatched hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(WATCHED, 'toggle').mockImplementation(() => {});
    });

    it('returns the watched status and a toggle function', () => {
        vi.spyOn(useStoreModule, 'useStoreValue').mockReturnValue(false);

        const [isWatched, toggleWatched] = useWatched('item-456');
        expect(isWatched).toBe(false);

        toggleWatched();
        expect(WATCHED.toggle).toHaveBeenCalledWith('item-456');
    });

    it('passes the correct read callback to useStoreValue', () => {
        const useStoreValueSpy = vi.spyOn(useStoreModule, 'useStoreValue').mockReturnValue(true);
        renderHook(() => useWatched('item-456'));

        const readCallback = useStoreValueSpy.mock.calls[0][2];
        vi.spyOn(WATCHED, 'has').mockReturnValue(true);
        expect(readCallback()).toBe(true);
    });
});

describe('useWatchedVersion hook', () => {
    it('returns the store version for a specific scope', () => {
        vi.spyOn(useStoreModule, 'useStoreVersion').mockReturnValue(42);

        const version = useWatchedVersion('series-1');

        expect(useStoreModule.useStoreVersion).toHaveBeenCalledWith(WATCHED.event, 'series-1');
        expect(version).toBe(42);
    });
});
