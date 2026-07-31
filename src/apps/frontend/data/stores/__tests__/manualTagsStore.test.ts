// Registro de etiquetas escritas a mano: es lo que separa lo que el usuario
// teclea de los keywords que baja TMDB.

import { beforeEach, describe, expect, test } from 'vitest';
import { MANUAL_TAGS } from '../manualTagsStore';

beforeEach(() => {
    localStorage.clear();
    MANUAL_TAGS._reset();
});

describe('manualTagsStore', () => {
    test('recuerda lo añadido', () => {
        MANUAL_TAGS.add(['Para ver']);
        expect(MANUAL_TAGS.has('Para ver')).toBe(true);
    });

    test('lo no añadido no consta', () => {
        expect(MANUAL_TAGS.has('aftercreditsstinger')).toBe(false);
    });

    test('ignora mayúsculas y espacios al consultar', () => {
        MANUAL_TAGS.add(['Para ver']);
        expect(MANUAL_TAGS.has('  para VER ')).toBe(true);
    });

    test('persiste entre instancias', () => {
        MANUAL_TAGS.add(['Navideño']);
        MANUAL_TAGS._reset();
        expect(MANUAL_TAGS.has('Navideño')).toBe(true);
    });

    test('descarta vacíos', () => {
        MANUAL_TAGS.add(['', '   ']);
        expect(JSON.parse(localStorage.getItem('jfp-manual-tags') || '[]')).toEqual([]);
    });

    test('sobrevive a un localStorage corrupto', () => {
        localStorage.setItem('jfp-manual-tags', 'no es json');
        MANUAL_TAGS._reset();
        expect(MANUAL_TAGS.has('lo que sea')).toBe(false);
        MANUAL_TAGS.add(['Anime']);
        expect(MANUAL_TAGS.has('Anime')).toBe(true);
    });
});
