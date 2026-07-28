// Media Session API en el reproductor: activa SOLO en mobile/tablet.
// En desktop el VM no toca navigator.mediaSession (regla: desktop intacto).

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';
import { VideoPlayerViewModel } from '../VideoPlayerViewModel';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

// Doble mínimo del HTMLVideoElement (misma superficie que usa el VM).
class FakeVideo extends EventTarget {
    currentTime = 0;
    duration = 0;
    volume = 1;
    muted = false;
    paused = true;
    playbackRate = 1;
    defaultPlaybackRate = 1;
    src = '';
    textTracks: never[] = [];
    play = vi.fn(() => {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
    });
    pause = vi.fn(() => {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    });
    load = vi.fn();
    removeAttribute = vi.fn();
    canPlayType = vi.fn(() => '');
}

type ActionHandler = ((details: { action: string; seekOffset?: number; seekTime?: number }) => void) | null;

class FakeMediaSession {
    metadata: unknown = null;
    playbackState = 'none';
    handlers = new Map<string, ActionHandler>();
    setActionHandler = vi.fn((action: string, handler: ActionHandler) => {
        this.handlers.set(action, handler);
    });
    setPositionState = vi.fn();
}

function mockApi(): ApiService {
    const dec: PlaybackDecision = {
        kind: 'direct',
        url: 'http://server/Videos/x/stream',
        playSessionId: 'ps1',
        mediaSourceId: 'ms1',
        audioStreams: [],
        subtitleStreams: []
    };
    return {
        playback: {
            getPlaybackDecision: vi.fn(() => Promise.resolve(dec)),
            subtitleVttUrl: vi.fn(() => ''),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve()),
            getMediaSegments: vi.fn(() => Promise.resolve([]))
        },
        images: {
            imageUrl: vi.fn(() => 'http://server/Items/i1/Images/Primary?format=webp')
        },
        session: { load: vi.fn(() => ({ userId: 'u1' })) }
    } as unknown as ApiService;
}

describe('VideoPlayerViewModel · Media Session', () => {
    let video: FakeVideo;
    let vm: VideoPlayerViewModel;
    let ms: FakeMediaSession;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
        ms = new FakeMediaSession();
        Object.defineProperty(navigator, 'mediaSession', { value: ms, configurable: true });
        vi.stubGlobal('MediaMetadata', class {
            title: string;
            artwork: unknown;
            constructor(init: { title: string; artwork: unknown }) {
                this.title = init.title;
                this.artwork = init.artwork;
            }
        });
        video = new FakeVideo();
        vm = new VideoPlayerViewModel(mockApi());
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
    });

    afterEach(() => {
        vm.close();
        delete (navigator as { mediaSession?: unknown }).mediaSession;
        vi.unstubAllGlobals();
        document.documentElement.className = '';
    });

    test('mobile: publica metadata, handlers y estado de reproducción', async () => {
        document.documentElement.classList.add('layout-mobile');
        await vm.open('item1', { title: 'Alien: Earth 1x01' });

        expect((ms.metadata as { title: string }).title).toBe('Alien: Earth 1x01');
        for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto']) {
            expect(ms.handlers.get(action)).toBeTypeOf('function');
        }

        // paused al abrir → 'paused'; el evento play sincroniza a 'playing'.
        expect(ms.playbackState).toBe('paused');
        await video.play();
        expect(ms.playbackState).toBe('playing');
    });

    test('seekforward/seekto mueven el vídeo (offset por defecto 10 s)', async () => {
        document.documentElement.classList.add('layout-mobile');
        await vm.open('item1');

        ms.handlers.get('seekforward')?.({ action: 'seekforward' });
        expect(video.currentTime).toBe(10);

        ms.handlers.get('seekto')?.({ action: 'seekto', seekTime: 42 });
        expect(video.currentTime).toBe(42);
    });

    test('positionState se publica cuando hay duración', async () => {
        document.documentElement.classList.add('layout-mobile');
        await vm.open('item1');

        video.duration = 1400;
        video.dispatchEvent(new Event('durationchange'));
        video.currentTime = 60;
        video.dispatchEvent(new Event('timeupdate'));

        expect(ms.setPositionState).toHaveBeenCalledWith(
            expect.objectContaining({ duration: 1400, position: 60 })
        );
    });

    test('close() limpia metadata, handlers y estado', async () => {
        document.documentElement.classList.add('layout-mobile');
        await vm.open('item1', { title: 'X' });
        vm.close();

        expect(ms.metadata).toBeNull();
        expect(ms.playbackState).toBe('none');
        expect(ms.handlers.get('play')).toBeNull();
        expect(ms.handlers.get('seekto')).toBeNull();
    });

    test('desktop: no toca la Media Session en absoluto', async () => {
        document.documentElement.classList.add('layout-desktop');
        await vm.open('item1', { title: 'X' });

        expect(ms.metadata).toBeNull();
        expect(ms.setActionHandler).not.toHaveBeenCalled();
        expect(ms.setPositionState).not.toHaveBeenCalled();
    });
});
