// Aviso de "siguiente episodio": aparece con los créditos (o en los últimos
// segundos si no los hay) y se llena mientras el capítulo termina.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';
import type { NextEpisode, PlaybackContext } from '../../../data/api/playbackContext';
import type { MediaSegment } from '../../../data/api/segments';
import { VideoPlayerViewModel } from '../VideoPlayerViewModel';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

class FakeVideo extends EventTarget {
    currentTime = 0;
    duration = 0;
    volume = 1;
    muted = false;
    paused = true;
    playbackRate = 1;
    defaultPlaybackRate = 1;
    src = '';
    currentSrc = '';
    textTracks: never[] = [];
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    load = vi.fn();
    getAttribute = vi.fn(() => this.src || null);
    removeAttribute = vi.fn();
    canPlayType = vi.fn(() => '');
}

const DECISION: PlaybackDecision = {
    kind: 'direct',
    url: 'http://server/Videos/x/stream',
    mediaSourceId: 'ms1',
    audioStreams: [],
    subtitleStreams: []
};

const NEXT: NextEpisode = {
    id: 'ep2', title: 'Cerrajero', label: 'T1 · E02', thumb: 'http://server/thumb.jpg'
};

const CONTEXT: PlaybackContext = {
    titleId: 'series1',
    isEpisode: true,
    chapters: [],
    audioStreams: [],
    subtitleStreams: [],
    mediaSourceId: 'ms1',
    runtime: 1500
};

function mockApi(segments: MediaSegment[], next: NextEpisode | null, ctx = CONTEXT) {
    return {
        playback: {
            getPlaybackDecision: vi.fn(() => Promise.resolve(DECISION)),
            getPlaybackContext: vi.fn(() => Promise.resolve(ctx)),
            getNextEpisode: vi.fn(() => Promise.resolve(next)),
            subtitleVttUrl: vi.fn(() => ''),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve()),
            getMediaSegments: vi.fn(() => Promise.resolve(segments))
        },
        session: { load: vi.fn(() => ({ userId: 'u1' })) }
    } as unknown as ApiService;
}

describe('VideoPlayerViewModel — siguiente episodio', () => {
    let video: FakeVideo;
    let vm: VideoPlayerViewModel;

    beforeEach(() => {
        localStorage.clear();
        video = new FakeVideo();
    });

    function seekTo(seconds: number) {
        video.currentTime = seconds;
        video.dispatchEvent(new Event('timeupdate'));
    }

    async function open(
        segments: MediaSegment[] = [], next: NextEpisode | null = NEXT, ctx = CONTEXT
    ) {
        vm = new VideoPlayerViewModel(mockApi(segments, next, ctx));
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
        await vm.open('ep1');
        // loadNextEpisode y loadSegments no bloquean open(): un par de ticks.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        video.duration = 1500;
        video.dispatchEvent(new Event('durationchange'));
    }

    test('carga el siguiente episodio de la serie', async () => {
        await open();
        expect(vm.nextEpisode.value).toEqual(NEXT);
    });

    test('con créditos detectados, el aviso acompaña a los créditos', async () => {
        await open([{ kind: 'Outro', start: 1400, end: 1500 }]);

        seekTo(1399);
        expect(vm.autoNextProgress.value).toBeNull();

        seekTo(1400);
        expect(vm.autoNextProgress.value).toBe(0);

        seekTo(1450);
        expect(vm.autoNextProgress.value).toBe(0.5);

        seekTo(1500);
        expect(vm.autoNextProgress.value).toBe(1);
    });

    test('sin créditos detectados sale en los últimos segundos', async () => {
        await open();

        seekTo(1400);
        expect(vm.autoNextProgress.value).toBeNull();

        // duration - 25 s
        seekTo(1475);
        expect(vm.autoNextProgress.value).toBe(0);

        seekTo(1500);
        expect(vm.autoNextProgress.value).toBe(1);
    });

    test('en el último episodio no hay aviso', async () => {
        await open([{ kind: 'Outro', start: 1400, end: 1500 }], null);

        seekTo(1450);
        expect(vm.nextEpisode.value).toBeNull();
        expect(vm.autoNextProgress.value).toBeNull();
    });

    test('descartarlo lo quita para el resto del capítulo', async () => {
        await open([{ kind: 'Outro', start: 1400, end: 1500 }]);

        seekTo(1450);
        expect(vm.autoNextProgress.value).toBe(0.5);

        vm.dismissAutoNext();
        expect(vm.autoNextProgress.value).toBeNull();

        seekTo(1480);
        expect(vm.autoNextProgress.value).toBeNull();
    });

    test('en una película no se pide el siguiente episodio', async () => {
        const api = mockApi([], NEXT, { ...CONTEXT, titleId: 'movie1', isEpisode: false });
        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
        await vm.open('movie1');
        await Promise.resolve();

        expect(api.playback.getNextEpisode).not.toHaveBeenCalled();
        expect(vm.nextEpisode.value).toBeNull();
    });
});
