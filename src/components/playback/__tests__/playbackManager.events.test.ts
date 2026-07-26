/**
 * Tests de caracterización de la máquina de eventos (D1.8).
 *
 * El manager escucha al player (`stopped`, `error`, `pause`, `unpause`,
 * `timeupdate`…) y traduce cada uno a estado propio, informes al servidor y
 * eventos hacia el resto de la app. Esa traducción es lo que más fácil se
 * rompe al mover código, así que aquí queda fijada tal como está hoy.
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Arranca una reproducción y deja el manager en estado "reproduciendo". */
async function startPlayback(items = [videoItem()]) {
    await manager.play({ items });
    await settle();
}

beforeEach(() => {
    resetHarness();
    createFakeApiClient();
    player = createFakePlayer(harness);
    harness.players.push(player);
    manager = new PlaybackManager();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('el player avisa de que ha parado', () => {
    it('emite playbackstop en el player y en el manager', async () => {
        await startPlayback();
        const onManager = vi.fn();
        const onPlayer = vi.fn();
        Events.on(manager, 'playbackstop', onManager);
        Events.on(player, 'playbackstop', onPlayer);

        Events.trigger(player, 'stopped');
        await settle();

        expect(onPlayer).toHaveBeenCalledOnce();
        expect(onManager).toHaveBeenCalledOnce();
    });

    it('informa al servidor de la parada', async () => {
        await startPlayback();
        const report = harness.serverReports.reportPlaybackStopped as ReturnType<typeof vi.fn>;

        Events.trigger(player, 'stopped');
        await settle();

        expect(report).toHaveBeenCalledOnce();
        expect(report.mock.calls[0][0]).toMatchObject({ ItemId: 'item-1' });
    });

    it('el informe de parada lleva el item y si hay siguiente', async () => {
        await startPlayback();
        const onManager = vi.fn();
        Events.on(manager, 'playbackstop', onManager);

        Events.trigger(player, 'stopped');
        await settle();

        const info = onManager.mock.calls[0][1];
        expect(info.state.NowPlayingItem).toMatchObject({ Id: 'item-1' });
        expect(info.player).toBe(player);
        expect(info.nextItem).toBeNull();
    });
});

describe('el manager no reemite los cambios del player: los informa', () => {
    /** Nombres de evento que el servidor recibe en el informe de progreso. */
    const reported = (): string[] => {
        const report = harness.serverReports.reportPlaybackProgress as ReturnType<typeof vi.fn>;
        return report.mock.calls.map((c) => (c[0] as { EventName?: string }).EventName ?? '');
    };

    it('pausa y reanudación viajan como nombre de evento en el informe', async () => {
        await startPlayback();
        (harness.serverReports.reportPlaybackProgress as ReturnType<typeof vi.fn>).mockClear();

        Events.trigger(player, 'pause');
        Events.trigger(player, 'unpause');
        await settle();

        expect(reported()).toEqual(['pause', 'unpause']);
    });

    it('el volumen y los modos de cola también', async () => {
        await startPlayback();
        (harness.serverReports.reportPlaybackProgress as ReturnType<typeof vi.fn>).mockClear();

        Events.trigger(player, 'volumechange');
        Events.trigger(player, 'repeatmodechange');
        Events.trigger(player, 'shufflequeuemodechange');
        await settle();

        expect(reported()).toEqual(['volumechange', 'repeatmodechange', 'shufflequeuemodechange']);
    });
});

describe('errores del player', () => {
    /** Fuente que el servidor no sabe transcodificar: no hay reintento posible. */
    function withoutTranscoding() {
        harness.playbackInfo.MediaSources[0].SupportsTranscoding = false;
    }

    it('avisa con playbackerror cuando no queda reintento', async () => {
        withoutTranscoding();
        await startPlayback();
        const onError = vi.fn();
        Events.on(manager, 'playbackerror', onError);

        Events.trigger(player, 'error', [{ type: 'MediaDecodeError' }]);
        await settle();

        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][1]).toBe('MediaDecodeError');
    });

    it('un error también para la reproducción', async () => {
        withoutTranscoding();
        await startPlayback();
        const onStop = vi.fn();
        Events.on(manager, 'playbackstop', onStop);

        Events.trigger(player, 'error', [{ type: 'MediaDecodeError' }]);
        await settle();

        expect(onStop).toHaveBeenCalledOnce();
    });

    it('si la fuente admite transcodificación, reintenta en vez de rendirse', async () => {
        // El manager cambia de stream forzando transcodificación; no llega a
        // emitir playbackerror.
        await startPlayback();
        const onError = vi.fn();
        Events.on(manager, 'playbackerror', onError);

        Events.trigger(player, 'error', [{ type: 'MediaDecodeError' }]);
        await settle();

        expect(onError).not.toHaveBeenCalled();
    });
});

describe('latido de progreso', () => {
    /**
     * Reproduce con el reloj ya intervenido: el intervalo se crea dentro de
     * `play()`, así que los timers falsos tienen que estar puestos antes.
     * `advanceTimersByTimeAsync` avanza el reloj y además vacía microtareas,
     * que es lo que necesita la cadena de promesas.
     */
    async function playWithFakeClock() {
        vi.useFakeTimers();
        const started = manager.play({ items: [videoItem()] });
        await vi.advanceTimersByTimeAsync(0);
        await started;
        await vi.advanceTimersByTimeAsync(0);
    }

    const progressReports = () =>
        (harness.serverReports.reportPlaybackProgress as ReturnType<typeof vi.fn>);

    afterEach(() => {
        vi.useRealTimers();
    });

    it('informa al servidor cada 10 s mientras se reproduce', async () => {
        await playWithFakeClock();
        progressReports().mockClear();

        await vi.advanceTimersByTimeAsync(30_000);

        expect(progressReports()).toHaveBeenCalledTimes(3);
    });

    it('el informe del latido va como timeupdate', async () => {
        await playWithFakeClock();
        progressReports().mockClear();

        await vi.advanceTimersByTimeAsync(10_000);

        expect(progressReports().mock.calls[0][0]).toMatchObject({ EventName: 'timeupdate' });
    });

    it('al parar deja de latir', async () => {
        await playWithFakeClock();
        Events.trigger(player, 'stopped');
        await vi.advanceTimersByTimeAsync(0);
        progressReports().mockClear();

        await vi.advanceTimersByTimeAsync(30_000);

        expect(progressReports()).not.toHaveBeenCalled();
    });

    it('el latido no ensucia el objeto del player', async () => {
        await startPlayback();

        expect(player).not.toHaveProperty('_progressInterval');
    });
});

describe('estado que expone el manager mientras se reproduce', () => {
    it('getPlayerState describe el item y la fuente en curso', async () => {
        await startPlayback();

        const state = manager.getPlayerState(player);

        expect(state.NowPlayingItem).toMatchObject({ Id: 'item-1' });
        expect(state.PlayState).toBeDefined();
    });

    it('la cola queda con el item y sin siguiente', async () => {
        await startPlayback();

        expect(manager.getCurrentPlaylistIndex()).toBe(0);
        expect(manager.getNextItem()).toBeFalsy();
    });

    it('con dos items, el segundo es el siguiente de la cola', async () => {
        await startPlayback([videoItem(), videoItem({ Id: 'item-2' })]);

        // Devuelve la entrada de cola (item + índice), no el item pelado.
        expect(manager.getNextItem()).toMatchObject({
            item: expect.objectContaining({ Id: 'item-2' })
        });
    });

    it('al parar deja de haber reproducción en curso', async () => {
        await startPlayback();

        Events.trigger(player, 'stopped');
        await settle();

        expect(manager.isPlaying()).toBe(false);
    });
});

describe('parar desde la app', () => {
    it('stop() se lo pide al player en vez de cortar por su cuenta', async () => {
        await startPlayback();

        await manager.stop();

        expect(player.stop).toHaveBeenCalledOnce();
    });

    it('stop() sin nada reproduciéndose no falla', async () => {
        await expect(manager.stop()).resolves.toBeUndefined();
    });
});
