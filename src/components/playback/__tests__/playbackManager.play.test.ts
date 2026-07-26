/**
 * Tests de caracterización de `play()` (D1.8).
 *
 * No comprueban lo que el código *debería* hacer, sino lo que hace HOY. Son la
 * red de seguridad para poder mover el resto de `playbackmanager` a métodos de
 * clase (D1.9 en adelante) sabiendo si algo cambia de comportamiento.
 *
 * Por eso hay asertos sobre detalles que parecen menores —el orden exacto de
 * los pasos, quién llama a `loading.hide()`, que se informe del inicio incluso
 * cuando el player falla—: justo eso es lo que se rompe en un refactor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Events from 'utils/events';

import {
    createFakeApiClient,
    createFakePlayer,
    getHarness,
    installPlaybackMocks,
    resetHarness,
    videoItem,
    type FakePlayer
} from './playbackHarness';

installPlaybackMocks();

const { PlaybackManager } = await import('../playbackmanager');

const harness = getHarness();

let manager: InstanceType<typeof PlaybackManager>;
let player: FakePlayer;

/** Espera a que se vacíe la cola de microtareas de la cadena de reproducción. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    resetHarness();
    createFakeApiClient();
    player = createFakePlayer(harness);
    harness.players.push(player);
    manager = new PlaybackManager();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('play(): el camino feliz', () => {
    it('recorre los pasos en orden hasta entregarle el stream al player', async () => {
        await manager.play({ items: [videoItem()] });
        await settle();

        // El orden importa: el player no puede recibir el stream antes de que
        // el servidor haya dicho qué fuente usar.
        expect(harness.calls).toEqual(['getPlaybackInfo', 'player.play']);
    });

    it('le pasa al player un stream con la URL, el item y la fuente elegida', async () => {
        await manager.play({ items: [videoItem()] });
        await settle();

        const streamInfo = player.play.mock.calls[0][0];
        expect(streamInfo).toMatchObject({
            item: expect.objectContaining({ Id: 'item-1' }),
            mediaSource: expect.objectContaining({ Id: 'ms-1' }),
            mediaType: 'Video'
        });
        expect(streamInfo.url).toBeTruthy();
    });

    it('deja el item como reproducción en curso', async () => {
        await manager.play({ items: [videoItem()] });
        await settle();

        expect(manager.getCurrentPlayer()).toBe(player);
        expect(manager.currentItem(player)).toMatchObject({ Id: 'item-1' });
    });

    it('emite playbackstart en el player y en el manager', async () => {
        const onManager = vi.fn();
        const onPlayer = vi.fn();
        Events.on(manager, 'playbackstart', onManager);
        Events.on(player, 'playbackstart', onPlayer);

        await manager.play({ items: [videoItem()] });
        await settle();

        expect(onPlayer).toHaveBeenCalledOnce();
        expect(onManager).toHaveBeenCalledOnce();
    });

    it('informa del inicio al servidor con el item en reproducción', async () => {
        await manager.play({ items: [videoItem()] });
        await settle();

        const report = harness.apiClient.reportPlaybackStart as ReturnType<typeof vi.fn>;
        expect(report).toHaveBeenCalledOnce();
        expect(report.mock.calls[0][0]).toMatchObject({ ItemId: 'item-1' });
    });

    it('el estado de reproducción no se pega al objeto del player', async () => {
        // Antes `getPlayerData()` devolvía el player, así que el manager le
        // escribía encima su estado interno. Ahora vive en PlayerStateManager.
        await manager.play({ items: [videoItem()] });
        await settle();

        expect(player).not.toHaveProperty('streamInfo');
        expect(player).not.toHaveProperty('isChangingStream');
        expect(player).not.toHaveProperty('maxStreamingBitrate');
    });

    it('deja la cola con el item y el indicador de carga apagado', async () => {
        await manager.play({ items: [videoItem()] });
        await settle();

        expect(manager.getCurrentPlaylistIndex()).toBe(0);
        expect(harness.loading.hide).toHaveBeenCalled();
    });
});

describe('play(): resolución de la fuente', () => {
    it('elige la fuente que se puede reproducir tal cual', async () => {
        harness.playbackInfo.MediaSources = [
            { Id: 'transcode', Container: 'mkv', SupportsTranscoding: true, MediaStreams: [] },
            {
                Id: 'directa', Container: 'mp4', SupportsDirectPlay: true,
                Protocol: 'Http', RequiredHttpHeaders: {}, MediaStreams: []
            }
        ];

        await manager.play({ items: [videoItem()] });
        await settle();

        expect(player.play.mock.calls[0][0].mediaSource.Id).toBe('directa');
    });

    it('sin fuentes, avisa al usuario y no arranca el player', async () => {
        harness.playbackInfo.MediaSources = [];

        await manager.play({ items: [videoItem()] });
        await settle();

        expect(player.play).not.toHaveBeenCalled();
        expect(harness.alert).toHaveBeenCalled();
    });

    it('un error del servidor corta la reproducción y se muestra', async () => {
        harness.playbackInfo = { MediaSources: [], ErrorCode: 'NoCompatibleStream' };

        await manager.play({ items: [videoItem()] });
        await settle();

        expect(player.play).not.toHaveBeenCalled();
        expect(harness.alert).toHaveBeenCalled();
    });
});

describe('play(): cuando algo va mal', () => {
    it('sin ningún player capaz, avisa y no revienta', async () => {
        harness.players.length = 0;
        manager = new PlaybackManager();

        await manager.play({ items: [videoItem()] });
        await settle();

        expect(harness.alert).toHaveBeenCalled();
        expect(harness.loading.hide).toHaveBeenCalled();
    });

    it('un item marcador de posición no se reproduce', async () => {
        // play() rechaza sin motivo (un `Promise.reject()` pelado). Queda
        // caracterizado: quien llame tiene que estar preparado para ello.
        await expect(
            manager.play({ items: [videoItem({ IsPlaceHolder: true })] })
        ).rejects.toBeUndefined();

        expect(player.play).not.toHaveBeenCalled();
        expect(harness.alert).toHaveBeenCalled();
    });

    it('sin items rechaza y avisa, en vez de quedarse callado', async () => {
        await expect(manager.play({ items: [] })).rejects.toBeUndefined();

        expect(player.play).not.toHaveBeenCalled();
        expect(harness.alert).toHaveBeenCalled();
    });

    it('play() sin items ni serverId es un error de programación', async () => {
        await expect(manager.play({ ids: ['a'] })).rejects.toThrow('serverId');
    });

    it('si el player falla, se informa igual del inicio (limitación conocida)', async () => {
        // Documentado en el propio manager: el resto del sistema da por hecho
        // que hubo un start antes de poder tratar el error.
        player.play.mockRejectedValue(new Error('no se pudo abrir'));

        await manager.play({ items: [videoItem()] });
        await settle();

        expect(harness.apiClient.reportPlaybackStart).toHaveBeenCalledOnce();
    });
});

describe('play(): items que no vienen del servidor', () => {
    it('una URL suelta se reproduce en directo, sin preguntar al servidor', async () => {
        await manager.play({
            items: [{ Name: 'Un vídeo', MediaType: 'Video', Url: 'https://ejemplo/a.mp4' }]
        });
        await settle();

        expect(harness.calls).toEqual(['player.play']);
        expect(player.play.mock.calls[0][0]).toMatchObject({
            url: 'https://ejemplo/a.mp4',
            playMethod: 'DirectPlay'
        });
    });
});

describe('estado de la instancia (D1.11)', () => {
    it('los players registrados se exponen ordenados por prioridad', () => {
        const prioritario = { ...createFakePlayer(harness), id: 'primero', priority: 0 };
        harness.players.push(prioritario);
        manager = new PlaybackManager();

        const ids = (manager.getPlayers() as FakePlayer[]).map((p) => p.id);
        expect(ids).toEqual(['primero', 'fakeplayer']);
    });

    it('dos managers no comparten ni players ni destino activo', () => {
        // El estado vive en la instancia, no en un closure compartido.
        const otro = new PlaybackManager();
        const remoto = { ...createFakePlayer(harness), isLocalPlayer: false, id: 'remoto' };

        manager.setActivePlayer(remoto, { id: 'remoto', name: 'Remoto' });

        expect(manager.getPlayerInfo()?.id).toBe('remoto');
        expect(otro.getPlayerInfo()).toBeNull();
    });

    it('el destino activo queda accesible tras elegirlo', () => {
        const remoto = { ...createFakePlayer(harness), isLocalPlayer: false, id: 'remoto' };

        manager.setActivePlayer(remoto, { id: 'remoto', name: 'Salón' });

        expect(manager.getPlayerInfo()).toMatchObject({ id: 'remoto', name: 'FakePlayer' });
    });

    it('al reproducir aquí, el destino pasa a ser el player local', async () => {
        await manager.play({ items: [videoItem()] });
        await settle();

        expect(manager.getPlayerInfo()).toMatchObject({ isLocalPlayer: true });
    });
});

describe('play(): un player remoto se queda con la reproducción', () => {
    it('si hay una sesión remota activa, se le delega tal cual', async () => {
        const remoto = { ...createFakePlayer(harness), isLocalPlayer: false, id: 'remoto' };
        manager.setActivePlayer(remoto, { id: 'remoto', name: 'Remoto' });

        const options = { items: [videoItem()] };
        await manager.play(options);
        await settle();

        expect(remoto.play).toHaveBeenCalledWith(options);
        expect(player.play).not.toHaveBeenCalled();
    });

    it('con enableRemotePlayers en false, se niega en vez de reproducir aquí', async () => {
        const remoto = { ...createFakePlayer(harness), isLocalPlayer: false, id: 'remoto' };
        manager.setActivePlayer(remoto, { id: 'remoto', name: 'Remoto' });

        await expect(
            manager.play({ items: [videoItem()], enableRemotePlayers: false })
        ).rejects.toThrow('Remote players are disabled');
    });
});
