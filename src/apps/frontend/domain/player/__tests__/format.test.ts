import { describe, expect, test } from 'vitest';
import { sanitizeVttCueText, subtitleTrackMode } from '../format';

describe('sanitizeVttCueText', () => {
    test('quita un bloque de override tags ASS', () => {
        expect(sanitizeVttCueText('{\\an8}Hola')).toBe('Hola');
    });

    test('quita varios bloques en la misma cue', () => {
        expect(sanitizeVttCueText('{\\c&H7C6A6B&\\bord0}Hola{\\an8} mundo')).toBe('Hola mundo');
    });

    test('deja intacto el texto sin tags', () => {
        expect(sanitizeVttCueText('Hola mundo')).toBe('Hola mundo');
    });
});

describe('subtitleTrackMode', () => {
    const track = {} as TextTrack;
    const otherTrack = {} as TextTrack;

    test('sin subtítulo activo, todas las pistas se apagan', () => {
        expect(subtitleTrackMode(null, null, track)).toBe('disabled');
    });

    test('con subtítulo activo, solo se muestra la pista actual', () => {
        expect(subtitleTrackMode('https://x/Stream.vtt', track, track)).toBe('showing');
    });

    test('con subtítulo activo, las demás pistas se apagan', () => {
        expect(subtitleTrackMode('https://x/Stream.vtt', track, otherTrack)).toBe('disabled');
    });
});
