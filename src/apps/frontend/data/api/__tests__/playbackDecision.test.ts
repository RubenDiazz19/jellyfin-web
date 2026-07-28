// Elección de fuente en getPlaybackDecision. El caso que importa es el MKV:
// el servidor dice SupportsDirectStream (los códecs valen, el contenedor no)
// y servir el fichero crudo con Static=true devuelve un video/x-matroska que
// ningún navegador reproduce.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiSend } from '../http';
import { getPlaybackDecision } from '../playback';

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
    });

    test('DirectPlay sirve el fichero tal cual', async () => {
        respondWith({ ...BASE, Container: 'mp4', SupportsDirectPlay: true });

        const decision = await getPlaybackDecision('item1');

        expect(decision.kind).toBe('direct');
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
});
