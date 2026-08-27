import { describe, expect, test, vi } from 'vitest';
import { CastBinding } from '../castBinding';
import { SubtitlesBinding } from '../subtitlesBinding';

describe('CastBinding', () => {
    test('estado inicial y reset', () => {
        const cast = new CastBinding();
        expect(cast.castAvailable.value).toBe(false);
        expect(cast.castState.value).toBe('disconnected');

        cast.castAvailable.value = true;
        cast.castState.value = 'connected';
        cast.reset();

        expect(cast.castAvailable.value).toBe(false);
        expect(cast.castState.value).toBe('disconnected');
    });

    test('prompt llama a remote.prompt si existe', () => {
        const cast = new CastBinding();
        const prompt = vi.fn().mockResolvedValue(undefined);
        const fakeVideo = {
            remote: { prompt }
        } as unknown as HTMLVideoElement;

        cast.prompt(fakeVideo);
        expect(prompt).toHaveBeenCalled();
    });

    test('pauseForCast pausa el video y detiene el progreso', () => {
        const cast = new CastBinding();
        const pause = vi.fn();
        const stopProgress = vi.fn();
        const fakeVideo = { pause } as unknown as HTMLVideoElement;

        cast.pauseForCast(fakeVideo, stopProgress);
        expect(pause).toHaveBeenCalled();
        expect(stopProgress).toHaveBeenCalled();
    });

    test('watch maneja listeners y cancelWatchAvailability', async () => {
        const cast = new CastBinding();
        const listeners = new Map<string, () => void>();
        const cancelWatchAvailability = vi.fn().mockResolvedValue(undefined);
        const fakeRemote = {
            state: 'disconnected' as RemotePlaybackState,
            addEventListener: vi.fn((event: string, handler: () => void) => {
                listeners.set(event, handler);
            }),
            removeEventListener: vi.fn(),
            watchAvailability: vi.fn((cb: (available: boolean) => void) => {
                cb(true);
                return Promise.resolve(42);
            }),
            cancelWatchAvailability
        };
        const fakeVideo = { remote: fakeRemote } as unknown as HTMLVideoElement;

        const cleanup = cast.watch(fakeVideo);
        expect(cast.castAvailable.value).toBe(true);

        listeners.get('connecting')?.();
        expect(cast.castState.value).toBe('connecting');

        listeners.get('connect')?.();
        expect(cast.castState.value).toBe('connected');

        listeners.get('disconnect')?.();
        expect(cast.castState.value).toBe('disconnected');

        await Promise.resolve();
        cleanup();
        expect(fakeRemote.removeEventListener).toHaveBeenCalledWith('connecting', expect.any(Function));
        expect(cancelWatchAvailability).toHaveBeenCalledWith(42);
    });
});

describe('SubtitlesBinding', () => {
    test('publishSubtitle aplica al instante si ya empezó o url es null', () => {
        const sub = new SubtitlesBinding();

        sub.publishSubtitle('http://vtt/1', true);
        expect(sub.subtitleUrl.value).toBe('http://vtt/1');

        sub.publishSubtitle(null, false);
        expect(sub.subtitleUrl.value).toBeNull();
    });

    test('publishSubtitle retiene url si no ha empezado y flushPendingSubtitle la suelta', () => {
        const sub = new SubtitlesBinding();
        sub.publishSubtitle('http://vtt/2', false);
        expect(sub.subtitleUrl.value).toBeNull();

        sub.flushPendingSubtitle();
        expect(sub.subtitleUrl.value).toBe('http://vtt/2');
    });

    test('reset limpia todos los signals y propiedades', () => {
        const sub = new SubtitlesBinding();
        sub.subtitleTracks.value = [{ index: 1, displayTitle: 'ES', isDefault: true, isText: true }];
        sub.selectedSubtitle.value = 1;
        sub.subtitleUrl.value = 'http://vtt/1';
        sub.burnedSubtitle = 2;

        sub.reset();
        expect(sub.subtitleTracks.value).toEqual([]);
        expect(sub.selectedSubtitle.value).toBeNull();
        expect(sub.subtitleUrl.value).toBeNull();
        expect(sub.burnedSubtitle).toBeNull();
    });
});
