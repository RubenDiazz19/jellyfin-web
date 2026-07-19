import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { VideoPlayerViewModel } from '../VideoPlayerViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const TICKS = 10_000_000;

// Doble del HTMLVideoElement: solo la superficie que usa el ViewModel.
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
    removeAttribute = vi.fn((attr: string) => {
        if (attr === 'src') this.src = '';
    });
    canPlayType = vi.fn(() => '');
}

function decision(overrides: Partial<PlaybackDecision> = {}): PlaybackDecision {
    return {
        kind: 'direct',
        url: 'http://server/Videos/x/stream',
        playSessionId: 'ps1',
        mediaSourceId: 'ms1',
        audioStreams: [
            { index: 1, displayTitle: 'Español', isDefault: true, isText: false }
        ],
        subtitleStreams: [
            { index: 3, displayTitle: 'Español (SRT)', isDefault: false, isText: true }
        ],
        ...overrides
    };
}

function mockApi(dec = decision()): ApiService {
    return {
        playback: {
            getPlaybackDecision: vi.fn(() => Promise.resolve(dec)),
            subtitleVttUrl: vi.fn((itemId: string, msId: string, idx: number) =>
                `http://server/Videos/${itemId}/${msId}/Subtitles/${idx}/0/Stream.vtt`),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve())
        }
    } as unknown as ApiService;
}

describe('VideoPlayerViewModel', () => {
    let video: FakeVideo;
    let container: HTMLElement;
    let api: ApiService;
    let vm: VideoPlayerViewModel;

    beforeEach(() => {
        localStorage.clear();
        video = new FakeVideo();
        container = document.createElement('div');
        api = mockApi();
        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, container);
    });

    afterEach(() => {
        vm.close();
        // Stubs de PiP definidos por el test correspondiente (jsdom no trae la API).
        delete (document as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled;
        delete (document as { pictureInPictureElement?: Element | null }).pictureInPictureElement;
        delete (document as { exitPictureInPicture?: () => Promise<void> }).exitPictureInPicture;
    });

    test('open() reproduce en directo, reanuda posición y reporta el inicio', async () => {
        await vm.open('item1', { startTicks: 30 * TICKS, title: 'Dandelion 1x01' });

        expect(video.src).toBe('http://server/Videos/x/stream');
        expect(vm.title.value).toBe('Dandelion 1x01');
        expect(api.playback.reportPlaybackStart).toHaveBeenCalledWith('item1');

        // El seek de reanudación llega al cargar los metadatos.
        video.duration = 1400;
        video.dispatchEvent(new Event('loadedmetadata'));
        expect(video.currentTime).toBe(30);
        expect(video.play).toHaveBeenCalled();
    });

    test('el subtítulo de texto activo expone su URL VTT sin recargar', async () => {
        await vm.open('item1');
        vm.setSubtitleTrack(3);

        expect(vm.selectedSubtitle.value).toBe(3);
        expect(vm.subtitleUrl.value).toContain('/Subtitles/3/0/Stream.vtt');
        expect(api.playback.getPlaybackDecision).toHaveBeenCalledTimes(1);

        vm.setSubtitleTrack(null);
        expect(vm.subtitleUrl.value).toBeNull();
        expect(api.playback.getPlaybackDecision).toHaveBeenCalledTimes(1);
    });

    test('togglePlay alterna reproducción y los eventos actualizan signals', async () => {
        await vm.open('item1');

        vm.togglePlay();
        expect(video.play).toHaveBeenCalled();
        expect(vm.playing.value).toBe(true);

        vm.togglePlay();
        expect(video.pause).toHaveBeenCalled();
        expect(vm.playing.value).toBe(false);
    });

    test('seek y volumen se acotan a los rangos válidos', async () => {
        await vm.open('item1');
        video.duration = 100;
        video.dispatchEvent(new Event('durationchange'));

        vm.seek(500);
        expect(video.currentTime).toBe(100);
        vm.seek(-5);
        expect(video.currentTime).toBe(0);

        vm.setVolume(2);
        expect(video.volume).toBe(1);
        vm.setVolume(-1);
        expect(video.volume).toBe(0);
    });

    test('setPlaybackRate acota el rango y persiste como default para recargas', async () => {
        await vm.open('item1');

        vm.setPlaybackRate(1.5);
        expect(video.playbackRate).toBe(1.5);
        // defaultPlaybackRate mantiene la velocidad tras un load() por cambio de pista.
        expect(video.defaultPlaybackRate).toBe(1.5);
        expect(vm.playbackRate.value).toBe(1.5);

        vm.setPlaybackRate(10);
        expect(video.playbackRate).toBe(3);
        vm.setPlaybackRate(0.1);
        expect(video.playbackRate).toBe(0.25);
    });

    test('togglePip entra y sale de Picture-in-Picture', async () => {
        const requestPip = vi.fn(() => Promise.resolve({} as PictureInPictureWindow));
        (video as unknown as HTMLVideoElement).requestPictureInPicture = requestPip;
        let pipEl: Element | null = null;
        Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });
        Object.defineProperty(document, 'pictureInPictureElement', { get: () => pipEl, configurable: true });
        const exitPip = vi.fn(() => { pipEl = null; return Promise.resolve(); });
        // eslint-disable-next-line compat/compat -- stub del test, no código de producción
        document.exitPictureInPicture = exitPip;

        // Re-attach: pipAvailable se evalúa al conectar el <video>.
        vm.close();
        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, container);
        await vm.open('item1');
        expect(vm.pipAvailable.value).toBe(true);

        vm.togglePip();
        expect(requestPip).toHaveBeenCalled();
        video.dispatchEvent(new Event('enterpictureinpicture'));
        expect(vm.pipActive.value).toBe(true);

        pipEl = video as unknown as Element;
        vm.togglePip();
        expect(exitPip).toHaveBeenCalled();
        video.dispatchEvent(new Event('leavepictureinpicture'));
        expect(vm.pipActive.value).toBe(false);
    });

    test('close() reporta el stop con la posición actual', async () => {
        await vm.open('item1');
        video.currentTime = 42;
        vm.close();

        expect(api.playback.reportPlaybackStop)
            .toHaveBeenCalledWith('item1', 42 * TICKS, 'ps1');
        expect(video.pause).toHaveBeenCalled();
    });

    test('un error de PlaybackInfo queda expuesto en el signal', async () => {
        api = mockApi();
        (api.playback.getPlaybackDecision as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('Sin fuentes reproducibles'));
        vm.close();
        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, container);
        await vm.open('item1');

        expect(vm.error.value).toBe('Sin fuentes reproducibles');
        expect(vm.loading.value).toBe(false);
    });
});
