import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { SleepTimerTracker } from '../sleepTimer';

describe('SleepTimerTracker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('estado inicial', () => {
        const onExpire = vi.fn();
        const tracker = new SleepTimerTracker(onExpire);

        expect(tracker.mode.value).toBe('off');
        expect(tracker.remainingSeconds.value).toBeNull();
    });

    test('cuenta atrás en modo minutos y expiración', () => {
        const onExpire = vi.fn();
        const tracker = new SleepTimerTracker(onExpire);

        tracker.setMode('15');
        expect(tracker.mode.value).toBe('15');
        expect(tracker.remainingSeconds.value).toBe(15 * 60);

        // Avanzamos 10 segundos
        vi.advanceTimersByTime(10_000);
        expect(tracker.remainingSeconds.value).toBe(15 * 60 - 10);
        expect(onExpire).not.toHaveBeenCalled();

        // Avanzamos el resto del tiempo hasta llegar a 0
        vi.advanceTimersByTime((15 * 60 - 10) * 1000);
        expect(tracker.remainingSeconds.value).toBeNull();
        expect(tracker.mode.value).toBe('off');
        expect(onExpire).toHaveBeenCalledTimes(1);
    });

    test('cambiar de modo resetea el temporizador previo', () => {
        const onExpire = vi.fn();
        const tracker = new SleepTimerTracker(onExpire);

        tracker.setMode('30');
        vi.advanceTimersByTime(60_000);
        expect(tracker.remainingSeconds.value).toBe(29 * 60);

        tracker.setMode('off');
        expect(tracker.mode.value).toBe('off');
        expect(tracker.remainingSeconds.value).toBeNull();

        vi.advanceTimersByTime(30 * 60_000);
        expect(onExpire).not.toHaveBeenCalled();
    });

    test('modo episode intercepta el fin de episodio y vuelve a off', () => {
        const onExpire = vi.fn();
        const tracker = new SleepTimerTracker(onExpire);

        tracker.setMode('episode');
        expect(tracker.mode.value).toBe('episode');
        expect(tracker.remainingSeconds.value).toBeNull();

        const stopped = tracker.handleEpisodeEnd();
        expect(stopped).toBe(true);
        expect(tracker.mode.value).toBe('off');

        // Si ya está en off, handleEpisodeEnd devuelve false
        expect(tracker.handleEpisodeEnd()).toBe(false);
    });

    test('reset y dispose limpian temporizadores e intervalos', () => {
        const onExpire = vi.fn();
        const tracker = new SleepTimerTracker(onExpire);

        tracker.setMode('45');
        tracker.reset();

        expect(tracker.mode.value).toBe('off');
        expect(tracker.remainingSeconds.value).toBeNull();

        tracker.setMode('60');
        tracker.dispose();

        expect(tracker.mode.value).toBe('off');
        expect(tracker.remainingSeconds.value).toBeNull();

        vi.advanceTimersByTime(60 * 60_000);
        expect(onExpire).not.toHaveBeenCalled();
    });
});
