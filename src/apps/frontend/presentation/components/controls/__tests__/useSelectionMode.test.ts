import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useSelectionMode } from '../useSelectionMode';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import { selectionVM } from '../../../../domain/viewModels/SelectionViewModel';

describe('useSelectionMode', () => {
    const mockItem = { id: 'item-1', kind: 'movie' as const, title: 'Movie 1' };

    beforeEach(() => {
        vi.clearAllMocks();
        selectionVM.selecting.value = false;
        selectionVM.selected.value = [];
    });

    it('navega al hacer click si el modo selección no está activo', () => {
        const navigate = vi.fn();
        const toggleSpy = vi.spyOn(selectionVM, 'toggle').mockImplementation(() => {});

        const hook = renderHook(() => useSelectionMode(mockItem, navigate));

        expect(hook.result.current.selecting).toBe(false);
        expect(hook.result.current.selected).toBe(false);

        act(() => {
            hook.result.current.onClick();
        });

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(toggleSpy).not.toHaveBeenCalled();
        hook.unmount();
    });

    it('alterna la selección del item si el modo selección está activo', () => {
        const navigate = vi.fn();
        const toggleSpy = vi.spyOn(selectionVM, 'toggle').mockImplementation(() => {});

        selectionVM.selecting.value = true;
        selectionVM.selected.value = [mockItem];

        const hook = renderHook(() => useSelectionMode(mockItem, navigate));

        expect(hook.result.current.selecting).toBe(true);
        expect(hook.result.current.selected).toBe(true);

        act(() => {
            hook.result.current.onClick();
        });

        expect(toggleSpy).toHaveBeenCalledWith(mockItem);
        expect(navigate).not.toHaveBeenCalled();
        hook.unmount();
    });
});
