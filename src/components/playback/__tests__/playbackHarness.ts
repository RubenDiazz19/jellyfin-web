/**
 * Banco de pruebas para `playbackmanager`.
 *
 * El manager tira de media app legacy al importarse (ApiClient, pluginManager,
 * OSD, ajustes de usuario…). Aquí se sustituye todo eso por dobles mínimos y
 * controlables, dejando correr de verdad la cadena de reproducción: lo que se
 * quiere caracterizar es ESA cadena, no las dependencias.
 *
 * Solo se corta en dos fronteras: el servidor (`getMediaInfoApi`, `ApiClient`)
 * y el player, que aquí es un doble que registra lo que le piden.
 */

import { vi } from 'vitest';

/** Todo lo que un test puede observar o manipular durante la reproducción. */
export interface PlaybackHarness {
    /** Respuesta de /PlaybackInfo. Cámbiala antes de llamar a play(). */
    playbackInfo: { MediaSources: Record<string, unknown>[]; ErrorCode?: string };
    /** Llamadas registradas, en orden, con el nombre del paso. */
    calls: string[];
    apiClient: Record<string, ReturnType<typeof vi.fn> | unknown>;
    /** Api del SDK de mentira, con lo justo para construir URLs. */
    api: Record<string, unknown>;
    /** Métodos de `getLibraryApi` que usa la cadena de reproducción. */
    libraryApi: Record<string, ReturnType<typeof vi.fn>>;
    /** Usuario en sesión, tal como lo devuelve `getUserApi`. */
    user: Record<string, unknown>;
    loading: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };
    alert: ReturnType<typeof vi.fn>;
    /** Players que verá el manager al construirse. */
    players: FakePlayer[];
}

/** Player de mentira: registra lo que le piden y deja controlar el resultado. */
export interface FakePlayer {
    name: string;
    id: string;
    type: string;
    isLocalPlayer: boolean;
    priority: number;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    getDeviceProfile: ReturnType<typeof vi.fn>;
    canPlayMediaType: (mediaType: string) => boolean;
    /** Los items que no son del servidor solo se reproducen si el player lo dice. */
    canPlayUrl: (url: string) => boolean;
    supports: (feature: string) => boolean;
    currentTime: () => number;
    duration: () => number;
    paused: () => boolean;
    volume: () => number;
    isMuted: () => boolean;
    getBufferedRanges: () => unknown[];
}

/**
 * Crea el player de mentira. `play` resuelve por defecto; un test puede
 * hacerla fallar con `player.play.mockRejectedValue(...)`.
 */
export function createFakePlayer(harness: PlaybackHarness): FakePlayer {
    return {
        name: 'FakePlayer',
        id: 'fakeplayer',
        type: 'mediaplayer',
        isLocalPlayer: true,
        priority: 1,
        play: vi.fn(() => {
            harness.calls.push('player.play');
            return Promise.resolve();
        }),
        stop: vi.fn(() => {
            harness.calls.push('player.stop');
            return Promise.resolve();
        }),
        destroy: vi.fn(() => {
            harness.calls.push('player.destroy');
        }),
        getDeviceProfile: vi.fn(() => Promise.resolve({
            TranscodingProfiles: [{ Type: 'Video', Context: 'Streaming', Container: 'ts' }],
            DirectPlayProfiles: [{ Type: 'Video', Container: 'mp4' }],
            CodecProfiles: []
        })),
        canPlayMediaType: (mediaType: string) => mediaType === 'Video' || mediaType === 'Audio',
        canPlayUrl: () => true,
        supports: () => false,
        currentTime: () => 0,
        duration: () => 0,
        paused: () => false,
        volume: () => 100,
        isMuted: () => false,
        getBufferedRanges: () => []
    };
}

/** Estado compartido entre los mocks; se rellena en `installPlaybackMocks`. */
const harness: PlaybackHarness = {
    playbackInfo: { MediaSources: [] },
    calls: [],
    apiClient: {},
    api: {
        basePath: 'https://srv',
        accessToken: 'token-1',
        deviceInfo: { id: 'dev-1' },
        getUri: (url: string, params?: object) => {
            const query = new URLSearchParams(
                Object.entries(params ?? {})
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)])
            ).toString();
            const suffix = query ? `?${query}` : '';
            return `https://srv${url}${suffix}`;
        }
    },
    libraryApi: {
        getItem: vi.fn(() => Promise.resolve({
            data: {
                Id: 'item-1',
                MediaStreams: [{ Type: 'Audio', Index: 1, Codec: 'aac', Language: 'spa' }]
            }
        })),
        getItems: vi.fn(() => Promise.resolve({ data: { Items: [], TotalRecordCount: 0 } })),
        getIntros: vi.fn(() => Promise.resolve({ data: { Items: [] } })),
        getLocalTrailers: vi.fn(() => Promise.resolve({ data: [] }))
    },
    user: {
        Id: 'user-1',
        Configuration: { RememberAudioSelections: true, RememberSubtitleSelections: true }
    },
    loading: { show: vi.fn(), hide: vi.fn() },
    alert: vi.fn(),
    players: []
};

export function getHarness(): PlaybackHarness {
    return harness;
}

/** Deja el banco como recién montado, con un item de vídeo reproducible. */
export function resetHarness(): void {
    harness.calls.length = 0;
    harness.playbackInfo = {
        MediaSources: [{
            Id: 'ms-1',
            Container: 'mp4',
            SupportsDirectPlay: true,
            SupportsDirectStream: true,
            SupportsTranscoding: true,
            Protocol: 'File',
            RunTimeTicks: 1_000_000,
            MediaStreams: [
                { Type: 'Video', Index: 0, Codec: 'h264' },
                { Type: 'Audio', Index: 1, Codec: 'aac', Language: 'spa' }
            ],
            DefaultAudioStreamIndex: 1
        }]
    };
    harness.loading.show.mockClear();
    harness.loading.hide.mockClear();
    harness.alert.mockClear();
    harness.players.length = 0;
}

/**
 * Registra todos los `vi.mock` que necesita playbackmanager.
 *
 * Se llama desde el nivel superior del fichero de test, ANTES del import
 * dinámico del manager: `vi.mock` se iza, pero las factorías se ejecutan al
 * resolver cada módulo.
 */
export function installPlaybackMocks(): void {
    vi.mock('lib/jellyfin-apiclient', () => ({
        ServerConnections: {
            getApiClient: () => harness.apiClient,
            currentApiClient: () => harness.apiClient,
            getApi: () => harness.api,
            getCurrentUserId: () => 'user-1',
            getCurrentServerId: () => 'srv-1',
            getServerInfo: () => ({ Id: 'srv-1' })
        }
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
        getLibraryApi: () => harness.libraryApi
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/user-api', () => ({
        getUserApi: () => ({
            getCurrentUser: () => Promise.resolve({ data: harness.user })
        })
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/show-api', () => ({
        getShowApi: () => ({
            getNextUp: () => Promise.resolve({ data: { Items: [] } }),
            getEpisodes: () => Promise.resolve({ data: { Items: [], TotalRecordCount: 0 } })
        })
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/video-api', () => ({
        getVideoApi: () => ({
            getAdditionalPart: () => Promise.resolve({ data: { Items: [] } })
        })
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/instant-mix-api', () => ({
        getInstantMixApi: () => ({
            getInstantMixFromItem: () => Promise.resolve({ data: { Items: [] } })
        })
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/system-api', () => ({
        getSystemApi: () => ({
            getEndpointInfo: () => Promise.resolve({ data: { IsInNetwork: true, IsLocal: true } })
        })
    }));

    vi.mock('@jellyfin/sdk/lib/utils/api/media-info-api', () => ({
        getMediaInfoApi: () => ({
            getPostedPlaybackInfo: () => {
                harness.calls.push('getPlaybackInfo');
                return Promise.resolve({ data: harness.playbackInfo });
            }
        })
    }));

    vi.mock('components/pluginManager', () => ({
        pluginManager: {
            ofType: (type: string) => (type === 'mediaplayer' ? harness.players : [])
        }
    }));

    vi.mock('components/loading/loading', () => ({ default: harness.loading }));
    vi.mock('components/alert', () => ({ default: harness.alert }));
    vi.mock('lib/globalize', () => ({ default: { translate: (k: string) => k } }));
    vi.mock('components/apphost', () => ({ appHost: { supports: () => false } }));
    vi.mock('components/itemHelper', () => ({ default: { isLocalItem: () => false } }));
    vi.mock('scripts/datetime', () => ({ default: { getDisplayRunningTime: () => '' } }));

    vi.mock('scripts/settings/appSettings', () => ({
        default: {
            maxStaticMusicBitrate: () => 320000,
            maxStreamingBitrate: () => 10_000_000,
            maxChromecastBitrate: () => null,
            enableAutomaticBitrateDetection: () => false,
            alwaysBurnInSubtitleWhenTranscoding: () => false
        }
    }));

    vi.mock('scripts/settings/userSettings', () => ({
        enableCinemaMode: () => false,
        enableNextVideoInfoOverlay: () => false,
        maxChromecastBitrate: () => null,
        selectAudioNormalization: () => 'Off',
        skipBackLength: () => 10000,
        skipForwardLength: () => 30000
    }));

    vi.mock('utils/sdk/backdropImage', () => ({
        getItemBackdropImageUrl: () => null
    }));

    vi.mock('utils/bitrateTest', () => ({
        detectBitrate: () => Promise.reject(new Error('sin prueba de ancho de banda'))
    }));

    // Estos dos se enganchan al singleton al importar el módulo.
    vi.mock('components/playback/utils/mediaSegmentManager', () => ({
        bindMediaSegmentManager: () => undefined
    }));
    vi.mock('components/playback/utils/mediaSessionSubscriber', () => ({
        bindMediaSessionSubscriber: () => undefined
    }));

    vi.mock('screenfull', () => ({
        default: { isEnabled: false, on: vi.fn(), off: vi.fn() }
    }));
}

/** ApiClient de mentira. Se reinstala en cada test para poder ajustarlo. */
export function createFakeApiClient(overrides: Record<string, unknown> = {}) {
    const client = {
        serverId: () => 'srv-1',
        getCurrentUserId: () => 'user-1',
        deviceId: () => 'dev-1',
        accessToken: () => 'token-1',
        getUrl: (path: string, params?: Record<string, unknown>) => {
            const query = new URLSearchParams(
                Object.entries(params ?? {})
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)])
            ).toString();
            const suffix = query ? `?${query}` : '';
            return `https://srv/${path}${suffix}`;
        },
        getItem: vi.fn(() => Promise.resolve({
            Id: 'item-1',
            MediaStreams: [{ Type: 'Audio', Index: 1, Codec: 'aac', Language: 'spa' }]
        })),
        getCurrentUser: vi.fn(() => Promise.resolve({
            Id: 'user-1',
            Configuration: { RememberAudioSelections: true, RememberSubtitleSelections: true }
        })),
        getEndpointInfo: vi.fn(() => Promise.resolve({ IsInNetwork: true, IsLocal: true })),
        getSavedEndpointInfo: vi.fn(() => ({ IsInNetwork: true, IsLocal: true })),
        getAdditionalVideoParts: vi.fn(() => Promise.resolve({ Items: [] })),
        getIntros: vi.fn(() => Promise.resolve({ Items: [] })),
        reportPlaybackStart: vi.fn(() => Promise.resolve()),
        reportPlaybackProgress: vi.fn(() => Promise.resolve()),
        reportPlaybackStopped: vi.fn(() => Promise.resolve()),
        ajax: vi.fn(() => Promise.resolve({})),
        ...overrides
    };
    harness.apiClient = client;
    return client;
}

/** Item de vídeo del servidor, listo para reproducir. */
export function videoItem(overrides: Record<string, unknown> = {}) {
    return {
        Id: 'item-1',
        ServerId: 'srv-1',
        Name: 'Una película',
        Type: 'Movie',
        MediaType: 'Video',
        RunTimeTicks: 1_000_000,
        ...overrides
    };
}
