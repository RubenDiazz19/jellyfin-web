// Tests de la capa de API de subtítulos: búsqueda remota (GET), descarga,
// subida manual en Base64, borrado y listado de pistas.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    apiSend: vi.fn(),
    emitItemMutated: vi.fn(),
    clearShowCache: vi.fn()
}));

vi.mock('../http', () => ({
    apiFetch: mocks.apiFetch,
    apiSend: mocks.apiSend,
    noSessionError: () => new Error('sin sesión'),
    trimSlash: (u: string) => u.replace(/\/$/, '')
}));
vi.mock('../cache', () => ({ clearShowCache: mocks.clearShowCache }));
vi.mock('../mutations', () => ({ emitItemMutated: mocks.emitItemMutated }));
vi.mock('../../session/session', () => ({ loadSession: () => ({ userId: 'u1' }) }));

import {
    deleteSubtitle,
    downloadSubtitle,
    fileToBase64,
    getItemSubtitles,
    searchSubtitles,
    uploadSubtitle
} from '../subtitles';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiSend.mockResolvedValue(new Response(null, { status: 200 }));
});

describe('searchSubtitles', () => {
    test('llama a GET /Items/{itemId}/RemoteSearch/Subtitles/{language}', async () => {
        mocks.apiFetch.mockResolvedValueOnce([{ Id: 'sub-1', Name: 'Spanish Subs' }]);

        const res = await searchSubtitles('item-123', 'spa');

        expect(mocks.apiFetch).toHaveBeenCalledWith('/Items/item-123/RemoteSearch/Subtitles/spa');
        expect(res).toEqual([{ Id: 'sub-1', Name: 'Spanish Subs' }]);
    });

    test('incluye isPerfectMatch en la query si se proporciona', async () => {
        mocks.apiFetch.mockResolvedValueOnce([]);

        await searchSubtitles('item-123', 'spa', true);
        expect(mocks.apiFetch).toHaveBeenCalledWith('/Items/item-123/RemoteSearch/Subtitles/spa?isPerfectMatch=true');

        await searchSubtitles('item-123', 'spa', false);
        expect(mocks.apiFetch).toHaveBeenCalledWith('/Items/item-123/RemoteSearch/Subtitles/spa?isPerfectMatch=false');
    });
});

describe('downloadSubtitle', () => {
    test('envía POST al endpoint de descarga de Jellyfin e invalida caché', async () => {
        await downloadSubtitle('item-123', 'sub-remote-999');

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/item-123/RemoteSearch/Subtitles/sub-remote-999',
            'POST'
        );
        expect(mocks.clearShowCache).toHaveBeenCalled();
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('item-123');
    });
});

describe('uploadSubtitle', () => {
    test('envía POST a /Videos/{itemId}/Subtitles con los metadatos y datos en Base64', async () => {
        await uploadSubtitle('item-123', {
            language: 'spa',
            format: 'srt',
            isForced: true,
            isHearingImpaired: false,
            data: 'VGVzdCBzdWJ0aXRsZSBjb250ZW50'
        });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Videos/item-123/Subtitles',
            'POST',
            {
                Language: 'spa',
                Format: 'srt',
                IsForced: true,
                IsHearingImpaired: false,
                Data: 'VGVzdCBzdWJ0aXRsZSBjb250ZW50'
            }
        );
        expect(mocks.clearShowCache).toHaveBeenCalled();
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('item-123');
    });
});

describe('deleteSubtitle', () => {
    test('envía DELETE a /Videos/{itemId}/Subtitles/{index} e invalida caché', async () => {
        await deleteSubtitle('item-123', 3);

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Videos/item-123/Subtitles/3',
            'DELETE'
        );
        expect(mocks.clearShowCache).toHaveBeenCalled();
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('item-123');
    });
});

describe('getItemSubtitles', () => {
    test('devuelve las pistas de subtítulos filtradas y mapeadas', async () => {
        mocks.apiFetch.mockResolvedValueOnce({
            MediaSources: [
                {
                    MediaStreams: [
                        { Index: 0, Type: 'Video', Codec: 'h264' },
                        { Index: 1, Type: 'Audio', Codec: 'aac', Language: 'spa' },
                        {
                            Index: 2,
                            Type: 'Subtitle',
                            Codec: 'subrip',
                            Language: 'spa',
                            DisplayTitle: 'Spanish (SRT)',
                            IsExternal: true,
                            IsForced: false,
                            IsHearingImpaired: false
                        },
                        {
                            Index: 3,
                            Type: 'Subtitle',
                            Codec: 'pgssub',
                            Language: 'eng',
                            DisplayTitle: 'English (PGS)',
                            IsExternal: false,
                            IsForced: true,
                            IsHearingImpaired: true
                        }
                    ]
                }
            ]
        });

        const subs = await getItemSubtitles('item-123');
        expect(subs).toHaveLength(2);
        expect(subs[0]).toEqual({
            index: 2,
            language: 'spa',
            displayTitle: 'Spanish (SRT)',
            isDefault: false,
            isForced: false,
            isHearingImpaired: false,
            isExternal: true,
            isText: true,
            codec: 'subrip',
            path: undefined
        });
        expect(subs[1]).toEqual({
            index: 3,
            language: 'eng',
            displayTitle: 'English (PGS)',
            isDefault: false,
            isForced: true,
            isHearingImpaired: true,
            isExternal: false,
            isText: false,
            codec: 'pgssub',
            path: undefined
        });
    });
});

describe('fileToBase64', () => {
    test('codifica un archivo o Blob a cadena Base64', async () => {
        const content = '1\n00:00:01,000 --> 00:00:04,000\nHola mundo';
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], 'test.srt', { type: 'text/plain' });

        const base64 = await fileToBase64(file);
        expect(typeof base64).toBe('string');
        expect(base64.length).toBeGreaterThan(0);
        // Deserializado debe coincidir
        expect(atob(base64)).toBe(content);
    });
});
