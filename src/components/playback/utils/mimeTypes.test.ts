import { describe, expect, it } from 'vitest';

import { getMimeType } from './mimeTypes';

describe('getMimeType', () => {
    it('la regla general es tipo/contenedor', () => {
        expect(getMimeType('audio', 'mp3')).toBe('audio/mp3');
        expect(getMimeType('video', 'mp4')).toBe('video/mp4');
        expect(getMimeType('video', 'webm')).toBe('video/webm');
    });

    it('traduce los contenedores de audio cuyo nombre no es el subtipo MIME', () => {
        expect(getMimeType('audio', 'opus')).toBe('audio/ogg');
        expect(getMimeType('audio', 'webma')).toBe('audio/webm');
        expect(getMimeType('audio', 'm4a')).toBe('audio/mp4');
    });

    it('traduce los de vídeo', () => {
        expect(getMimeType('video', 'mkv')).toBe('video/x-matroska');
        expect(getMimeType('video', 'm4v')).toBe('video/mp4');
        expect(getMimeType('video', 'mov')).toBe('video/quicktime');
        expect(getMimeType('video', 'mpg')).toBe('video/mpeg');
        expect(getMimeType('video', 'flv')).toBe('video/x-flv');
    });

    it('el contenedor no distingue mayúsculas', () => {
        expect(getMimeType('video', 'MKV')).toBe('video/x-matroska');
    });

    it('las traducciones no se cruzan entre tipos', () => {
        // 'mkv' solo significa matroska en vídeo.
        expect(getMimeType('audio', 'mkv')).toBe('audio/mkv');
    });

    it('sin contenedor devuelve el tipo con la barra', () => {
        expect(getMimeType('video')).toBe('video/');
        expect(getMimeType('video', '')).toBe('video/');
        expect(getMimeType('video', null)).toBe('video/');
    });

    it('un tipo desconocido no rompe', () => {
        expect(getMimeType('book', 'epub')).toBe('book/epub');
    });
});
