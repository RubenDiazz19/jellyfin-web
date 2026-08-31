// Barra de progreso segmentada: capítulos del fichero + tramos detectados,
// y el filtro que evita el falso "no se pudo reproducir".

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';
import type { PlaybackContext } from '../../../data/api/playbackContext';
import type { MediaSegment } from '../../../data/api/segments';
import {
    chapterAt, chapterDisplayName, formatTime, playerMarks, progressDividers
} from '../../player/format';
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
    getAttribute = vi.fn(() => (this.src || null));
    removeAttribute = vi.fn(() => { this.src = ''; });
    canPlayType = vi.fn(() => '');
}

const DECISION: PlaybackDecision = {
    kind: 'direct',
    url: 'http://server/Videos/x/stream',
    mediaSourceId: 'ms1',
    audioStreams: [],
    subtitleStreams: [
        { index: 3, displayTitle: 'Español (SRT)', isDefault: true, isText: true }
    ],
    activeSubtitleIndex: 3
};

const CHAPTERS = [
    { start: 0, name: 'Intro' },
    { start: 90, name: 'Capítulo 1' },
    { start: 600, name: 'Capítulo 2' }
];

function mockApi(segments: MediaSegment[] = []) {
    const context: PlaybackContext = {
        titleId: 'item1',
        isEpisode: false,
        chapters: CHAPTERS,
        audioStreams: [],
        subtitleStreams: [],
        mediaSourceId: 'ms1',
        runtime: 1500
    };
    return {
        playback: {
            getPlaybackDecision: vi.fn(() => Promise.resolve(DECISION)),
            getPlaybackContext: vi.fn(() => Promise.resolve(context)),
            subtitleVttUrl: vi.fn((item: string, ms: string, index: number) =>
                `http://server/Videos/${item}/${ms}/Subtitles/${index}/0/Stream.vtt`),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve()),
            getMediaSegments: vi.fn(() => Promise.resolve(segments))
        },
        session: { load: vi.fn(() => ({ userId: 'u1' })) }
    } as unknown as ApiService;
}

describe('formatTime', () => {
    test('formatea segundos a M:SS o H:MM:SS', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(45)).toBe('0:45');
        expect(formatTime(75)).toBe('1:15');
        expect(formatTime(3665)).toBe('1:01:05');
        expect(formatTime(-10)).toBe('0:00');
        expect(formatTime(NaN)).toBe('0:00');
    });
});

describe('chapterAt', () => {
    test('devuelve el capítulo que contiene el instante', () => {
        expect(chapterAt(CHAPTERS, 0)?.name).toBe('Intro');
        expect(chapterAt(CHAPTERS, 89.9)?.name).toBe('Intro');
        expect(chapterAt(CHAPTERS, 90)?.name).toBe('Capítulo 1');
        expect(chapterAt(CHAPTERS, 5000)?.name).toBe('Capítulo 2');
    });

    test('sin capítulos no hay nada que devolver', () => {
        expect(chapterAt([], 42)).toBeNull();
    });
});

describe('chapterDisplayName', () => {
    test('traduce los nombres genéricos del encoder', () => {
        // globalize devuelve el inglés en los tests; lo que importa es que
        // pasen por la traducción y conserven el número.
        expect(chapterDisplayName('Scene 3', 0)).toBe('Scene 3');
        expect(chapterDisplayName('chapter 12', 0)).toBe('Chapter 12');
        expect(chapterDisplayName('Credits', 0)).toBe('Credits');
        expect(chapterDisplayName('OP', 0)).toBe('Intro');
        expect(chapterDisplayName('ED2', 0)).toBe('Credits');
    });

    test('respeta el nombre real de un capítulo', () => {
        expect(chapterDisplayName('El plan de Aki', 0)).toBe('El plan de Aki');
        // "Scene" con texto detrás no es un nombre genérico.
        expect(chapterDisplayName('Scene of the crime', 0)).toBe('Scene of the crime');
    });

    test('sin nombre cae en el ordinal', () => {
        expect(chapterDisplayName(undefined, 4)).toBe('Chapter 5');
        expect(chapterDisplayName('   ', 0)).toBe('Chapter 1');
    });
});

describe('playerMarks', () => {
    test('mezcla capítulos y segmentos ordenados por tiempo', () => {
        const marks = playerMarks(CHAPTERS, [{ kind: 'Outro', start: 1400, end: 1500 }]);

        expect(marks.map((m) => m.start)).toEqual([0, 90, 600, 1400]);
        expect(marks[3]).toEqual({ start: 1400, kind: 'Outro' });
    });

    test('un segmento que cae sobre un capítulo no se duplica', () => {
        // La intro detectada empieza donde el capítulo "Intro": el nombre del
        // capítulo es más útil que "Saltar intro".
        const marks = playerMarks(CHAPTERS, [{ kind: 'Intro', start: 2, end: 88 }]);

        expect(marks).toHaveLength(3);
        expect(marks.map((m) => m.name)).toEqual(['Intro', 'Capítulo 1', 'Capítulo 2']);
    });

    test('sin capítulos, los segmentos son las únicas marcas', () => {
        const marks = playerMarks([], [{ kind: 'Intro', start: 30, end: 90 }]);
        expect(marks).toEqual([{ start: 30, kind: 'Intro' }]);
    });
});

describe('progressDividers', () => {
    test('corta en cada capítulo y en los extremos de cada tramo', () => {
        const dividers = progressDividers(
            CHAPTERS, [{ kind: 'Outro', start: 1400, end: 1480 }], 1500
        );
        expect(dividers).toEqual([90, 600, 1400, 1480]);
    });

    test('el inicio y el final del vídeo no se cortan', () => {
        // El capítulo en 0 y un outro que llega hasta el final coinciden con
        // los bordes de la barra: pintarlos sería ruido.
        expect(progressDividers(
            [{ start: 0, name: 'Scene 1' }], [{ kind: 'Outro', start: 1435, end: 1500 }], 1500
        )).toEqual([1435]);
    });

    test('un capítulo y un tramo en el mismo sitio dan un solo corte', () => {
        expect(progressDividers(
            [{ start: 0 }, { start: 1435, name: 'Credits' }],
            [{ kind: 'Outro', start: 1435.4, end: 1500 }],
            1500
        )).toEqual([1435]);
    });

    test('sin duración conocida no hay cortes', () => {
        expect(progressDividers(CHAPTERS, [], 0)).toEqual([]);
    });
});

describe('VideoPlayerViewModel — capítulos y segmentos en la barra', () => {
    let video: FakeVideo;
    let vm: VideoPlayerViewModel;

    beforeEach(() => {
        localStorage.clear();
        video = new FakeVideo();
    });

    async function open(segments: MediaSegment[] = []) {
        vm = new VideoPlayerViewModel(mockApi(segments));
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
        await vm.open('item1');
        await Promise.resolve();
        await Promise.resolve();
    }

    test('expone los capítulos del item y los segmentos completos', async () => {
        const outro: MediaSegment = { kind: 'Outro', start: 1400, end: 1500 };
        await open([outro]);

        expect(vm.chapters.value).toEqual(CHAPTERS);
        expect(vm.segmentList.value).toEqual([outro]);
    });

    test('un error del <video> sin fuente no se pinta como fallo', async () => {
        await open();
        // Lo que dispara load() al limpiar el src: el <video> queda sin
        // fuente y el evento llega tarde, cuando ya hay otra reproducción.
        video.src = '';
        video.currentSrc = '';
        video.dispatchEvent(new Event('error'));

        expect(vm.error.value).toBeNull();
    });

    test('el primer fallo del arranque se reintenta, no se muestra', async () => {
        vi.useFakeTimers();
        try {
            await open();
            video.currentSrc = 'http://server/Videos/x/stream';
            video.dispatchEvent(new Event('error'));

            // Reintento en vuelo: el usuario sigue viendo el spinner.
            expect(vm.error.value).toBeNull();
            expect(vm.loading.value).toBe(true);

            await vi.advanceTimersByTimeAsync(2000);
            // Se ha vuelto a pedir la fuente (PlaybackInfo por segunda vez).
            expect(vm.error.value).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('el segundo fallo seguido ya sí es un error de reproducción', async () => {
        await open();
        video.currentSrc = 'http://server/Videos/x/stream';
        video.dispatchEvent(new Event('error'));
        video.dispatchEvent(new Event('error'));

        expect(vm.error.value).toBeTruthy();
    });

    test('el subtítulo no se pide hasta que el vídeo está reproduciendo', async () => {
        await open();
        // Al abrir hay un subtítulo activo pero su VTT aún no se ha pedido:
        // hacerlo ahora dispararía la extracción de todas las pistas del MKV
        // justo cuando el servidor tiene que levantar el transcode.
        expect(vm.subtitleUrl.value).toBeNull();

        video.dispatchEvent(new Event('playing'));
        expect(vm.subtitleUrl.value).toContain('/Subtitles/');
    });

    test('cerrar no toca un <video> que ya ha tomado otra instancia', async () => {
        await open();
        const first = vm;

        // Segunda instancia sobre el MISMO elemento (remontaje / HMR).
        const second = new VideoPlayerViewModel(mockApi());
        second.attach(video as unknown as HTMLVideoElement, document.createElement('div'));

        first.close();

        expect(video.load).not.toHaveBeenCalled();
        expect(video.removeAttribute).not.toHaveBeenCalled();
    });
});
