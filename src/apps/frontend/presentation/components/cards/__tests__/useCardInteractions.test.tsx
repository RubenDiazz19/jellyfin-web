import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useCardInteractions, type CardItem } from '../useCardInteractions';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import { selectionVM } from '../../../../domain/viewModels/SelectionViewModel';

vi.mock('../controls/useItemContextMenu', () => ({
    useItemContextMenu: vi.fn(() => ({
        onContextMenu: vi.fn(),
        menu: <div id='mock-menu' />
    }))
}));

describe('useCardInteractions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectionVM.selecting.value = false;
        selectionVM.selected.value = [];
    });

    it('navega a ficha de serie al hacer click', () => {
        const navigate = vi.fn();
        const item: CardItem = {
            id: 'show-1',
            title: 'Serie Test',
            kind: 'show'
        };

        const hook = renderHook(() => useCardInteractions(item, navigate));

        act(() => {
            hook.result.current.onClick();
        });

        expect(navigate).toHaveBeenCalledWith({ page: 'show', showId: 'show-1' });
        hook.unmount();
    });

    it('navega a ficha de película al hacer click', () => {
        const navigate = vi.fn();
        const item: CardItem = {
            id: 'movie-1',
            title: 'Peli Test',
            kind: 'movie'
        };

        const hook = renderHook(() => useCardInteractions(item, navigate));

        act(() => {
            hook.result.current.onClick();
        });

        expect(navigate).toHaveBeenCalledWith({ page: 'movie', movieId: 'movie-1' });
        hook.unmount();
    });

    it('navega a temporada y episodio correctamente', () => {
        const navigate = vi.fn();
        const seasonItem: CardItem = {
            id: 's1',
            title: 'Temp 1',
            kind: 'season',
            showId: 'show-1',
            seasonN: 1
        };

        const hook1 = renderHook(() => useCardInteractions(seasonItem, navigate));
        act(() => {
            hook1.result.current.onClick();
        });
        expect(navigate).toHaveBeenCalledWith({ page: 'season', showId: 'show-1', seasonN: 1 });
        hook1.unmount();

        const epItem: CardItem = {
            id: 'ep1',
            title: 'Capítulo 1',
            kind: 'episode',
            showId: 'show-1',
            seasonN: 1,
            epN: 1
        };

        const hook2 = renderHook(() => useCardInteractions(epItem, navigate));
        act(() => {
            hook2.result.current.onClick();
        });
        expect(navigate).toHaveBeenCalledWith({ page: 'episode', showId: 'show-1', seasonN: 1, epN: 1 });
        hook2.unmount();
    });

    it('ejecuta callback onOpen personalizado si se proporciona', () => {
        const navigate = vi.fn();
        const onOpen = vi.fn();
        const item: CardItem = {
            id: 'custom-1',
            title: 'Custom',
            kind: 'movie',
            onOpen
        };

        const hook = renderHook(() => useCardInteractions(item, navigate));

        act(() => {
            hook.result.current.onClick();
        });

        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(navigate).not.toHaveBeenCalled();
        hook.unmount();
    });
});
