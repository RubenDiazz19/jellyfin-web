import { describe, expect, it } from 'vitest';
import {
    getGenreVariants,
    getHeroGenres,
    getItemGenres,
    translateGenre
} from '../genres';

describe('translateGenre', () => {
    it('traduce géneros y etiquetas conocidas al español', () => {
        expect(translateGenre('Romance')).toBe('Romance');
        expect(translateGenre('Action')).toBe('Acción');
        expect(translateGenre('Action & Adventure')).toBe('Acción y Aventura');
        expect(translateGenre('Science Fiction')).toBe('Ciencia ficción');
        expect(translateGenre('Animation')).toBe('Animación');
        expect(translateGenre('Magic')).toBe('Magia');
        expect(translateGenre('magic')).toBe('Magia');
        expect(translateGenre('university')).toBe('Universidad');
        expect(translateGenre('slice of life')).toBe('Recuentos de la vida');
    });

    it('devuelve el texto con formato limpio si no tiene traducción conocida o ya está en español', () => {
        expect(translateGenre('Acción')).toBe('Acción');
        expect(translateGenre('etiquetaInventada')).toBe('EtiquetaInventada');
        expect(translateGenre('')).toBe('');
        expect(translateGenre(null)).toBe('');
    });
});

describe('getGenreVariants', () => {
    it('devuelve variantes en español e inglés para búsquedas en el servidor', () => {
        const accionVariants = getGenreVariants('Acción');
        expect(accionVariants).toContain('Acción');
        expect(accionVariants).toContain('Action');

        const actionVariants = getGenreVariants('Action');
        expect(actionVariants).toContain('Action');
        expect(actionVariants).toContain('Acción');
    });

    it('devuelve el término original si no es un género estándar', () => {
        expect(getGenreVariants('etiquetaCustom')).toEqual(['etiquetaCustom']);
        expect(getGenreVariants('')).toEqual([]);
    });
});

describe('getItemGenres', () => {
    it('traduce géneros del servidor al español', () => {
        const item = { genres: ['Romance', 'Comedy', 'Animation'] };
        const genres = getItemGenres(item);
        expect(genres).toContain('Romance');
        expect(genres).toContain('Comedia');
        expect(genres).toContain('Animación');
    });

    it('deduplica insensible a mayúsculas', () => {
        const item = { genres: ['Comedy', 'comedy', 'COMEDY'] };
        const genres = getItemGenres(item);
        expect(genres.filter((g) => g.toLowerCase() === 'comedia')).toHaveLength(1);
    });

    it('conserva el orden de aparición (no ordena alfabéticamente)', () => {
        const item = { genres: ['Drama', 'Action', 'Comedy'] };
        const genres = getItemGenres(item);
        expect(genres[0]).toBe('Drama');
        expect(genres[1]).toBe('Acción');
        expect(genres[2]).toBe('Comedia');
    });

    it('maneja items nulos o vacíos', () => {
        expect(getItemGenres(null)).toEqual([]);
        expect(getItemGenres(undefined)).toEqual([]);
        expect(getItemGenres({})).toEqual([]);
        expect(getItemGenres({ genres: [] })).toEqual([]);
    });
});

describe('getHeroGenres', () => {
    it('limita los géneros a 3 por defecto', () => {
        const item = { genres: ['Romance', 'Comedy', 'Animation', 'Drama'] };
        const hero = getHeroGenres(item);
        expect(hero).toHaveLength(3);
        expect(hero).toEqual(['Romance', 'Comedia', 'Animación']);
    });

    it('acepta un límite personalizado', () => {
        const item = { genres: ['Romance', 'Comedy', 'Animation', 'Drama'] };
        const hero = getHeroGenres(item, 2);
        expect(hero).toHaveLength(2);
        expect(hero).toEqual(['Romance', 'Comedia']);
    });

    it('maneja items sin géneros', () => {
        expect(getHeroGenres(null)).toEqual([]);
        expect(getHeroGenres({})).toEqual([]);
    });
});
