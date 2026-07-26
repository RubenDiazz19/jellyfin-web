import { beforeEach, describe, expect, it, vi } from 'vitest';

import Events from 'utils/events';

import type { PlaybackManagerLike, Player, QueueItem } from '../types/player';

const getApiClient = vi.hoisted(() => vi.fn());
// ServerConnections arrastra el ApiClient legacy entero; aquí solo hace falta
// poder mirar qué se le manda.
vi.mock('lib/jellyfin-apiclient', () => ({ ServerConnections: { getApiClient } }));

const {
    addPlaylistToPlaybackReport,
    getNowPlayingItemForReporting,
    getPlaylistSync,
    reportPlayback
} = await import('./playbackReporting');

function makePlayer(overrides: Partial<Player> = {}): Player {
    return {
        name: 'Reproductor',
        id: 'p1',
        canPlayMediaType: () => true,
        ...overrides
    };
}

function makeManager(overrides: Partial<PlaybackManagerLike> = {}): PlaybackManagerLike {
    return {
        _playQueueManager: { getPlaylist: () => [] },
        getPlayers: () => [],
        getSupportedCommands: () => [],
        ...overrides
    };
}

const queueItem = (Id: string, extra: Partial<QueueItem> = {}): QueueItem => ({
    Id, PlaylistItemId: `pl-${Id}`, ServerId: 'srv-1', ...extra
});

/** ApiClient de mentira que recuerda el informe recibido. */
function stubApiClient() {
    const calls: Record<string, unknown[]> = {};
    const record = (name: string) => vi.fn((info: unknown) => {
        calls[name] = [...(calls[name] ?? []), info];
        return Promise.resolve();
    });
    const client = {
        reportPlaybackStart: record('reportPlaybackStart'),
        reportPlaybackProgress: record('reportPlaybackProgress'),
        reportPlaybackStopped: record('reportPlaybackStopped')
    };
    getApiClient.mockReturnValue(client);
    return { client, calls };
}

beforeEach(() => {
    getApiClient.mockReset();
});

describe('getPlaylistSync', () => {
    it('usa la cola del manager cuando el player local no lleva la suya', () => {
        const cola = [queueItem('a')];
        const manager = makeManager({ _playQueueManager: { getPlaylist: () => cola } });

        expect(getPlaylistSync(manager, makePlayer({ isLocalPlayer: true }))).toBe(cola);
    });

    it('usa la del player cuando la gestiona él', () => {
        const suya = [queueItem('b')];
        const player = makePlayer({
            getPlaylist: () => Promise.resolve([]),
            getPlaylistSync: () => suya
        });

        expect(getPlaylistSync(makeManager(), player)).toBe(suya);
    });

    it('sin player explícito cae en el player activo', () => {
        const suya = [queueItem('c')];
        const activo = makePlayer({
            getPlaylist: () => Promise.resolve([]),
            getPlaylistSync: () => suya
        });

        expect(getPlaylistSync(makeManager({ _currentPlayer: activo }))).toBe(suya);
    });

    it('sin ningún player devuelve la cola del manager', () => {
        const cola = [queueItem('d')];
        const manager = makeManager({
            _currentPlayer: null,
            _playQueueManager: { getPlaylist: () => cola }
        });

        expect(getPlaylistSync(manager)).toBe(cola);
    });
});

describe('addPlaylistToPlaybackReport', () => {
    it('manda id y PlaylistItemId de cada entrada', () => {
        const manager = makeManager({
            _playQueueManager: { getPlaylist: () => [queueItem('a'), queueItem('b')] }
        });
        const info = {};

        addPlaylistToPlaybackReport(manager, info, null, 'srv-1');

        expect(info).toEqual({
            NowPlayingQueue: [
                { Id: 'a', PlaylistItemId: 'pl-a' },
                { Id: 'b', PlaylistItemId: 'pl-b' }
            ]
        });
    });

    it('solo añade ServerId cuando el item es de otro servidor', () => {
        const manager = makeManager({
            _playQueueManager: {
                getPlaylist: () => [queueItem('a'), queueItem('b', { ServerId: 'otro' })]
            }
        });
        const info: { NowPlayingQueue?: Array<{ ServerId?: string }> } = {};

        addPlaylistToPlaybackReport(manager, info, null, 'srv-1');

        expect(info.NowPlayingQueue?.[0].ServerId).toBeUndefined();
        expect(info.NowPlayingQueue?.[1].ServerId).toBe('otro');
    });
});

describe('reportPlayback', () => {
    const state = {
        NowPlayingItem: { Id: 'item-1' },
        PlayState: { PositionTicks: 500, IsPaused: false }
    };

    it('envía el PlayState con el id del item por el método pedido', async () => {
        const { calls } = stubApiClient();

        reportPlayback(makeManager(), state, null, false, 'srv-1', 'reportPlaybackProgress');
        await vi.waitFor(() => expect(calls.reportPlaybackProgress).toBeDefined());

        expect(calls.reportPlaybackProgress[0]).toEqual({
            PositionTicks: 500,
            IsPaused: false,
            ItemId: 'item-1'
        });
    });

    it('no muta el PlayState que le pasan', () => {
        stubApiClient();
        const playState = { PositionTicks: 500 };

        reportPlayback(
            makeManager(), { NowPlayingItem: { Id: 'i' }, PlayState: playState },
            null, false, 'srv-1', 'reportPlaybackStart'
        );

        expect(playState).toEqual({ PositionTicks: 500 });
    });

    it('incluye el nombre del evento cuando se indica', async () => {
        const { calls } = stubApiClient();

        reportPlayback(
            makeManager(), state, null, false, 'srv-1', 'reportPlaybackProgress', 'timeupdate'
        );
        await vi.waitFor(() => expect(calls.reportPlaybackProgress).toBeDefined());

        expect(calls.reportPlaybackProgress[0]).toMatchObject({ EventName: 'timeupdate' });
    });

    it('adjunta la cola solo si se pide', async () => {
        const { calls } = stubApiClient();
        const manager = makeManager({
            _playQueueManager: { getPlaylist: () => [queueItem('a')] }
        });

        reportPlayback(manager, state, null, true, 'srv-1', 'reportPlaybackStart');
        await vi.waitFor(() => expect(calls.reportPlaybackStart).toBeDefined());

        expect(calls.reportPlaybackStart[0]).toMatchObject({
            NowPlayingQueue: [{ Id: 'a', PlaylistItemId: 'pl-a' }]
        });
    });

    it('sin servidor no informa y avisa con false', () => {
        const manager = makeManager();
        const onReport = vi.fn();
        Events.on(manager, 'reportplayback', onReport);

        reportPlayback(manager, state, null, false, null, 'reportPlaybackStart');

        expect(getApiClient).not.toHaveBeenCalled();
        expect(onReport).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('avisa con true cuando el envío ha ido bien', async () => {
        stubApiClient();
        const manager = makeManager();
        const onReport = vi.fn();
        Events.on(manager, 'reportplayback', onReport);

        reportPlayback(manager, state, null, false, 'srv-1', 'reportPlaybackStart');

        await vi.waitFor(() => {
            expect(onReport).toHaveBeenCalledWith(expect.anything(), true);
        });
    });
});

describe('getNowPlayingItemForReporting', () => {
    const player = makePlayer({ duration: () => 0 });

    it('la duración y las pistas salen de la fuente elegida, no del item', () => {
        const item = { Id: 'i', RunTimeTicks: 100, MediaStreams: [] };
        const mediaSource = { RunTimeTicks: 999, MediaStreams: [{ Index: 0 }] };

        const reported = getNowPlayingItemForReporting(player, item, mediaSource);

        expect(reported.RunTimeTicks).toBe(999);
        expect(reported.MediaStreams).toEqual([{ Index: 0 }]);
    });

    it('descarta MediaSources: el servidor no la necesita y abulta', () => {
        const item = { Id: 'i', MediaSources: [{ Id: 'ms' }] };

        const reported = getNowPlayingItemForReporting(player, item, { RunTimeTicks: 1 });

        expect(reported.MediaSources).toBeNull();
    });

    it('no muta el item original', () => {
        const item = { Id: 'i', RunTimeTicks: 100 };

        getNowPlayingItemForReporting(player, item, { RunTimeTicks: 999 });

        expect(item.RunTimeTicks).toBe(100);
    });

    it('sin duración conocida la toma del player (ms → ticks)', () => {
        const item = { Id: 'i' };

        const reported = getNowPlayingItemForReporting(makePlayer({ duration: () => 42 }), item);

        expect(reported.RunTimeTicks).toBe(420_000);
    });

    it('sin fuente conserva la duración del item', () => {
        const reported = getNowPlayingItemForReporting(player, { Id: 'i', RunTimeTicks: 77 });

        expect(reported.RunTimeTicks).toBe(77);
    });
});
