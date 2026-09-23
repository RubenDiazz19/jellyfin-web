import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    loadSession: vi.fn(() => ({ userId: 'u1' })),
    getPlaybackDecision: vi.fn()
}));

vi.mock('../http', () => ({
    apiFetch: mocks.apiFetch,
    noSessionError: () => new Error('sin sesión')
}));

vi.mock('../session/session', () => ({ loadSession: mocks.loadSession }));
vi.mock('../../session/session', () => ({ loadSession: mocks.loadSession }));
vi.mock('../playback', () => ({ getPlaybackDecision: mocks.getPlaybackDecision }));

import {
    getLocalTrailers,
    resolveTrailerSource,
    clearTrailerCache
} from '../trailers';

beforeEach(() => {
    vi.clearAllMocks();
    clearTrailerCache();
});

describe('trailers API', () => {
    describe('getLocalTrailers', () => {
        it('consulta el endpoint /Items/{id}/LocalTrailers con el userId actual', async () => {
            mocks.apiFetch.mockResolvedValueOnce([{ Id: 'trailer-1', Name: 'Trailer Oficial' }]);

            const trailers = await getLocalTrailers('item-123');
            expect(mocks.apiFetch).toHaveBeenCalledWith('/Items/item-123/LocalTrailers?userId=u1');
            expect(trailers).toHaveLength(1);
            expect(trailers[0].Id).toBe('trailer-1');
        });

        it('devuelve array vacío si la llamada falla o no devuelve array', async () => {
            mocks.apiFetch.mockRejectedValueOnce(new Error('Network error'));

            const trailers = await getLocalTrailers('item-err');
            expect(trailers).toEqual([]);
        });
    });

    describe('resolveTrailerSource', () => {
        it('resuelve trailer local con decisión DirectPlay', async () => {
            mocks.apiFetch.mockResolvedValueOnce([{ Id: 'loc-1', Name: 'Trailer Local' }]);
            mocks.getPlaybackDecision.mockResolvedValueOnce({
                kind: 'direct',
                url: 'http://localhost:8096/Videos/loc-1/stream?Static=true'
            });

            const source = await resolveTrailerSource({
                id: 'item-loc',
                localTrailerCount: 1
            });

            expect(source).toEqual({
                type: 'video',
                url: 'http://localhost:8096/Videos/loc-1/stream?Static=true',
                isHls: false
            });
        });

        it('resuelve trailer local con decisión HLS', async () => {
            mocks.apiFetch.mockResolvedValueOnce([{ Id: 'loc-2', Name: 'Trailer Local MKV' }]);
            mocks.getPlaybackDecision.mockResolvedValueOnce({
                kind: 'hls',
                url: 'http://localhost:8096/Videos/loc-2/master.m3u8'
            });

            const source = await resolveTrailerSource({
                id: 'item-hls',
                localTrailerCount: 1
            });

            expect(source).toEqual({
                type: 'video',
                url: 'http://localhost:8096/Videos/loc-2/master.m3u8',
                isHls: true
            });
        });

        it('devuelve null si no hay trailers locales', async () => {
            mocks.apiFetch.mockResolvedValueOnce([]);

            const source = await resolveTrailerSource({
                id: 'item-none',
                localTrailerCount: 0
            });

            expect(source).toBeNull();
        });

        it('cachea la resolución para llamadas subsecuentes con el mismo id', async () => {
            mocks.apiFetch.mockResolvedValueOnce([{ Id: 'loc-cached', Name: 'Trailer' }]);
            mocks.getPlaybackDecision.mockResolvedValueOnce({
                kind: 'direct',
                url: 'http://loc-cached'
            });

            const s1 = await resolveTrailerSource({ id: 'cached-id', localTrailerCount: 1 });
            const s2 = await resolveTrailerSource({ id: 'cached-id', localTrailerCount: 1 });

            expect(s1).toBe(s2);
            expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
        });
    });
});
