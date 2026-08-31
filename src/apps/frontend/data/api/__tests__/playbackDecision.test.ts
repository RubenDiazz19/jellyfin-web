// Elección de fuente en getPlaybackDecision. El caso que importa es el MKV:
// el servidor dice SupportsDirectStream (los códecs valen, el contenedor no)
// y servir el fichero crudo con Static=true devuelve un video/x-matroska que
// ningún navegador reproduce.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiSend } from '../http';
import { getPlaybackDecision } from '../playback';
import { invalidatePlayback } from '../playbackCache';

vi.mock('../http', () => ({
    apiSend: vi.fn(),
    noSessionError: () => new Error('no session'),
    trimSlash: (u: string) => u.replace(/\/$/, '')
}));
vi.mock('../cache', () => ({ clearShowCache: vi.fn() }));
vi.mock('../mutations', () => ({ emitItemMutated: vi.fn() }));
vi.mock('../../session/session', () => ({
    loadSession: vi.fn(() => ({ accessToken: 'tok', userId: 'u1', serverUrl: 'http://s' }))
}));

const apiSendMock = vi.mocked(apiSend);

type Source = Record<string, unknown>;

function respondWith(source: Source) {
    apiSendMock.mockResolvedValueOnce({
        json: () => Promise.resolve({ PlaySessionId: 'ps1', MediaSources: [source] })
    } as unknown as Response);
}

const BASE: Source = { Id: 'ms1', MediaStreams: [] };

describe('getPlaybackDecision', () => {
    beforeEach(() => {
        apiSendMock.mockReset();
        // La decisión va cacheada por item+pistas: sin vaciar, cada caso
        // heredaría la respuesta que preparó el anterior.
        invalidatePlayback();
    });

    test('DirectPlay sirve el fichero tal cual', async () => {
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });

        const decision = await getPlaybackDecision('item1');

        expect(decision.kind).toBe('direct');
        expect(decision.playMethod).toBe('DirectPlay');
        expect(decision.url).toContain('/Videos/item1/stream?');
        expect(decision.url).toContain('Static=true');
        expect(decision.container).toBe('mp4');
    });

    test('MKV (solo DirectStream) va por HLS para que el servidor remuxee', async () => {
        respondWith({
            ...BASE,
            Container: 'mkv',
            SupportsDirectPlay: false,
            SupportsDirectStream: true,
            SupportsTranscoding: true,
            TranscodingUrl: '/videos/item1/master.m3u8?x=1',
            TranscodingContainer: 'ts'
        });

        const decision = await getPlaybackDecision('item1');

        // Lo que rompía: kind 'direct' + Static=true devolvía el Matroska.
        expect(decision.kind).toBe('hls');
        expect(decision.playMethod).toBe('Transcode');
        expect(decision.url).toBe('http://s/videos/item1/master.m3u8?x=1');
        expect(decision.url).not.toContain('Static=true');
    });

    test('DirectPlay gana al transcode aunque ambos estén disponibles', async () => {
        respondWith({
            ...BASE,
            Container: 'mp4',
            SupportsDirectPlay: true,
            SupportsTranscoding: true,
            TranscodingUrl: '/videos/item1/master.m3u8'
        });

        expect((await getPlaybackDecision('item1')).kind).toBe('direct');
    });

    test('sin TranscodingUrl, DirectStream cae al fichero crudo como último recurso', async () => {
        respondWith({
            ...BASE,
            Container: 'mkv',
            SupportsDirectStream: true,
            SupportsTranscoding: false
        });

        const decision = await getPlaybackDecision('item1');

        expect(decision.kind).toBe('direct');
        expect(decision.url).toContain('Static=true');
    });

    test('una TranscodingUrl sin barra inicial se normaliza', async () => {
        respondWith({
            ...BASE,
            SupportsDirectStream: true,
            SupportsTranscoding: true,
            TranscodingUrl: 'videos/item1/master.m3u8'
        });

        expect((await getPlaybackDecision('item1')).url).toBe('http://s/videos/item1/master.m3u8');
    });

    test('sin ninguna vía reproducible, error explícito', async () => {
        respondWith({ ...BASE, SupportsDirectPlay: false, SupportsDirectStream: false });

        await expect(getPlaybackDecision('item1')).rejects.toThrow('no puede reproducir');
    });

    test('sin fuentes, error explícito', async () => {
        apiSendMock.mockResolvedValueOnce({
            json: () => Promise.resolve({ MediaSources: [] })
        } as unknown as Response);

        await expect(getPlaybackDecision('item1')).rejects.toThrow('Sin fuentes');
    });

    // Lo que hace útil el pre-calentamiento: la ficha negocia y, cuando el
    // reproductor monta y pide lo mismo, ya no hay POST que hacer.
    test('la misma negociación no repite el POST', async () => {
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });

        const first = await getPlaybackDecision('item1', { audioStreamIndex: 2 });
        const second = await getPlaybackDecision('item1', { audioStreamIndex: 2 });

        expect(second).toBe(first);
        expect(apiSendMock).toHaveBeenCalledTimes(1);
    });

    test('otras pistas son otra negociación', async () => {
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });

        await getPlaybackDecision('item1', { audioStreamIndex: 2 });
        await getPlaybackDecision('item1', { audioStreamIndex: 3 });

        expect(apiSendMock).toHaveBeenCalledTimes(2);
    });

    // El reintento de arranque existe porque la sesión anterior no levantó:
    // servirle la misma cacheada lo dejaría sin efecto.
    test('`fresh` renegocia aunque haya algo cacheado', async () => {
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });
        respondWith({ ...BASE, Container: 'mkv', SupportsDirectPlay: true });

        await getPlaybackDecision('item1');
        const retry = await getPlaybackDecision('item1', {}, { fresh: true });

        expect(apiSendMock).toHaveBeenCalledTimes(2);
        expect(retry.container).toBe('mkv');
    });

    test('un fallo no se queda cacheado', async () => {
        apiSendMock.mockRejectedValueOnce(new Error('servidor caído'));
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });

        await expect(getPlaybackDecision('item1')).rejects.toThrow('servidor caído');

        expect((await getPlaybackDecision('item1')).kind).toBe('direct');
        expect(apiSendMock).toHaveBeenCalledTimes(2);
    });
});
