// Barrera de reportPlaybackStop: los fetch de catálogo esperan al stop en
// vuelo para no leer posiciones viejas al salir del reproductor.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { reportPlaybackStop, settlePlaybackReports } from '../playback';
import { apiSend } from '../http';
import { clearShowCache } from '../cache';

vi.mock('../http', () => ({
    apiSend: vi.fn(),
    trimSlash: (u: string) => u.replace(/\/$/, '')
}));
vi.mock('../cache', () => ({ clearShowCache: vi.fn() }));
vi.mock('../../session/session', () => ({
    loadSession: vi.fn(() => ({ accessToken: 't', userId: 'u', serverUrl: 'http://s' }))
}));

const apiSendMock = vi.mocked(apiSend);
const clearShowCacheMock = vi.mocked(clearShowCache);

const flush = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

describe('settlePlaybackReports', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test('la barrera espera al stop y el caché se limpia antes de soltarla', async () => {
        let resolveStop!: (r: Response) => void;
        apiSendMock.mockImplementationOnce(() => new Promise((resolve) => { resolveStop = resolve; }));
        apiSendMock.mockResolvedValue({} as Response);

        const stop = reportPlaybackStop('ep1', 123, 'ps1');
        let settled = false;
        void settlePlaybackReports().then(() => { settled = true; });

        await flush();
        expect(settled).toBe(false);
        expect(clearShowCacheMock).not.toHaveBeenCalled();

        resolveStop({} as Response);
        await stop;
        await flush();
        expect(clearShowCacheMock).toHaveBeenCalled();
        expect(settled).toBe(true);
    });

    test('el DELETE de ActiveEncodings queda fuera del camino crítico', async () => {
        apiSendMock.mockResolvedValueOnce({} as Response);
        // El DELETE nunca resuelve: la barrera no debe depender de él.
        apiSendMock.mockImplementationOnce(() => new Promise(() => {}));

        void reportPlaybackStop('ep1', 5, 'ps1');
        await settlePlaybackReports();

        expect(apiSendMock).toHaveBeenCalledTimes(2);
        expect(apiSendMock.mock.calls[1][0]).toContain('/Videos/ActiveEncodings');
        expect(apiSendMock.mock.calls[1][1]).toBe('DELETE');
    });

    test('si el stop falla, la barrera resuelve igual y el caché no se toca', async () => {
        apiSendMock.mockRejectedValueOnce(new Error('offline'));

        await reportPlaybackStop('ep1', 5);
        await expect(settlePlaybackReports()).resolves.toBeUndefined();
        expect(clearShowCacheMock).not.toHaveBeenCalled();
    });

    test('timeout de seguridad: un stop colgado no bloquea los fetch', async () => {
        vi.useFakeTimers();
        apiSendMock.mockImplementationOnce(() => new Promise(() => {}));

        void reportPlaybackStop('ep1', 5, 'ps1');
        let done = false;
        void settlePlaybackReports().then(() => { done = true; });

        await vi.advanceTimersByTimeAsync(1900);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(200);
        expect(done).toBe(true);
    });
});
