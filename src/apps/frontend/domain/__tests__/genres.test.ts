import { describe, expect, it } from 'vitest';
import {
    cleanGenres,
    expandGenre,
    getGenreVariants,
    getHeroGenres,
    getItemGenres,
    translateGenre
} from '../genres';

describe('translateGenre', () => {
    it('traduce géneros y etiquetas conocidas al español', () => {
        expect(translateGenre('Romance')).toBe('Romance');
        expect(translateGenre('Action')).toBe('Acción');
        expect(translateGenre('Action & Adventure')).toBe('Acción');
        expect(translateGenre('Sci-Fi & Fantasy')).toBe('Ciencia ficción');
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

describe('expandGenre', () => {
    it('descompone géneros compuestos en sus partes individuales en español', () => {
        expect(expandGenre('Action & Adventure')).toEqual(['Acción', 'Aventura']);
        expect(expandGenre('Acción y Aventura')).toEqual(['Acción', 'Aventura']);
        expect(expandGenre('Sci-Fi & Fantasy')).toEqual(['Ciencia ficción', 'Fantasía']);
        expect(expandGenre('Ciencia ficción y Fantasía')).toEqual(['Ciencia ficción', 'Fantasía']);
        expect(expandGenre('War & Politics')).toEqual(['Bélico']);
        expect(expandGenre('Bélico y Política')).toEqual(['Bélico']);
    });

    it('traduce géneros simples al español', () => {
        expect(expandGenre('Animation')).toEqual(['Animación']);
        expect(expandGenre('Comedy')).toEqual(['Comedia']);
        expect(expandGenre('')).toEqual([]);
        expect(expandGenre(null)).toEqual([]);
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
    it('traduce géneros del servidor al español y descompone Acción y Aventura', () => {
        const item = { genres: ['Romance', 'Comedy', 'Animation', 'Action & Adventure'] };
        const genres = getItemGenres(item);
        expect(genres).toContain('Romance');
        expect(genres).toContain('Comedia');
        expect(genres).toContain('Animación');
        expect(genres).toContain('Acción');
        expect(genres).toContain('Aventura');
        expect(genres).not.toContain('Acción y Aventura');
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

describe('cleanGenres', () => {
    it('traduce, expande y deduplica una lista directa de cadenas', () => {
        expect(cleanGenres(['Action & Adventure', 'Sci-Fi & Fantasy', 'comedy', 'COMEDY'])).toEqual([
            'Acción',
            'Aventura',
            'Ciencia ficción',
            'Fantasía',
            'Comedia'
        ]);
    });

    it('maneja valores nulos o vacíos', () => {
        expect(cleanGenres(null)).toEqual([]);
        expect(cleanGenres(undefined)).toEqual([]);
        expect(cleanGenres([])).toEqual([]);
    });
});

