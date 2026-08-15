import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    isLocalItem: vi.fn(() => false),
    supports: vi.fn(() => true),
    alert: vi.fn(),
    translate: vi.fn((k: string) => k),
    getPostedPlaybackInfo: vi.fn(),
    getEndpointInfo: vi.fn()
}));

// Todas estas dependencias arrastran la app legacy al entorno de test.
vi.mock('components/alert', () => ({ default: mocks.alert }));
vi.mock('components/apphost', () => ({ appHost: { supports: mocks.supports } }));
vi.mock('components/itemHelper', () => ({ default: { isLocalItem: mocks.isLocalItem } }));
vi.mock('lib/globalize', () => ({ default: { translate: mocks.translate } }));
vi.mock('scripts/settings/appSettings', () => ({
    default: { alwaysBurnInSubtitleWhenTranscoding: () => false }
}));
vi.mock('@jellyfin/sdk/lib/utils/api/media-info-api', () => ({
    getMediaInfoApi: () => ({ getPostedPlaybackInfo: mocks.getPostedPlaybackInfo })
}));
vi.mock('@jellyfin/sdk/lib/utils/api/system-api', () => ({
    getSystemApi: () => ({ getEndpointInfo: mocks.getEndpointInfo })
}));

const {
    getOptimalMediaSource,
    getPlaybackInfo,
    isHostReachable,
    supportsDirectPlay,
    validatePlaybackInfoResult
} = await import('./mediaResolution');

type MediaContext = Parameters<typeof isHostReachable>[1];

/** Contexto de medios: un Api del SDK de mentira y el usuario en sesión. */
const context = {
    api: {
        getUri: (url: string, p: Record<string, unknown> = {}) =>
            `https://srv${url}?${new URLSearchParams(
                Object.entries(p)
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)])
            ).toString()}`,
        accessToken: 'token-1',
        deviceInfo: { id: 'dev-1' }
    },
    userId: 'user-1'
} as unknown as MediaContext;

const profile: DeviceProfile = {
    TranscodingProfiles: [{ Type: 'Audio', Context: 'Streaming', Container: 'ts' }],
    DirectPlayProfiles: [{ Type: 'Audio', Container: 'mp3' }],
    CodecProfiles: []
} as DeviceProfile;

const player = { name: 'p', id: 'p', canPlayMediaType: () => true };

/** Devuelve la query que se le mandó al servidor en la última llamada. */
function lastQuery(): Record<string, unknown> {
    const call = mocks.getPostedPlaybackInfo.mock.calls.at(-1);
    return (call?.[0] as { playbackInfoDto: Record<string, unknown> }).playbackInfoDto;
}

beforeEach(() => {
    mocks.isLocalItem.mockReturnValue(false);
    mocks.supports.mockReturnValue(true);
    mocks.alert.mockReset();
    mocks.getPostedPlaybackInfo.mockReset().mockResolvedValue({ data: { MediaSources: [] } });
    mocks.getEndpointInfo.mockReset();
});

describe('getPlaybackInfo: atajos que evitan preguntar al servidor', () => {
    it('el audio del servidor se resuelve con la URL universal', async () => {
        const item: BaseItemDto = { Id: 'a', MediaType: 'Audio', RunTimeTicks: 100 };

        const res = await getPlaybackInfo(player, context, item, profile, null, null, {});

        expect(mocks.getPostedPlaybackInfo).not.toHaveBeenCalled();
        expect(res.MediaSources?.[0]).toMatchObject({ Id: 'a', RunTimeTicks: 100 });
    });

    it('un player que prefiere el servidor para audio sí pregunta', async () => {
        const item: BaseItemDto = { Id: 'a', MediaType: 'Audio' };

        await getPlaybackInfo(
            { ...player, useServerPlaybackInfoForAudio: true },
            context, item, profile, null, null, {}
        );

        expect(mocks.getPostedPlaybackInfo).toHaveBeenCalledOnce();
    });

    it('el audio local pregunta al servidor', async () => {
        mocks.isLocalItem.mockReturnValue(true);

        await getPlaybackInfo(
            player, context, { Id: 'a', MediaType: 'Audio' }, profile, null, null, {}
        );

        expect(mocks.getPostedPlaybackInfo).toHaveBeenCalledOnce();
    });

    it('un item con la fuente precalculada la reutiliza', async () => {
        const preset = { Id: 'ms-1', StreamUrl: 'https://srv/x' };

        const res = await getPlaybackInfo(
            player, context,
            { Id: 'v', MediaType: 'Video', PresetMediaSource: preset },
            profile, null, null, {}
        );

        expect(mocks.getPostedPlaybackInfo).not.toHaveBeenCalled();
        expect(res.MediaSources).toEqual([preset]);
    });
});

describe('getPlaybackInfo: la consulta al servidor', () => {
    const video: BaseItemDto = { Id: 'v', MediaType: 'Video' };

    it('distingue reproducir de solo inspeccionar', async () => {
        await getPlaybackInfo(player, context, video, profile, null, null, { isPlayback: true });
        expect(lastQuery()).toMatchObject({ IsPlayback: true, AutoOpenLiveStream: true });

        await getPlaybackInfo(player, context, video, profile, null, null, {});
        expect(lastQuery()).toMatchObject({ IsPlayback: false, AutoOpenLiveStream: false });
    });

    it('la pista 0 es una elección válida y viaja', async () => {
        await getPlaybackInfo(player, context, video, profile, null, null, {
            audioStreamIndex: 0
        });

        expect(lastQuery()).toHaveProperty('AudioStreamIndex', 0);
    });

    it('lo que no se ha pedido no viaja: el servidor decide', async () => {
        await getPlaybackInfo(player, context, video, profile, null, null, {});

        expect(lastQuery()).not.toHaveProperty('AudioStreamIndex');
        expect(lastQuery()).not.toHaveProperty('SubtitleStreamIndex');
    });

    it('un flag desactivado explícitamente sí viaja', async () => {
        await getPlaybackInfo(player, context, video, profile, null, null, {
            enableDirectPlay: false
        });

        expect(lastQuery()).toHaveProperty('EnableDirectPlay', false);
    });

    it('el player puede vetar el direct stream que el servidor ofrecería', async () => {
        await getPlaybackInfo(
            { ...player, supportsPlayMethod: () => false },
            context, video, profile, null, null, {}
        );

        expect(lastQuery()).toHaveProperty('EnableDirectStream', false);
    });

    it('pasa los identificadores de fuente y live stream cuando los hay', async () => {
        await getPlaybackInfo(player, context, video, profile, 'ms-9', 'ls-9', {});

        expect(lastQuery()).toMatchObject({ MediaSourceId: 'ms-9', LiveStreamId: 'ls-9' });
    });
});

describe('getOptimalMediaSource', () => {
    const directPlayable: MediaSourceInfo = {
        Id: 'direct', SupportsDirectPlay: true, Protocol: 'Http',
        RequiredHttpHeaders: {}, IsRemote: true
    };
    const streamable: MediaSourceInfo = { Id: 'stream', SupportsDirectStream: true };
    const transcodable: MediaSourceInfo = { Id: 'trans', SupportsTranscoding: true };

    it('prefiere la que se reproduce tal cual', async () => {
        const best = await getOptimalMediaSource(
            context, { Id: 'i' }, [transcodable, streamable, directPlayable]
        );
        expect(best.Id).toBe('direct');
    });

    it('si no, la que se puede remuxar', async () => {
        const best = await getOptimalMediaSource(context, { Id: 'i' }, [transcodable, streamable]);
        expect(best.Id).toBe('stream');
    });

    it('si no, la transcodificable', async () => {
        const best = await getOptimalMediaSource(
            context, { Id: 'i' }, [{ Id: 'nada' }, transcodable]
        );
        expect(best.Id).toBe('trans');
    });

    it('sin ninguna válida devuelve la primera antes que nada', async () => {
        const best = await getOptimalMediaSource(context, { Id: 'i' }, [{ Id: 'a' }, { Id: 'b' }]);
        expect(best.Id).toBe('a');
    });

    it('sin fuentes es un error, no un undefined silencioso', async () => {
        await expect(getOptimalMediaSource(context, { Id: 'i' }, [])).rejects.toThrow();
    });

    it('anota en cada fuente si admite reproducción directa', async () => {
        const versions = [{ ...directPlayable }, { ...streamable }];

        await getOptimalMediaSource(context, { Id: 'i' }, versions);

        expect(versions[0]).toHaveProperty('enableDirectPlay', true);
        expect(versions[1]).toHaveProperty('enableDirectPlay', false);
    });
});

describe('isHostReachable', () => {
    it('una fuente remota siempre lo es', async () => {
        await expect(isHostReachable({ IsRemote: true }, context)).resolves.toBe(true);
    });

    it('una fuente de la red local no lo es desde fuera', async () => {
        mocks.getEndpointInfo.mockResolvedValue({ data: { IsInNetwork: false } });
        await expect(isHostReachable({ Path: '/media/x.mkv' }, context)).resolves.toBe(false);
    });

    it('desde dentro de la red sí', async () => {
        mocks.getEndpointInfo.mockResolvedValue({ data: { IsInNetwork: true, IsLocal: false } });
        await expect(isHostReachable({ Path: '/media/x.mkv' }, context)).resolves.toBe(true);
    });

    it('una ruta con localhost solo vale si la app corre en el propio servidor', async () => {
        mocks.getEndpointInfo.mockResolvedValue({ data: { IsInNetwork: true, IsLocal: false } });
        await expect(isHostReachable({ Path: 'http://localhost/x' }, context)).resolves.toBe(false);

        mocks.getEndpointInfo.mockResolvedValue({ data: { IsInNetwork: true, IsLocal: true } });
        await expect(isHostReachable({ Path: 'http://localhost/x' }, context)).resolves.toBe(true);
    });
});

describe('supportsDirectPlay', () => {
    it('no, si el servidor no lo admite y no es un volcado de disco', async () => {
        await expect(supportsDirectPlay(context, { Id: 'i' }, { Id: 'ms' }))
            .resolves.toBe(false);
    });

    it('los volcados de disco pasan aunque el servidor no los marque', async () => {
        const source: MediaSourceInfo = {
            VideoType: 'BluRay', Protocol: 'Http', RequiredHttpHeaders: {}
        };
        await expect(supportsDirectPlay(context, { Id: 'i' }, source)).resolves.toBe(true);
    });

    it('no, si es remota y el dispositivo no reproduce vídeo remoto', async () => {
        mocks.supports.mockReturnValue(false);
        const source: MediaSourceInfo = {
            SupportsDirectPlay: true, IsRemote: true, Protocol: 'Http', RequiredHttpHeaders: {}
        };

        await expect(supportsDirectPlay(context, { Id: 'i' }, source)).resolves.toBe(false);
    });

    it('no, si la fuente exige cabeceras HTTP propias', async () => {
        // El navegador no puede añadirlas a la petición de un <video>. El
        // código original miraba `.length` de un diccionario, así que este
        // caso se colaba como reproducible en directo.
        const source: MediaSourceInfo = {
            SupportsDirectPlay: true, Protocol: 'Http', RequiredHttpHeaders: { 'X-Token': 'abc' }
        };

        await expect(supportsDirectPlay(context, { Id: 'i' }, source)).resolves.toBe(false);
    });

    it('si es la única vía, se intenta sin comprobar la ruta', async () => {
        const source: MediaSourceInfo = {
            SupportsDirectPlay: true, Protocol: 'Http', RequiredHttpHeaders: {},
            SupportsDirectStream: false, SupportsTranscoding: false
        };

        await expect(supportsDirectPlay(context, { Id: 'i' }, source)).resolves.toBe(true);
        expect(mocks.getEndpointInfo).not.toHaveBeenCalled();
    });

    it('habiendo alternativa, se comprueba que la ruta sea alcanzable', async () => {
        mocks.getEndpointInfo.mockResolvedValue({ data: { IsInNetwork: false } });
        const source: MediaSourceInfo = {
            SupportsDirectPlay: true, Protocol: 'Http', RequiredHttpHeaders: {},
            SupportsTranscoding: true
        };

        await expect(supportsDirectPlay(context, { Id: 'i' }, source)).resolves.toBe(false);
        expect(mocks.getEndpointInfo).toHaveBeenCalled();
    });
});

describe('validatePlaybackInfoResult', () => {
    it('sin error, la respuesta vale y no se avisa a nadie', () => {
        expect(validatePlaybackInfoResult({ MediaSources: [] })).toBe(true);
        expect(mocks.alert).not.toHaveBeenCalled();
    });

    it('con error, avisa y la respuesta no vale', () => {
        expect(validatePlaybackInfoResult({ ErrorCode: 'RateLimitExceeded' })).toBe(false);
        expect(mocks.translate).toHaveBeenCalledWith('PlaybackError.RateLimitExceeded');
    });

    it('NoCompatibleStream conserva su clave histórica de traducción', () => {
        validatePlaybackInfoResult({ ErrorCode: 'NoCompatibleStream' });
        expect(mocks.translate).toHaveBeenCalledWith('PlaybackErrorNoCompatibleStream');
    });
});
