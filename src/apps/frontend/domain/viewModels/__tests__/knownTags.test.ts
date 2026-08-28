import { describe, expect, it } from 'vitest';
import { knownTags, registerTagSource } from '../knownTags';

describe('knownTags', () => {
    it('unifica géneros traducidos, etiquetas y autotags de fuentes registradas sin duplicados', () => {
        registerTagSource(() => [
            {
                genres: ['Comedy', 'Romance'],
                tags: ['romance', 'anime', 'university'],
                autoTags: ['slice of life']
            },
            {
                genres: ['Action'],
                tags: ['University', 'amnesia']
            }
        ]);

        const tags = knownTags();

        // Debe incluir los géneros traducidos al español
        expect(tags).toContain('Comedia');
        expect(tags).toContain('Romance');
        expect(tags).toContain('Acción');

        // Debe incluir las etiquetas y autotags
        expect(tags).toContain('anime');
        expect(tags).toContain('university');
        expect(tags).toContain('slice of life');
        expect(tags).toContain('amnesia');

        // Debe estar ordenado alfabéticamente
        const sorted = [...tags].sort((a, b) => a.localeCompare(b));
        expect(tags).toEqual(sorted);

        // Sin duplicados insensibles a mayúsculas
        expect(tags.filter((t) => t.toLowerCase() === 'romance')).toHaveLength(1);
        expect(tags.filter((t) => t.toLowerCase() === 'university')).toHaveLength(1);
    });
});
