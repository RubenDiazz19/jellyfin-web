import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useItemActions } from '../useItemActions';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import { queueVM } from '../../../../domain/viewModels/QueueViewModel';
import { tasksVM } from '../../../../domain/viewModels/TasksViewModel';
import * as api from '../../../../domain/api';

const mockToast = vi.fn();
vi.mock('../../toast/ToastProvider', () => ({
    useToast: () => mockToast
}));

const mockPlay = vi.fn();
vi.mock('../../player/PlayerProvider', () => ({
    usePlayer: () => ({ play: mockPlay })
}));

vi.mock('../../../../domain/bridge/useSession', () => ({
    useSession: () => ({ session: { accessToken: 'token-123' } })
}));

vi.mock('../../../../domain/api', () => ({
    refreshItemMetadata: vi.fn(),
    deleteItem: vi.fn(),
    downloadUrl: vi.fn((id: string) => `http://server/download/${id}`),
    nativeItemUrl: vi.fn((id: string) => `http://server/item/${id}`)
}));

vi.mock('../../../../domain/stores', () => ({
    LISTS: {
        remove: vi.fn()
    }
}));

describe('useItemActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inicia reproducción con doPlay', () => {
        const hook = renderHook(() => useItemActions({
            id: 'movie-1',
            type: 'movie',
            itemTitle: 'Película 1'
        }));

        act(() => {
            hook.result.current.doPlay();
        });

        expect(mockPlay).toHaveBeenCalledWith({
            itemId: 'movie-1',
            title: 'Película 1',
            startTicks: undefined
        });

        act(() => {
            hook.result.current.doPlay({ fromStart: true });
        });

        expect(mockPlay).toHaveBeenCalledWith({
            itemId: 'movie-1',
            title: 'Película 1',
            startTicks: 0
        });

        hook.unmount();
    });

    it('encola el item a continuación o al final', () => {
        const enqueueSpy = vi.spyOn(queueVM, 'enqueue').mockImplementation(() => {});
        const playNextSpy = vi.spyOn(queueVM, 'playNext').mockImplementation(() => {});

        const hook = renderHook(() => useItemActions({
            id: 'item-10',
            type: 'movie',
            itemTitle: 'Peli Cola'
        }));

        expect(hook.result.current.canQueue).toBe(true);

        act(() => {
            hook.result.current.doQueue('next');
        });
        expect(playNextSpy).toHaveBeenCalledWith(expect.objectContaining({
            itemId: 'item-10',
            title: 'Peli Cola'
        }));

        act(() => {
            hook.result.current.doQueue('last');
        });
        expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({
            itemId: 'item-10',
            title: 'Peli Cola'
        }));

        hook.unmount();
    });

    it('refresca metadatos y espera la tarea', async () => {
        const expectSpy = vi.spyOn(tasksVM, 'expect').mockImplementation(() => {});
        vi.mocked(api.refreshItemMetadata).mockResolvedValue(undefined as any);

        const hook = renderHook(() => useItemActions({
            id: 'item-5',
            type: 'movie',
            itemTitle: 'Peli Refresco'
        }));

        await act(async () => {
            await hook.result.current.doRefresh({ replaceAllMetadata: false } as any);
        });

        expect(api.refreshItemMetadata).toHaveBeenCalledWith('item-5', { replaceAllMetadata: false });
        expect(expectSpy).toHaveBeenCalledWith('item-5', 'Peli Refresco');
        expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'success');

        hook.unmount();
    });

    it('elimina el item a través de la API', async () => {
        vi.mocked(api.deleteItem).mockResolvedValue(undefined as any);

        const hook = renderHook(() => useItemActions({
            id: 'item-del',
            type: 'movie',
            itemTitle: 'Para Borrar'
        }));

        await act(async () => {
            await hook.result.current.doDelete();
        });

        expect(api.deleteItem).toHaveBeenCalledWith('item-del');
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Para Borrar'), 'success');

        hook.unmount();
    });

    it('gestiona la apertura de diálogos y estado del editor', () => {
        const hook = renderHook(() => useItemActions({
            id: 'item-1',
            type: 'movie'
        }));

        expect(hook.result.current.editor).toBeNull();
        expect(hook.result.current.refreshOpen).toBe(false);

        act(() => {
            hook.result.current.setEditor('metadata');
            hook.result.current.setRefreshOpen(true);
        });

        expect(hook.result.current.editor).toBe('metadata');
        expect(hook.result.current.refreshOpen).toBe(true);

        hook.unmount();
    });
});
