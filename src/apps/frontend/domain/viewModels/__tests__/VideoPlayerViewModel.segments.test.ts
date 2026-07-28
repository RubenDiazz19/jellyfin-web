// Saltar intro/créditos: el VM expone el segmento que contiene la posición
// actual y un comando para saltarlo.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';
import type { ItemChapter, PlaybackContext } from '../../../data/api/playbackContext';
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
    textTracks: never[] = [];
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    load = vi.fn();
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

const SEGMENTS: MediaSegment[] = [
    { kind: 'Intro', start: 30, end: 90 },
    { kind: 'Outro', start: 1300, end: 1400 }
];

/** Contexto mínimo del item; `chapters` alimenta el respaldo por capítulos. */
function context(chapters: ItemChapter[] = [], runtime?: number): PlaybackContext {
    return {
        titleId: 'item1',
        isEpisode: false,
        chapters,
        audioStreams: [],
        subtitleStreams: [],
        mediaSourceId: 'ms1',
        runtime
    };
}

function mockApi(segments: MediaSegment[] = SEGMENTS, ctx: PlaybackContext = context()) {
    const getMediaSegments = vi.fn(() => Promise.resolve(segments));
    const api = {
        playback: {
            getPlaybackDecision: vi.fn(() => Promise.resolve(DECISION)),
            getPlaybackContext: vi.fn(() => Promise.resolve(ctx)),
            subtitleVttUrl: vi.fn(() => ''),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve()),
            getMediaSegments
        },
        session: { load: vi.fn(() => ({ userId: 'u1' })) }
    } as unknown as ApiService;
    return { api, getMediaSegments };
}

describe('VideoPlayerViewModel — segmentos', () => {
    let video: FakeVideo;
    let vm: VideoPlayerViewModel;

    beforeEach(() => {
        localStorage.clear();
        video = new FakeVideo();
    });

    /** Mueve el <video> y dispara el timeupdate que el VM escucha. */
    function seekTo(seconds: number) {
        video.currentTime = seconds;
        video.dispatchEvent(new Event('timeupdate'));
    }

    /** El VM solo conoce la duración a través del evento del <video>. */
    function setDuration(seconds: number) {
        video.duration = seconds;
        video.dispatchEvent(new Event('durationchange'));
    }

    async function open(segments?: MediaSegment[], ctx?: PlaybackContext) {
        const { api, getMediaSegments } = mockApi(segments, ctx);
        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
        await vm.open('item1');
        // loadSegments no se espera dentro de open(): no debe bloquear la
        // reproducción. Cedemos un tick para que resuelva.
        await Promise.resolve();
        await Promise.resolve();
        return getMediaSegments;
    }

    test('expone el segmento que contiene la posición actual', async () => {
        await open();
        expect(vm.activeSegment.value).toBeNull();

        seekTo(45);
        expect(vm.activeSegment.value).toEqual({ kind: 'Intro', start: 30, end: 90 });

        seekTo(120);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('los créditos no ofrecen botón de salto', async () => {
        // Ese tramo lo cubre el aviso de siguiente episodio, que además
        // encadena solo; dos botones para lo mismo sobran.
        await open();

        seekTo(1350);
        expect(vm.activeSegment.value).toBeNull();
        // Pero el tramo sigue existiendo para la barra de progreso.
        expect(vm.segmentList.value.some((s) => s.kind === 'Outro')).toBe(true);
    });

    test('el final del segmento es exclusivo', async () => {
        await open();
        seekTo(89.9);
        expect(vm.activeSegment.value?.kind).toBe('Intro');
        seekTo(90);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('skipActiveSegment lleva al final del segmento y lo oculta', async () => {
        await open();
        setDuration(1500);
        seekTo(45);

        vm.skipActiveSegment();

        expect(video.currentTime).toBe(90);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('un segmento saltado no se vuelve a ofrecer al retroceder', async () => {
        await open();
        setDuration(1500);
        seekTo(45);
        vm.skipActiveSegment();

        seekTo(40);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('un segmento que llega al final del fichero no salta al borde', async () => {
        await open([{ kind: 'Preview', start: 1300, end: 1400 }]);
        setDuration(1400);
        seekTo(1350);

        vm.skipActiveSegment();

        // Sin el recorte el seek dispararía 'ended' y el progreso se
        // reportaría en 0.
        expect(video.currentTime).toBe(1399.75);
    });

    test('volver a la intro vuelve a ofrecer el salto', async () => {
        await open();
        setDuration(1500);
        seekTo(45);
        expect(vm.activeSegment.value?.kind).toBe('Intro');

        vm.skipActiveSegment();
        seekTo(video.currentTime);
        expect(vm.activeSegment.value).toBeNull();

        // El usuario rebobina y se planta otra vez dentro de la intro: el
        // botón tiene que estar ahí.
        vm.seek(40);
        seekTo(40);
        expect(vm.activeSegment.value?.kind).toBe('Intro');
    });

    test('saltar la intro no la vuelve a ofrecer al instante', async () => {
        await open();
        setDuration(1500);
        seekTo(45);
        vm.skipActiveSegment();

        // El recorte deja la posición dentro del propio segmento; sin la
        // distinción entre salto del usuario y salto de segmento, el botón
        // reaparecería en el mismo sitio del que acaba de irse.
        seekTo(video.currentTime);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('sin segmentos el botón nunca aparece', async () => {
        await open([]);
        seekTo(45);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('close() olvida los segmentos del item anterior', async () => {
        await open();
        seekTo(45);
        expect(vm.activeSegment.value).not.toBeNull();

        vm.close();
        expect(vm.activeSegment.value).toBeNull();
    });

    test('descarta los segmentos que llegan tarde tras cambiar de item', async () => {
        // Objeto y no `let`: TS no ve la asignación dentro del callback del
        // Promise y estrecharía la variable a `never`.
        const deferred: { resolve(s: MediaSegment[]): void } = { resolve: () => undefined };
        const api = {
            playback: {
                getPlaybackDecision: vi.fn(() => Promise.resolve(DECISION)),
                subtitleVttUrl: vi.fn(() => ''),
                reportPlaybackStart: vi.fn(() => Promise.resolve()),
                reportPlaybackProgress: vi.fn(() => Promise.resolve()),
                reportPlaybackStop: vi.fn(() => Promise.resolve()),
                getMediaSegments: vi.fn(() => new Promise<MediaSegment[]>((res) => {
                    deferred.resolve = res;
                }))
            }
        } as unknown as ApiService;

        vm = new VideoPlayerViewModel(api);
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
        await vm.open('item1');

        // El usuario se va antes de que respondan los segmentos.
        vm.close();
        deferred.resolve(SEGMENTS);
        await Promise.resolve();
        await Promise.resolve();

        seekTo(45);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('sin segmentos del servidor, la intro sale de los capítulos', async () => {
        await open([], context([
            { start: 0, name: 'Intro' },
            { start: 75, name: 'Chapter 2' }
        ], 1500));

        seekTo(40);
        expect(vm.activeSegment.value).toEqual({ kind: 'Intro', start: 0, end: 75 });

        seekTo(80);
        expect(vm.activeSegment.value).toBeNull();
    });

    test('los segmentos del servidor mandan sobre los capítulos', async () => {
        await open(SEGMENTS, context([{ start: 0, name: 'Intro' }], 1500));

        seekTo(10);
        expect(vm.activeSegment.value).toBeNull();
        seekTo(45);
        expect(vm.activeSegment.value).toEqual({ kind: 'Intro', start: 30, end: 90 });
    });
});
