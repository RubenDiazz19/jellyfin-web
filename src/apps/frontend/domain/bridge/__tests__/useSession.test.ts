import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSession } from '../useSession';
import { sessionVM } from '../../viewModels/SessionViewModel';
import * as useViewModelModule from '../useViewModel';
import { renderHook } from './testUtils';
import { signal } from '@preact/signals-core';

vi.mock('../useViewModel', () => ({
    useViewModel: vi.fn()
}));

describe('useSession hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(sessionVM, 'hydrate').mockImplementation(() => {});
        vi.spyOn(sessionVM, 'start').mockImplementation(() => { return () => {}; });

        // Mock signals on sessionVM
        sessionVM.session = signal(null) as any;
        sessionVM.hydrating = signal(false) as any;
        sessionVM.logout = vi.fn();
    });

    it('hydrates and starts the session view model', () => {
        const { result } = renderHook(() => useSession());

        expect(sessionVM.hydrate).toHaveBeenCalled();
        expect(useViewModelModule.useViewModel).toHaveBeenCalledWith(sessionVM);
        expect(sessionVM.start).toHaveBeenCalled(); // called in useEffect

        expect(result.current.session).toBeNull();
        expect(result.current.hydrating).toBe(false);
        expect(result.current.logout).toBe(sessionVM.logout);
    });

    it('returns the current session values', () => {
        const mockSession = { username: 'test', serverUrl: 'http://test' };
        sessionVM.session = signal(mockSession) as any;
        sessionVM.hydrating = signal(true) as any;

        const { result } = renderHook(() => useSession());

        expect(result.current.session).toEqual(mockSession);
        expect(result.current.hydrating).toBe(true);
    });
});
