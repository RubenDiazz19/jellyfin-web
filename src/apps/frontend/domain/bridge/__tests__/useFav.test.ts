import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFav, useFavListener } from '../useFav';
import { renderHook } from './testUtils';
import { FAVS } from '../../stores';
import * as useStoreModule from '../useStore';

vi.mock('../useStore', () => ({
    useStoreValue: vi.fn(),
    useStoreListener: vi.fn()
}));

describe('useFav hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(FAVS, 'setMany').mockImplementation(() => {});
        vi.spyOn(FAVS, 'has').mockImplementation(() => false);
    });

    it('returns the fav status and a setter', () => {
        vi.spyOn(useStoreModule, 'useStoreValue').mockReturnValue(true);

        const [isFav, setFav] = useFav('item-123');
        expect(isFav).toBe(true);

        setFav(false);
        expect(FAVS.setMany).toHaveBeenCalledWith(['item-123'], false);
    });

    it('passes the correct read callback to useStoreValue', () => {
        const useStoreValueSpy = vi.spyOn(useStoreModule, 'useStoreValue').mockReturnValue(true);
        renderHook(() => useFav('item-123'));

        const readCallback = useStoreValueSpy.mock.calls[0][2];
        vi.spyOn(FAVS, 'has').mockReturnValue(true);
        expect(readCallback()).toBe(true);

        vi.spyOn(FAVS, 'has').mockReturnValue(false);
        expect(readCallback()).toBe(false);
    });
});

describe('useFavListener hook', () => {
    it('subscribes to FAVS.event', () => {
        const callback = vi.fn();
        useFavListener(callback);

        expect(useStoreModule.useStoreListener).toHaveBeenCalledWith(FAVS.event, callback);
    });
});
