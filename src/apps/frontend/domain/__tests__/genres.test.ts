import { describe, expect, test } from 'vitest';
import { translateGenre } from '../genres';

describe('translateGenre', () => {
    test('traduce géneros combinados comunes de TMDB al español', () => {
        expect(translateGenre('Action & Adventure')).toBe('Acción y Aventura');
        expect(translateGenre('Sci-Fi & Fantasy')).toBe('Ciencia ficción y Fantasía');
        expect(translateGenre('War & Politics')).toBe('Bélico y Política');
    });

    test('traduce géneros individuales en inglés', () => {
        expect(translateGenre('Animation')).toBe('Animación');
        expect(translateGenre('Thriller')).toBe('Suspense');
        expect(translateGenre('Horror')).toBe('Terror');
        expect(translateGenre('Science Fiction')).toBe('Ciencia ficción');
    });

    test('mantiene géneros que ya están en español o no tienen traducción', () => {
        expect(translateGenre('Animación')).toBe('Animación');
        expect(translateGenre('Comedia')).toBe('Comedia');
        expect(translateGenre('Género Desconocido')).toBe('Género Desconocido');
    });

    test('tolera cadenas vacías o undefined', () => {
        expect(translateGenre('')).toBe('');
        expect(translateGenre(undefined)).toBe('');
        expect(translateGenre(null)).toBe('');
    });
});
