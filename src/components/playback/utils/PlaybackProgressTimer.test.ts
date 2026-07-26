import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Player } from '../types/player';
import { PROGRESS_REPORT_INTERVAL_MS, PlaybackProgressTimer } from './PlaybackProgressTimer';

function makePlayer(name = 'Reproductor'): Player {
    return { name, id: name, canPlayMediaType: () => true };
}

let timers: PlaybackProgressTimer;
let player: Player;

beforeEach(() => {
    vi.useFakeTimers();
    timers = new PlaybackProgressTimer();
    player = makePlayer();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('PlaybackProgressTimer', () => {
    it('informa cada intervalo mientras corre', () => {
        const tick = vi.fn();
        timers.start(player, tick);

        vi.advanceTimersByTime(PROGRESS_REPORT_INTERVAL_MS * 3);

        expect(tick).toHaveBeenCalledTimes(3);
    });

    it('no informa antes de cumplirse el primer intervalo', () => {
        const tick = vi.fn();
        timers.start(player, tick);

        vi.advanceTimersByTime(PROGRESS_REPORT_INTERVAL_MS - 1);

        expect(tick).not.toHaveBeenCalled();
    });

    it('al parar deja de informar', () => {
        const tick = vi.fn();
        timers.start(player, tick);

        timers.stop(player);
        vi.advanceTimersByTime(PROGRESS_REPORT_INTERVAL_MS * 5);

        expect(tick).not.toHaveBeenCalled();
        expect(timers.active).toBe(0);
    });

    it('arrancar de nuevo reinicia la cuenta, no la duplica', () => {
        // Al empezar una pista nueva se cuenta desde cero en vez de heredar
        // lo que quedaba del intervalo anterior.
        const primero = vi.fn();
        const segundo = vi.fn();
        timers.start(player, primero);

        vi.advanceTimersByTime(PROGRESS_REPORT_INTERVAL_MS - 1);
        timers.start(player, segundo);
        vi.advanceTimersByTime(PROGRESS_REPORT_INTERVAL_MS);

        expect(primero).not.toHaveBeenCalled();
        expect(segundo).toHaveBeenCalledOnce();
        expect(timers.active).toBe(1);
    });

    it('cada player lleva su propio latido', () => {
        const otro = makePlayer('Otro');
        const unoTick = vi.fn();
        const otroTick = vi.fn();

        timers.start(player, unoTick);
        timers.start(otro, otroTick);
        expect(timers.active).toBe(2);

        timers.stop(player);
        vi.advanceTimersByTime(PROGRESS_REPORT_INTERVAL_MS);

        expect(unoTick).not.toHaveBeenCalled();
        expect(otroTick).toHaveBeenCalledOnce();
    });

    it('parar uno que no estaba corriendo no hace nada', () => {
        expect(() => timers.stop(player)).not.toThrow();
        expect(timers.active).toBe(0);
    });

    it('NO guarda el intervalo en el objeto del player', () => {
        timers.start(player, vi.fn());

        expect(player).not.toHaveProperty('_progressInterval');
    });
});
