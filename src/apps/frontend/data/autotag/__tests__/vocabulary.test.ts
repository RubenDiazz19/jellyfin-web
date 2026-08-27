// El vocabulario es una lista escrita a mano y se va a editar: estos tests
// son la red para que una edición descuidada no rompa el etiquetado.

import { describe, expect, test } from 'vitest';
import { canonicalTag, isVocabularyTag, translateEnglishTag, VOCABULARY, VOCABULARY_TAGS } from '../vocabulary';

describe('vocabulary', () => {
    test('no hay etiquetas repetidas', () => {
        const keys = VOCABULARY_TAGS.map((t) => t.toLowerCase());
        expect(new Set(keys).size).toBe(keys.length);
    });

    test('todas tienen pista para el modelo', () => {
        const sinPista = VOCABULARY.filter((e) => !e.hint.trim());
        expect(sinPista).toEqual([]);
    });

    test('ninguna etiqueta lleva espacios de sobra', () => {
        expect(VOCABULARY_TAGS.filter((t) => t !== t.trim())).toEqual([]);
    });

    test('canonicalTag devuelve la grafía del vocabulario', () => {
        expect(canonicalTag('ANIME')).toBe('Anime');
        expect(canonicalTag('  terror psicológico ')).toBe('Terror psicológico');
    });

    test('canonicalTag rechaza lo que no está', () => {
        expect(canonicalTag('Comedia romántica')).toBeUndefined();
        expect(isVocabularyTag('blind girl')).toBe(false);
    });

    test('los acentos cuentan: no se aceptan variantes sin tilde', () => {
        // Si algún día se quiere tolerar, hay que hacerlo explícito en
        // `canonicalTag`; que pase de rebote sería un bug silencioso.
        expect(canonicalTag('Belico')).toBeUndefined();
        expect(canonicalTag('Bélico')).toBe('Bélico');
    });

    test('translateEnglishTag mapea términos comunes en inglés al español', () => {
        expect(translateEnglishTag('action')).toBe('Acción');
        expect(translateEnglishTag('Science Fiction')).toBe('Ciencia ficción');
        expect(translateEnglishTag('unknown_tag')).toBeUndefined();
    });
});
