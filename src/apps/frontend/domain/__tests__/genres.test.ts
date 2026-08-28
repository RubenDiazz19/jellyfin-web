import { describe, expect, it } from 'vitest';
import {
    getGenreVariants,
    getHeroCategories,
    getItemCategories,
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

describe('getItemCategories', () => {
    it('combina géneros traducidos, etiquetas y autotags deduplicando insensible a mayúsculas', () => {
        const item = {
            genres: ['Romance', 'Comedy', 'Animation'],
            tags: ['romance', 'slice of life', 'university', 'magic'],
            autoTags: ['shounen', 'Slice of Life']
        };

        const categories = getItemCategories(item);

        // Debe traducir todo al español
        expect(categories).toContain('Romance');
        expect(categories).toContain('Comedia');
        expect(categories).toContain('Animación');
        expect(categories).toContain('Recuentos de la vida');
        expect(categories).toContain('Universidad');
        expect(categories).toContain('Magia');
        expect(categories).toContain('Shounen');

        // 'romance' de tags y 'Slice of Life' de autoTags deben haber sido deduplicados
        expect(categories.filter((c) => c.toLowerCase() === 'romance')).toHaveLength(1);
        expect(categories.filter((c) => c.toLowerCase() === 'recuentos de la vida')).toHaveLength(1);
    });

    it('maneja items nulos o vacíos', () => {
        expect(getItemCategories(null)).toEqual([]);
        expect(getItemCategories({})).toEqual([]);
        expect(getItemCategories({ genres: [], tags: [], autoTags: [] })).toEqual([]);
    });
});

describe('getHeroCategories', () => {
    it('limita las categorías devueltas a 3 por defecto', () => {
        const item = {
            genres: ['Romance', 'Comedy', 'Animation', 'Drama'],
            tags: ['university', 'amnesia', 'slice of life']
        };

        const hero = getHeroCategories(item);
        expect(hero).toHaveLength(3);
        expect(hero).toEqual(['Romance', 'Comedia', 'Animación']);

        const customHero = getHeroCategories(item, 2);
        expect(customHero).toHaveLength(2);
        expect(customHero).toEqual(['Romance', 'Comedia']);
    });
});

