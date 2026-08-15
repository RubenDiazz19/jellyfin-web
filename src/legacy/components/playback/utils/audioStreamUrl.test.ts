import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isLocalItem = vi.hoisted(() => vi.fn(() => false));
// Las dos dependencias arrastran la app legacy; solo se usan estas funciones.
vi.mock('components/apphost', () => ({ appHost: { supports: () => true } }));
vi.mock('components/itemHelper', () => ({ default: { isLocalItem } }));

const {
    getAudioMaxValues,
    getAudioStreamUrlFromDeviceProfile,
    getStreamUrls,
    setStreamUrls
} = await import('./audioStreamUrl');

/** Api del SDK de mentira: devuelve la URL con los parámetros serializados. */
const context = {
    api: {
        getUri: (url: string, urlParams: object = {}) => {
            const query = Object.entries(urlParams)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => `${k}=${String(v)}`)
                .join('&');
            return `https://srv${url}?${query}`;
        },
        accessToken: 'token-1',
        deviceInfo: { id: 'dev-1' }
    },
    userId: 'user-1'
};

/** Parámetros de una URL generada, para poder afirmar sobre ellos. */
function params(url: string): URLSearchParams {
    return new URL(url).searchParams;
}

const profile = (over: Partial<DeviceProfile> = {}): DeviceProfile => ({
    TranscodingProfiles: [
        { Type: 'Audio', Context: 'Streaming', Container: 'ts', Protocol: 'hls', AudioCodec: 'aac' }
    ],
    DirectPlayProfiles: [
        { Type: 'Audio', Container: 'mp3' },
        { Type: 'Audio', Container: 'flac', AudioCodec: 'flac' },
        { Type: 'Video', Container: 'mp4' }
    ],
    CodecProfiles: [],
    ...over
} as DeviceProfile);

const audioItem = (Id: string): BaseItemDto => ({ Id, MediaType: 'Audio', RunTimeTicks: 100 });

beforeEach(() => {
    isLocalItem.mockReturnValue(false);
});

describe('getAudioMaxValues', () => {
    it('sin condiciones de audio no impone techos', () => {
        expect(getAudioMaxValues(profile())).toEqual({
            maxAudioSampleRate: null, maxAudioBitDepth: null, maxAudioBitrate: null
        });
    });

    it('lee los máximos declarados como LessThanEqual', () => {
        const p = profile({
            CodecProfiles: [{
                Type: 'Audio',
                Conditions: [
                    { Condition: 'LessThanEqual', Property: 'AudioBitDepth', Value: '24' },
                    { Condition: 'LessThanEqual', Property: 'AudioSampleRate', Value: '48000' },
                    { Condition: 'LessThanEqual', Property: 'AudioBitrate', Value: '320000' }
                ]
            }]
        } as Partial<DeviceProfile>);

        expect(getAudioMaxValues(p)).toEqual({
            maxAudioBitDepth: 24, maxAudioSampleRate: 48000, maxAudioBitrate: 320000
        });
    });

    it('ignora las condiciones que no son un máximo', () => {
        const p = profile({
            CodecProfiles: [{
                Type: 'Audio',
                Conditions: [{ Condition: 'GreaterThanEqual', Property: 'AudioBitrate', Value: '64000' }]
            }]
        } as Partial<DeviceProfile>);

        expect(getAudioMaxValues(p).maxAudioBitrate).toBeNull();
    });

    it('ignora los perfiles de vídeo', () => {
        const p = profile({
            CodecProfiles: [{
                Type: 'Video',
                Conditions: [{ Condition: 'LessThanEqual', Property: 'AudioBitrate', Value: '1' }]
            }]
        } as Partial<DeviceProfile>);

        expect(getAudioMaxValues(p).maxAudioBitrate).toBeNull();
    });
});

describe('getAudioStreamUrlFromDeviceProfile', () => {
    it('apunta al endpoint universal del item', () => {
        const url = getAudioStreamUrlFromDeviceProfile(audioItem('i1'), profile(), 0, context);
        expect(url).toContain('/Audio/i1/universal');
    });

    it('lista los contenedores directos separando el códec con |', () => {
        const p = params(
            getAudioStreamUrlFromDeviceProfile(audioItem('i1'), profile(), 0, context)
        );
        expect(p.get('Container')).toBe('mp3,flac|flac');
    });

    it('toma contenedor, protocolo y códec del perfil de transcodificación', () => {
        const p = params(
            getAudioStreamUrlFromDeviceProfile(audioItem('i1'), profile(), 0, context)
        );
        expect(p.get('TranscodingContainer')).toBe('ts');
        expect(p.get('TranscodingProtocol')).toBe('hls');
        expect(p.get('AudioCodec')).toBe('aac');
    });

    it('el techo de audio del perfil gana al general de la sesión', () => {
        const p = profile({
            CodecProfiles: [{
                Type: 'Audio',
                Conditions: [{ Condition: 'LessThanEqual', Property: 'AudioBitrate', Value: '320000' }]
            }]
        } as Partial<DeviceProfile>);

        const q = params(getAudioStreamUrlFromDeviceProfile(audioItem('i1'), p, 999999, context));
        expect(q.get('MaxStreamingBitrate')).toBe('320000');
    });

    it('sin techo de audio se usa el general', () => {
        const q = params(
            getAudioStreamUrlFromDeviceProfile(audioItem('i1'), profile(), 128000, context)
        );
        expect(q.get('MaxStreamingBitrate')).toBe('128000');
    });

    it('cada llamada usa un PlaySessionId distinto', () => {
        const a = params(getAudioStreamUrlFromDeviceProfile(audioItem('i1'), profile(), 0, context));
        const b = params(getAudioStreamUrlFromDeviceProfile(audioItem('i1'), profile(), 0, context));

        expect(a.get('PlaySessionId')).not.toBe(b.get('PlaySessionId'));
    });

    it('un perfil sin transcodificación de audio sigue dando URL', () => {
        const p = profile({ TranscodingProfiles: [] });
        expect(getAudioStreamUrlFromDeviceProfile(audioItem('i1'), p, 0, context))
            .toContain('/Audio/i1/universal');
    });
});

describe('getStreamUrls', () => {
    it('mantiene el hueco de los items que no son audio del servidor', () => {
        const items: BaseItemDto[] = [
            audioItem('a'),
            { Id: 'v', MediaType: 'Video' },
            audioItem('c')
        ];

        const urls = getStreamUrls(items, profile(), 0, context);

        expect(urls).toHaveLength(3);
        expect(urls[0]).toContain('/Audio/a/universal');
        expect(urls[1]).toBe('');
        expect(urls[2]).toContain('/Audio/c/universal');
    });

    it('los items locales no se transmiten', () => {
        isLocalItem.mockReturnValue(true);
        expect(getStreamUrls([audioItem('a')], profile(), 0, context)).toEqual(['']);
    });

    it('la posición de inicio solo se aplica a la primera pista', () => {
        const urls = getStreamUrls([audioItem('a'), audioItem('b')], profile(), 0, context, 5000);

        expect(params(urls[0]).get('StartTimeTicks')).toBe('5000');
        expect(params(urls[1]).get('StartTimeTicks')).toBe('0');
    });
});

describe('setStreamUrls', () => {
    it('deja precalculada la fuente de cada pista', () => {
        const item = audioItem('a');

        setStreamUrls([item], profile(), 0, context);

        const preset = (item as { PresetMediaSource?: Record<string, unknown> }).PresetMediaSource;
        expect(preset).toMatchObject({ Id: 'a', MediaStreams: [], RunTimeTicks: 100 });
        expect(String(preset?.StreamUrl)).toContain('/Audio/a/universal');
    });

    it('no toca los items sin URL', () => {
        const video: BaseItemDto = { Id: 'v', MediaType: 'Video' };

        setStreamUrls([video], profile(), 0, context);

        expect(video).not.toHaveProperty('PresetMediaSource');
    });
});
