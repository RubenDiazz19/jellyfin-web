import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerEventBinding } from '../PlayerEventBinding';
import { signal } from '@preact/signals-core';

describe('PlayerEventBinding', () => {
    let binding: PlayerEventBinding;
    let video: any;
    let host: any;
    let listeners: Record<string, ((...args: any[]) => void)[]>;

    beforeEach(() => {
        binding = new PlayerEventBinding();
        listeners = {};
        video = {
            addEventListener: vi.fn((ev, cb) => {
                if (!listeners[ev]) listeners[ev] = [];
                listeners[ev].push(cb);
            }),
            removeEventListener: vi.fn(),
            duration: 100,
            currentTime: 5,
            volume: 0.5,
            muted: false,
            playbackRate: 1,
            remote: {}
        };

        host = {
            duration: signal(0),
            volume: signal(0),
            muted: signal(false),
            playing: signal(false),
            buffering: signal(false),
            loading: signal(false),
            ended: signal(false),
            playbackRate: signal(1),
            pipAvailable: signal(false),
            pipActive: signal(false),
            fullscreen: signal(false),
            error: signal(null),

            publishTime: vi.fn(),
            syncSegments: vi.fn(),
            syncAutoNext: vi.fn(),
            startProgressTimer: vi.fn(),
            stopProgressTimer: vi.fn(),
            reportProgress: vi.fn().mockResolvedValue(undefined),
            flushPendingSubtitle: vi.fn(),
            handleEpisodeEnd: vi.fn().mockReturnValue(false),
            syncMediaSessionPlayback: vi.fn(),
            syncMediaSessionPosition: vi.fn(),
            watchCast: vi.fn().mockReturnValue(vi.fn()),
            retrySource: vi.fn().mockReturnValue(false),
            isClosed: vi.fn().mockReturnValue(false),
            setHasStarted: vi.fn()
        };

        localStorage.setItem('vol-key', '0.8');
    });

    const trigger = (ev: string) => {
        if (listeners[ev]) {
            for (const cb of listeners[ev]) cb();
        }
    };

    it('attaches and syncs initial state', () => {
        binding.attach(video, document.createElement('div'), host, 'vol-key');
        expect(video.volume).toBe(0.8);
        expect(host.volume.value).toBe(0.8);
        expect(video.addEventListener).toHaveBeenCalled();
    });

    it('detaches cleanly', () => {
        const detach = binding.attach(video, document.createElement('div'), host, 'vol-key');
        detach();
        expect(video.removeEventListener).toHaveBeenCalled();
    });

    it('responds to timeupdate', () => {
        binding.attach(video, document.createElement('div'), host, 'vol-key');
        trigger('timeupdate');

        expect(host.publishTime).toHaveBeenCalledWith(5);
        expect(host.syncSegments).toHaveBeenCalledWith(5);
    });

    it('responds to play and pause', () => {
        binding.attach(video, document.createElement('div'), host, 'vol-key');

        trigger('play');
        expect(host.playing.value).toBe(true);
        expect(host.startProgressTimer).toHaveBeenCalled();

        trigger('pause');
        expect(host.playing.value).toBe(false);
        expect(host.stopProgressTimer).toHaveBeenCalled();
        expect(host.reportProgress).toHaveBeenCalled();
    });
});
