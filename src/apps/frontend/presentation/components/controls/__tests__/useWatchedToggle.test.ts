import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWatchedToggle } from '../useWatchedToggle';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import * as apiModule from '../../../../domain/api';
import * as sessionBridgeModule from '../../../../domain/bridge/useSession';
import * as toastModule from '../../toast/ToastProvider';

vi.mock('../../../../domain/api');
vi.mock('../../../../domain/bridge/useSession');
vi.mock('../../toast/ToastProvider');

describe('useWatchedToggle', () => {
    const toastSpy = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(toastModule.useToast).mockReturnValue(toastSpy);
        vi.mocked(sessionBridgeModule.useSession).mockReturnValue({
            session: null
        } as any);
    });

    it('aplica el cambio en local y muestra toast informativo sin sesión', async () => {
        const applyLocal = vi.fn();
        const { result } = renderHook(() => useWatchedToggle({
            active: false,
            applyLocal,
            message: (next) => `Marcado: ${next}`
        }));

        await result.current();

        expect(applyLocal).toHaveBeenCalledWith(true);
        expect(toastSpy).toHaveBeenCalledWith('Marcado: true');
        expect(apiModule.markPlayed).not.toHaveBeenCalled();
    });

    it('sincroniza con el servidor cuando hay sesión y serverId', async () => {
        vi.mocked(sessionBridgeModule.useSession).mockReturnValue({
            session: { accessToken: 'token-123' }
        } as any);
        vi.mocked(apiModule.markPlayed).mockResolvedValueOnce(undefined as any);

        const applyLocal = vi.fn();
        const { result } = renderHook(() => useWatchedToggle({
            active: false,
            applyLocal,
            serverId: 'item-server-1',
            message: (next) => `Marcado: ${next}`
        }));

        await result.current();

        expect(applyLocal).toHaveBeenCalledWith(true);
        expect(apiModule.markPlayed).toHaveBeenCalledWith('item-server-1', true);
        expect(toastSpy).toHaveBeenCalledWith('Marcado: true', 'success');
    });

    it('revierte el cambio en local y avisa con toast si la API falla', async () => {
        vi.mocked(sessionBridgeModule.useSession).mockReturnValue({
            session: { accessToken: 'token-123' }
        } as any);
        vi.mocked(apiModule.markPlayed).mockRejectedValueOnce(new Error('Network error'));

        const applyLocal = vi.fn();
        const { result } = renderHook(() => useWatchedToggle({
            active: false,
            applyLocal,
            serverId: 'item-server-1',
            message: (next) => `Marcado: ${next}`
        }));

        await result.current();

        expect(applyLocal).toHaveBeenNthCalledWith(1, true);
        expect(applyLocal).toHaveBeenNthCalledWith(2, false);
        expect(toastSpy).toHaveBeenCalledWith('Network error', 'warn');
    });
});
