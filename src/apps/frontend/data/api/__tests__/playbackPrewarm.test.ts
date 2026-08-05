// Pre-calentamiento del arranque. Lo que se prueba es que llegue EXACTAMENTE
// a la misma negociación que hará el reproductor: si pidiera otras pistas, el
// reproductor tendría que renegociar al montarse y el adelanto no solo no
// serviría, sino que habría levantado un transcode de más.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    apiSend: vi.fn()
}));

vi.mock('../http', () => ({
    apiFetch: mocks.apiFetch,
    apiSend: mocks.apiSend,
    noSessionError: () => new Error('sin sesión'),
    trimSlash: (u: string) => u.replace(/\/$/, '')
}));
vi.mock('../cache', () => ({ clearShowCache: vi.fn() }));
vi.mock('../mutations', () => ({ emitItemMutated: vi.fn() }));
vi.mock('../../session/session', () => ({
    loadSession: () => ({ accessToken: 'tok', userId: 'u1', serverUrl: 'http://s' })
}));

import { getPlaybackDecision } from '../playback';
import { invalidatePlayback } from '../playbackCache';
import { getPlaybackContext } from '../playbackContext';
import { prewarmPlayback } from '../playbackPrewarm';

const AUDIO = [
    { Index: 1, Type: 'Audio', Language: 'eng', DisplayTitle: 'English', IsDefault: true },
    { Index: 2, Type: 'Audio', Language: 'spa', DisplayTitle: 'Español' }
];

/** Respuesta de /Users/{u}/Items/{id}: el contexto del item. */
function contextResponse() {
    return {
        Id: 'ep1',
        Type: 'Episode',
        SeriesId: 'series1',
        Chapters: [],
        MediaSources: [{ Id: 'ms1', MediaStreams: AUDIO }]
    };
}

/** Respuesta de PlaybackInfo: un HLS de transcode. */
function playbackInfoResponse() {
    return {
        json: () => Promise.resolve({
            PlaySessionId: 'ps1',
            MediaSources: [{
                Id: 'ms1',
                MediaStreams: AUDIO,
                SupportsTranscoding: true,
                TranscodingUrl: '/videos/ep1/master.m3u8?x=1'
            }]
        })
    } as unknown as Response;
}

// El tipo va en el genérico y no en un parámetro sin usar: así `mock.calls`
// sabe que la llamada lleva una URL y se puede afirmar sobre ella.
const fetchMock = vi.fn<(url: string) => Promise<Response>>(() => Promise.resolve(
    { text: () => Promise.resolve('#EXTM3U') } as unknown as Response
));

beforeEach(() => {
    vi.clearAllMocks();
    invalidatePlayback();
    localStorage.clear();
    mocks.apiFetch.mockResolvedValue(contextResponse());
    mocks.apiSend.mockResolvedValue(playbackInfoResponse());
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('prewarmPlayback', () => {
    test('deja negociado lo que el reproductor pedirá después', async () => {
        await prewarmPlayback('ep1');

        // Y ahora el reproductor, que pide lo mismo: ni una petición más.
        const decision = await getPlaybackDecision('ep1', {});
        await getPlaybackContext('ep1');

        expect(decision.kind).toBe('hls');
        expect(mocks.apiSend).toHaveBeenCalledTimes(1);
        expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    });

    // El idioma recordado de la SERIE (no del episodio) tiene que entrar ya en
    // el pre-calentamiento: es la razón de pedir antes el contexto.
    test('respeta el idioma recordado del título', async () => {
        localStorage.setItem(
            'jfp-lang-prefs:u1', JSON.stringify({ series1: { audio: 'spa' } })
        );

        await prewarmPlayback('ep1');

        expect(mocks.apiSend.mock.calls[0][0]).toContain('audioStreamIndex=2');
        // Sin mediaSourceId el servidor ignora los índices pedidos.
        expect(mocks.apiSend.mock.calls[0][0]).toContain('mediaSourceId=ms1');
    });

    test('sin manifiesto no se toca el transcode', async () => {
        await prewarmPlayback('ep1');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('con manifiesto se pide la playlist para que ffmpeg arranque', async () => {
        await prewarmPlayback('ep1', { manifest: true });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('http://s/videos/ep1/master.m3u8?x=1');
    });

    test('en Direct Play no hay manifiesto que calentar', async () => {
        mocks.apiSend.mockResolvedValue({
            json: () => Promise.resolve({
                PlaySessionId: 'ps1',
                MediaSources: [{ Id: 'ms1', Container: 'mp4', SupportsDirectPlay: true }]
            })
        } as unknown as Response);

        await prewarmPlayback('ep1', { manifest: true });

        expect(fetchMock).not.toHaveBeenCalled();
    });

    // Es un adelanto opcional: si el servidor no contesta, el arranque normal
    // tiene que seguir siendo posible.
    test('un fallo no propaga ni deja nada cacheado', async () => {
        mocks.apiFetch.mockRejectedValueOnce(new Error('sin red'));

        await expect(prewarmPlayback('ep1')).resolves.toBeUndefined();

        await getPlaybackContext('ep1');
        expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    });
});
