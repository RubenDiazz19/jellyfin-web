import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    MATCH_THRESHOLD,
    autoSetNextTracks,
    findBestMatchingStream,
    scoreStreamMatch,
    type TrackOptions
} from './trackMatching';

const audio = (over: Partial<MediaStream>): MediaStream => ({
    Type: 'Audio', Index: 0, Codec: 'aac', Language: 'spa', ...over
});

const subtitle = (over: Partial<MediaStream>): MediaStream => ({
    Type: 'Subtitle', Index: 0, Codec: 'subrip', Language: 'spa', ...over
});

const source = (streams: MediaStream[], over: Partial<MediaSourceInfo> = {}) => ({
    Id: 'ms', MediaStreams: streams, ...over
});

beforeEach(() => {
    // La heurística habla mucho por consola; no interesa en los tests.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('scoreStreamMatch', () => {
    it('el idioma y el título son las señales fuertes', () => {
        const prev = audio({ Language: 'spa', DisplayTitle: 'Castellano' });

        expect(scoreStreamMatch(prev, audio({ Language: 'spa' }), false)).toBe(3); // códec + idioma
        expect(scoreStreamMatch(prev, audio({ DisplayTitle: 'Castellano', Language: 'eng' }), false))
            .toBe(3); // códec + título
    });

    it('códec y posición juntos no llegan al umbral', () => {
        const prev = audio({ Language: 'spa' });
        const otro = audio({ Language: 'eng' });

        expect(scoreStreamMatch(prev, otro, true)).toBeLessThan(MATCH_THRESHOLD);
    });

    it('el idioma indeterminado no cuenta como coincidencia', () => {
        const prev = audio({ Language: 'und' });
        const candidato = audio({ Language: 'und' });

        // Solo suma el códec: 'und' significa "no se sabe", no "igual".
        expect(scoreStreamMatch(prev, candidato, false)).toBe(1);
    });

    it('un título vacío no cuenta', () => {
        const prev = audio({ DisplayTitle: '', Language: 'eng' });
        const candidato = audio({ DisplayTitle: '', Language: 'spa' });

        expect(scoreStreamMatch(prev, candidato, false)).toBe(1);
    });

    it('todo coincidiendo suma el máximo', () => {
        const prev = audio({ Language: 'spa', DisplayTitle: 'Castellano' });
        expect(scoreStreamMatch(prev, { ...prev }, true)).toBe(6);
    });
});

describe('findBestMatchingStream', () => {
    it('elige la pista del mismo idioma aunque cambie de posición', () => {
        const prev = audio({ Index: 1, Language: 'spa' });
        const candidatos = [
            audio({ Index: 0, Language: 'eng' }),
            audio({ Index: 1, Language: 'jpn' }),
            audio({ Index: 2, Language: 'spa' })
        ];

        expect(findBestMatchingStream(prev, 1, candidatos, 'Audio')).toBe(2);
    });

    it('devuelve null si ninguna se parece lo bastante', () => {
        const prev = audio({ Index: 0, Language: 'spa', Codec: 'aac' });
        const candidatos = [audio({ Index: 0, Language: 'eng', Codec: 'ac3' })];

        expect(findBestMatchingStream(prev, 5, candidatos, 'Audio')).toBeNull();
    });

    it('no mira las pistas de otro tipo', () => {
        const prev = audio({ Index: 0, Language: 'spa' });
        const candidatos = [subtitle({ Index: 0, Language: 'spa' })];

        expect(findBestMatchingStream(prev, 0, candidatos, 'Audio')).toBeNull();
    });

    it('con varias candidatas válidas gana la de mayor puntuación', () => {
        const prev = audio({ Index: 0, Language: 'spa', DisplayTitle: 'Castellano' });
        const candidatos = [
            audio({ Index: 0, Language: 'spa', DisplayTitle: 'Otro' }),
            audio({ Index: 1, Language: 'spa', DisplayTitle: 'Castellano' })
        ];

        expect(findBestMatchingStream(prev, 9, candidatos, 'Audio')).toBe(1);
    });

    it('la posición se cuenta dentro de las pistas de su tipo', () => {
        const prev = audio({ Index: 3, Language: 'und', Codec: 'aac' });
        // La única candidata de audio está en posición 0 dentro de su tipo,
        // así que coinciden códec (1) y posición (1): no llega al umbral.
        const candidatos = [
            subtitle({ Index: 0 }),
            audio({ Index: 1, Language: 'und', Codec: 'aac' })
        ];

        expect(findBestMatchingStream(prev, 0, candidatos, 'Audio')).toBeNull();
    });
});

describe('autoSetNextTracks', () => {
    const spaAudio = audio({ Index: 0, Language: 'spa' });
    const engAudio = audio({ Index: 1, Language: 'eng' });

    it('mantiene el idioma de audio en el item siguiente', () => {
        const prev = source([spaAudio, engAudio], { DefaultAudioStreamIndex: 1 });
        const nuevas = [audio({ Index: 0, Language: 'eng' }), audio({ Index: 1, Language: 'spa' })];
        const options: TrackOptions = {};

        autoSetNextTracks(prev, nuevas, options, true, false);

        expect(options.DefaultAudioStreamIndex).toBe(0);
    });

    it('mantiene los subtítulos', () => {
        const prev = source(
            [subtitle({ Index: 2, Language: 'spa' })],
            { DefaultSubtitleStreamIndex: 2 }
        );
        const nuevas = [subtitle({ Index: 5, Language: 'spa' })];
        const options: TrackOptions = {};

        autoSetNextTracks(prev, nuevas, options, false, true);

        expect(options.DefaultSubtitleStreamIndex).toBe(5);
    });

    it('respeta que el usuario tuviera los subtítulos quitados', () => {
        const prev = source([subtitle({ Index: 0 })], { DefaultSubtitleStreamIndex: -1 });
        const options: TrackOptions = {};

        autoSetNextTracks(prev, [subtitle({ Index: 0, Language: 'spa' })], options, false, true);

        expect(options.DefaultSubtitleStreamIndex).toBe(-1);
    });

    it('el −1 no se traslada al audio: no hay vídeo sin sonido', () => {
        const prev = source([spaAudio], { DefaultAudioStreamIndex: -1 });
        const options: TrackOptions = {};

        autoSetNextTracks(prev, [spaAudio], options, true, false);

        expect(options).not.toHaveProperty('DefaultAudioStreamIndex');
    });

    it('no toca el audio si no se pide', () => {
        const prev = source([spaAudio], { DefaultAudioStreamIndex: 0 });
        const options: TrackOptions = {};

        autoSetNextTracks(prev, [spaAudio], options, false, true);

        expect(options).not.toHaveProperty('DefaultAudioStreamIndex');
    });

    it('también traslada el subtítulo secundario', () => {
        const prev = {
            ...source([subtitle({ Index: 3, Language: 'eng' })]),
            DefaultSecondarySubtitleStreamIndex: 3
        };
        const options: TrackOptions = {};

        autoSetNextTracks(prev, [subtitle({ Index: 7, Language: 'eng' })], options, false, true);

        expect(options.DefaultSecondarySubtitleStreamIndex).toBe(7);
    });

    it('sin fuente anterior no hace nada', () => {
        const options: TrackOptions = {};
        autoSetNextTracks(null, [spaAudio], options, true, true);
        expect(options).toEqual({});
    });

    it('sin pistas nuevas avisa y no elige nada', () => {
        const prev = source([spaAudio], { DefaultAudioStreamIndex: 0 });
        const options: TrackOptions = {};

        autoSetNextTracks(prev, null, options, true, true);

        expect(options).toEqual({});
        expect(console.warn).toHaveBeenCalled();
    });

    it('si la pista anterior ya no está en la fuente, no elige nada', () => {
        const prev = source([spaAudio], { DefaultAudioStreamIndex: 99 });
        const options: TrackOptions = {};

        autoSetNextTracks(prev, [spaAudio], options, true, false);

        expect(options).toEqual({});
    });

    it('un fallo inesperado no impide reproducir', () => {
        const roto = {
            Id: 'ms',
            DefaultAudioStreamIndex: 0,
            get MediaStreams(): MediaStream[] { throw new Error('boom'); }
        } as unknown as MediaSourceInfo;
        const options: TrackOptions = {};

        expect(() => autoSetNextTracks(roto, [spaAudio], options, true, false)).not.toThrow();
        expect(console.error).toHaveBeenCalled();
    });
});
