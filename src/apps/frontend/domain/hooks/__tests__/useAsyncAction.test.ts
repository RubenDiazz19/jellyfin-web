import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { renderHook } from '../../bridge/__tests__/testUtils';
import { useAsyncAction } from '../useAsyncAction';
import * as toastProvider from '../../../presentation/components/toast/ToastProvider';

vi.mock('../../../presentation/components/toast/ToastProvider', () => ({
    useToast: vi.fn()
}));

describe('useAsyncAction', () => {
    it('handles successful action', async () => {
        const mockToast = vi.fn();
        vi.mocked(toastProvider.useToast).mockReturnValue(mockToast);

        const action = vi.fn().mockResolvedValue('ok');
        const onClose = vi.fn();

        const { result } = renderHook(() => useAsyncAction(action, { success: 'Done', onClose }));

        expect(result.current.busy).toBe(false);

        let p: Promise<void> | undefined;
        act(() => {
            p = result.current.execute('arg1');
        });

        expect(result.current.busy).toBe(true);
        await act(async () => {
            await p;
        });

        expect(result.current.busy).toBe(false);
        expect(action).toHaveBeenCalledWith('arg1');
        expect(mockToast).toHaveBeenCalledWith('Done', 'success');
        expect(onClose).toHaveBeenCalled();
    });

    it('handles failed action', async () => {
        const mockToast = vi.fn();
        vi.mocked(toastProvider.useToast).mockReturnValue(mockToast);

        const action = vi.fn().mockRejectedValue(new Error('Failed'));
        const onClose = vi.fn();

        const { result } = renderHook(() => useAsyncAction(action, { onClose }));

        await act(async () => {
            await result.current.execute();
        });

        expect(result.current.busy).toBe(false);
        expect(mockToast).toHaveBeenCalledWith('Failed', 'warn');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('prevents overlapping executions', async () => {
        const mockToast = vi.fn();
        vi.mocked(toastProvider.useToast).mockReturnValue(mockToast);

        let resolve: () => void = () => {};
        const action = vi.fn().mockReturnValue(new Promise<void>(r => { resolve = r; }));

        const { result } = renderHook(() => useAsyncAction(action));

        act(() => {
            void result.current.execute();
        });

        act(() => {
            void result.current.execute(); // Second one should be ignored
        });

        expect(action).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolve();
        });
    });
});
