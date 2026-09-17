import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, apiSend, normalizeServerUrl, uploadImage, HttpError } from '../http';
import * as sessionModule from '../../session/session';

vi.mock('../../session/session');
vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => `Translated:${key}` }
}));
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => ({
            clientInfo: { name: 'App', version: '1.0' },
            deviceInfo: { name: 'Dev', id: 'dev-1' }
        })
    }
}));

describe('http', () => {
    let globalFetch: any;

    beforeEach(() => {
        globalFetch = vi.fn();
        vi.stubGlobal('fetch', globalFetch);
        vi.clearAllMocks();
    });

    describe('normalizeServerUrl', () => {
        it('trims slashes and adds http if missing', () => {
            expect(normalizeServerUrl(' server.com/ ')).toBe('http://server.com');
            expect(normalizeServerUrl('https://server.com/')).toBe('https://server.com');
            expect(normalizeServerUrl('')).toBe('');
        });
    });

    describe('apiFetch', () => {
        it('throws if no session', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue(null);
            await expect(apiFetch('/path')).rejects.toThrow('Translated:MessageNoSession');
        });

        it('fetches with auth headers and parses JSON', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({
                accessToken: 'token123',
                userId: 'user1',
                serverUrl: 'http://srv/'
            } as any);

            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: 'ok' })
            });

            const data = await apiFetch('/path');
            expect(data).toEqual({ result: 'ok' });
            expect(globalFetch).toHaveBeenCalledWith('http://srv/path', expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Token="token123"')
                })
            }));
        });

        it('throws HttpError on non-ok', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ accessToken: 'a', userId: 'u', serverUrl: 'http://srv' } as any);
            globalFetch.mockResolvedValueOnce({ ok: false, status: 404 });

            try {
                await apiFetch('/path');
                expect.fail('Should throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(HttpError);
                expect(e.status).toBe(404);
            }
        });
    });

    describe('apiSend', () => {
        it('sends JSON body and returns Response', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ accessToken: 'a', userId: 'u', serverUrl: 'http://srv' } as any);
            globalFetch.mockResolvedValueOnce({ ok: true });

            await apiSend('/path', 'POST', { foo: 'bar' });

            expect(globalFetch).toHaveBeenCalledWith('http://srv/path', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ foo: 'bar' }),
                headers: expect.objectContaining({ 'Content-Type': 'application/json' })
            }));
        });
    });

    describe('uploadImage', () => {
        it('uploads file as base64', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ accessToken: 'a', userId: 'u', serverUrl: 'http://srv' } as any);
            globalFetch.mockResolvedValueOnce({ ok: true });

            const file = new File(['hello'], 'img.png', { type: 'image/png' });
            await uploadImage('/upload', file);

            expect(globalFetch).toHaveBeenCalledWith('http://srv/upload', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'Content-Type': 'image/png' }),
                body: btoa('hello')
            }));
        });

        it('rejects if file is too large', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ accessToken: 'a', userId: 'u', serverUrl: 'http://srv' } as any);
            const file = new File([''], 'img.png');
            Object.defineProperty(file, 'size', { value: 40 * 1024 * 1024 });

            await expect(uploadImage('/upload', file)).rejects.toThrow('Translated:ImageExceedsMaxSize');
        });
    });
});
