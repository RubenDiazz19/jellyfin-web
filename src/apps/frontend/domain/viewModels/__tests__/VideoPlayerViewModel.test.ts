import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { VideoPlayerViewModel } from '../VideoPlayerViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';
import type { MediaSegment } from '../../../data/api/segments';

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
        playMethod: 'DirectPlay',
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

function mockApi(dec = decision(), segments: MediaSegment[] = []): ApiService {
    return {
        playback: {
            getPlaybackDecision: vi.fn(() => Promise.resolve(dec)),
            subtitleVttUrl: vi.fn((itemId: string, msId: string, idx: number) =>
                `http://server/Videos/${itemId}/${msId}/Subtitles/${idx}/0/Stream.vtt`),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve()),
            getMediaSegments: vi.fn(() => Promise.resolve(segments))
        },
        // Las preferencias de pista por título se guardan por cuenta.
        session: { load: vi.fn(() => ({ userId: 'u1' })) }
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
        expect(api.playback.reportPlaybackStart).toHaveBeenCalledWith('item1', 'DirectPlay');

        // El seek de reanudación llega al cargar los metadatos.
        video.duration = 1400;
        video.dispatchEvent(new Event('loadedmetadata'));
        expect(video.currentTime).toBe(30);
        expect(video.play).toHaveBeenCalled();
    });

    test('el subtítulo de texto activo expone su URL VTT sin recargar', async () => {
        await vm.open('item1');
        // El VTT solo se pide con la reproducción ya en marcha (pedirlo antes
        // hace que el servidor extraiga todas las pistas del MKV y ahogue al
        // transcode).
        video.dispatchEvent(new Event('playing'));
        vm.setSubtitleTrack(3);

        expect(vm.selectedSubtitle.value).toBe(3);
        expect(vm.subtitleUrl.value).toContain('/Subtitles/3/0/Stream.vtt');
        expect(api.playback.getPlaybackDecision).toHaveBeenCalledTimes(1);

        vm.setSubtitleTrack(null);
        expect(vm.subtitleUrl.value).toBeNull();
        expect(api.playback.getPlaybackDecision).toHaveBeenCalledTimes(1);
    });

    test('setAudioTrack repide PlaybackInfo con el índice y el mediaSourceId', async () => {
        await vm.open('item1');
        vm.setAudioTrack(2);
        await Promise.resolve();

        const calls = (api.playback.getPlaybackDecision as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls).toHaveLength(2);
        // Sin mediaSourceId el servidor ignora audioStreamIndex (fix 13.1).
        expect(calls[1][1]).toMatchObject({ audioStreamIndex: 2, mediaSourceId: 'ms1' });
    });

    test('cambiar audio no reactiva el subtítulo por defecto del servidor', async () => {
        await vm.open('item1');
        // Sin subtítulo elegido, la recarga por cambio de audio debe pedir
        // -1 explícito: con `undefined` el servidor reactiva su subtítulo
        // por defecto y «aparecen por la cara» (bug 2).
        vm.setAudioTrack(2);
        await Promise.resolve();

        const calls = (api.playback.getPlaybackDecision as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[1][1]).toMatchObject({
            audioStreamIndex: 2,
            subtitleStreamIndex: -1,
            mediaSourceId: 'ms1'
        });
        expect(vm.selectedSubtitle.value).toBeNull();
        expect(vm.subtitleUrl.value).toBeNull();
    });

    test('cambiar audio conserva el subtítulo elegido', async () => {
        await vm.open('item1');
        video.dispatchEvent(new Event('playing'));
        vm.setSubtitleTrack(3);
        expect(vm.selectedSubtitle.value).toBe(3);

        vm.setAudioTrack(2);
        await Promise.resolve();

        const calls = (api.playback.getPlaybackDecision as ReturnType<typeof vi.fn>).mock.calls;
        // open + setSubtitleTrack (sin recarga) + setAudioTrack.
        expect(calls).toHaveLength(2);
        expect(calls[1][1]).toMatchObject({
            audioStreamIndex: 2,
            subtitleStreamIndex: 3,
            mediaSourceId: 'ms1'
        });
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

    test('castAvailable sigue watchAvailability y promptCast abre el selector', async () => {
        class FakeRemote extends EventTarget {
            state: RemotePlaybackState = 'disconnected';
            cb: ((available: boolean) => void) | null = null;
            watchAvailability = vi.fn((cb: (available: boolean) => void) => {
                this.cb = cb;
                return Promise.resolve(7);
            });
            cancelWatchAvailability = vi.fn(() => Promise.resolve());
            prompt = vi.fn(() => Promise.resolve());
        }
        const remote = new FakeRemote();
        (video as unknown as { remote: unknown }).remote = remote;

        // Re-attach: el seguimiento de receptores se engancha al conectar el <video>.
        vm.close();
        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, container);
        await vm.open('item1');

        remote.cb?.(true);
        expect(vm.castAvailable.value).toBe(true);

        vm.promptCast();
        expect(remote.prompt).toHaveBeenCalled();

        remote.dispatchEvent(new Event('connect'));
        expect(vm.castState.value).toBe('connected');
        remote.dispatchEvent(new Event('disconnect'));
        expect(vm.castState.value).toBe('disconnected');

        vm.close();
        expect(remote.cancelWatchAvailability).toHaveBeenCalledWith(7);
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

    test('setBrightness acota a [0.15, 1] (gesto táctil de brillo)', () => {
        expect(vm.brightness.value).toBe(1);
        vm.setBrightness(0.5);
        expect(vm.brightness.value).toBe(0.5);
        vm.setBrightness(-1);
        expect(vm.brightness.value).toBe(0.15);
        vm.setBrightness(2);
        expect(vm.brightness.value).toBe(1);
    });

    test('close() restablece el brillo a 1', async () => {
        await vm.open('item1');
        vm.setBrightness(0.4);
        vm.close();
        expect(vm.brightness.value).toBe(1);
    });

    describe('reporte periódico de progreso', () => {
        test('solo corre mientras se reproduce', async () => {
            vi.useFakeTimers();
            try {
                await vm.open('item1');
                const report = api.playback.reportPlaybackProgress as ReturnType<typeof vi.fn>;

                // Sin haber arrancado (autoplay denegado) no hay nada que
                // reportar por mucho que pase el tiempo.
                vi.advanceTimersByTime(30_000);
                expect(report).not.toHaveBeenCalled();

                await video.play();
                vi.advanceTimersByTime(10_000);
                expect(report).toHaveBeenCalledTimes(1);

                // La pausa manda su reporte y para el timer: sin esto el
                // servidor recibía la MISMA posición cada 10 s.
                report.mockClear();
                video.pause();
                expect(report).toHaveBeenCalledTimes(1);
                report.mockClear();
                vi.advanceTimersByTime(60_000);
                expect(report).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });

        test('el final del vídeo para el timer', async () => {
            vi.useFakeTimers();
            try {
                await vm.open('item1');
                await video.play();
                const report = api.playback.reportPlaybackProgress as ReturnType<typeof vi.fn>;

                video.dispatchEvent(new Event('ended'));
                expect(vm.ended.value).toBe(true);
                report.mockClear();
                vi.advanceTimersByTime(60_000);
                expect(report).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    test('currentTime se publica cuantizado al segundo', async () => {
        await vm.open('item1');
        video.duration = 1400;
        video.dispatchEvent(new Event('durationchange'));

        const seen: number[] = [];
        const unsub = vm.currentTime.subscribe((t) => seen.push(t));
        for (const t of [10.1, 10.4, 10.7, 10.9, 11.2]) {
            video.currentTime = t;
            video.dispatchEvent(new Event('timeupdate'));
        }
        unsub();

        // subscribe() emite el valor actual al suscribir: 0, luego 10 y 11.
        expect(seen).toEqual([0, 10, 11]);
    });

    test('cambiar de pista no acumula listeners de loadedmetadata', async () => {
        await vm.open('item1');
        video.duration = 1400;
        video.dispatchEvent(new Event('durationchange'));
        video.currentTime = 300;

        // Cada recarga instalaba un `loadedmetadata` nuevo sin quitar el
        // anterior: con N cambios de pista, N saltos por cada metadato.
        for (let i = 2; i <= 5; i++) {
            vm.setAudioTrack(i);
            await Promise.resolve();
            await Promise.resolve();
        }

        video.play.mockClear();
        video.dispatchEvent(new Event('loadedmetadata'));
        expect(video.play).toHaveBeenCalledTimes(1);
    });
});
