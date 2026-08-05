// Idioma preferido por título: la elección de pista se recuerda para la
// película (o la serie entera) y manda sobre la preferencia del usuario, que
// es la que el servidor aplica cuando no le pedimos índices concretos.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiService } from '../../../data/api/ApiService';
import type { PlaybackDecision } from '../../../data/api/playback';
import type { PlaybackContext } from '../../../data/api/playbackContext';
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

// Tercer argumento de getPlaybackDecision: opciones de caché (`fresh`), que
// no tienen nada que ver con las pistas que se prueban aquí. Lo que importa de
// cada llamada es el segundo.
const CACHE_OPTS = expect.anything();

const AUDIO = [
    { index: 1, language: 'eng', displayTitle: 'English', isDefault: true, isText: false },
    { index: 2, language: 'spa', displayTitle: 'Español', isDefault: false, isText: false }
];
const SUBS = [
    { index: 3, language: 'spa', displayTitle: 'Español (SRT)', isDefault: false, isText: true }
];

const DECISION: PlaybackDecision = {
    kind: 'direct',
    url: 'http://server/Videos/x/stream',
    mediaSourceId: 'ms1',
    audioStreams: AUDIO,
    subtitleStreams: SUBS,
    activeAudioIndex: 1
};

const CONTEXT: PlaybackContext = {
    titleId: 'series1',
    isEpisode: true,
    chapters: [],
    audioStreams: AUDIO,
    subtitleStreams: SUBS,
    mediaSourceId: 'ms1'
};

function mockApi(context: PlaybackContext = CONTEXT) {
    const getPlaybackDecision = vi.fn(() => Promise.resolve(DECISION));
    const api = {
        playback: {
            getPlaybackDecision,
            getPlaybackContext: vi.fn(() => Promise.resolve(context)),
            subtitleVttUrl: vi.fn(() => 'http://server/sub.vtt'),
            reportPlaybackStart: vi.fn(() => Promise.resolve()),
            reportPlaybackProgress: vi.fn(() => Promise.resolve()),
            reportPlaybackStop: vi.fn(() => Promise.resolve()),
            getMediaSegments: vi.fn(() => Promise.resolve([]))
        },
        session: { load: vi.fn(() => ({ userId: 'u1' })) }
    } as unknown as ApiService;
    return { api, getPlaybackDecision };
}

describe('VideoPlayerViewModel — idioma preferido por título', () => {
    let video: FakeVideo;
    let vm: VideoPlayerViewModel;

    beforeEach(() => {
        localStorage.clear();
        video = new FakeVideo();
    });

    async function open(context?: PlaybackContext) {
        const mocks = mockApi(context);
        vm = new VideoPlayerViewModel(mocks.api);
        vm.attach(video as unknown as HTMLVideoElement, document.createElement('div'));
        await vm.open('episode1');
        return mocks;
    }

    test('sin preferencia guardada no se piden índices: decide el servidor', async () => {
        const { getPlaybackDecision } = await open();
        expect(getPlaybackDecision).toHaveBeenCalledWith('episode1', {}, CACHE_OPTS);
        expect(vm.titlePref.value).toBeNull();
    });

    test('elegir audio lo recuerda para la serie', async () => {
        await open();
        vm.setAudioTrack(2);

        expect(vm.titlePref.value).toEqual({ audio: 'spa' });
        expect(vm.titleIsSeries.value).toBe(true);
        // La clave es la serie, no el episodio: vale para el resto de capítulos.
        const stored = JSON.parse(localStorage.getItem('jfp-lang-prefs:u1') ?? '{}');
        expect(stored).toEqual({ series1: { audio: 'spa' } });
    });

    test('el idioma recordado se pide ya en el primer PlaybackInfo', async () => {
        localStorage.setItem(
            'jfp-lang-prefs:u1', JSON.stringify({ series1: { audio: 'spa' } })
        );

        const { getPlaybackDecision } = await open();

        expect(getPlaybackDecision).toHaveBeenCalledWith('episode1', {
            audioStreamIndex: 2,
            subtitleStreamIndex: undefined,
            mediaSourceId: 'ms1'
        }, CACHE_OPTS);
    });

    test('apagar los subtítulos también se recuerda, y se pide como -1', async () => {
        await open();
        vm.setSubtitleTrack(3);
        expect(vm.titlePref.value).toEqual({ subtitle: 'spa' });

        vm.setSubtitleTrack(null);
        expect(vm.titlePref.value).toEqual({ subtitle: null });

        const { getPlaybackDecision } = await open();
        expect(getPlaybackDecision).toHaveBeenCalledWith('episode1', {
            audioStreamIndex: undefined,
            subtitleStreamIndex: -1,
            mediaSourceId: 'ms1'
        }, CACHE_OPTS);
    });

    test('un idioma recordado que este item no tiene se ignora', async () => {
        localStorage.setItem(
            'jfp-lang-prefs:u1', JSON.stringify({ series1: { audio: 'jpn' } })
        );

        const { getPlaybackDecision } = await open();

        // Sin pista en ese idioma no se fuerza nada: manda la preferencia del
        // usuario que aplica el servidor.
        expect(getPlaybackDecision).toHaveBeenCalledWith('episode1', {}, CACHE_OPTS);
    });

    test('olvidar la preferencia devuelve el mando al servidor', async () => {
        await open();
        vm.setAudioTrack(2);
        expect(vm.titlePref.value).not.toBeNull();

        vm.clearTitlePref();

        expect(vm.titlePref.value).toBeNull();
        const { getPlaybackDecision } = await open();
        expect(getPlaybackDecision).toHaveBeenCalledWith('episode1', {}, CACHE_OPTS);
    });

    test('en una película la preferencia se guarda contra el propio item', async () => {
        await open({ ...CONTEXT, titleId: 'movie1', isEpisode: false });
        vm.setAudioTrack(2);

        expect(vm.titleIsSeries.value).toBe(false);
        const stored = JSON.parse(localStorage.getItem('jfp-lang-prefs:u1') ?? '{}');
        expect(stored).toEqual({ movie1: { audio: 'spa' } });
    });
});
