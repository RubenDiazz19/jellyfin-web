import { describe, expect, it } from 'vitest';
import { knownTags, registerTagSource } from '../knownTags';

describe('knownTags', () => {
    it('solo incluye tags del vocabulario cerrado, no géneros traducidos', () => {
        registerTagSource(() => [
            {
                tags: ['Anime', 'aftercreditsstinger', 'blind girl'],
                autoTags: ['Terror', 'Suspense']
            },
            {
                tags: ['anime', 'Comedia'],
                autoTags: ['Bélico']
            }
        ]);

        const tags = knownTags();

        // Tags del vocabulario que pasan canonicalTag()
        expect(tags).toContain('Anime');
        expect(tags).toContain('Terror');
        expect(tags).toContain('Suspense');
        expect(tags).toContain('Comedia');
        expect(tags).toContain('Bélico');

        // Keywords basura de TMDB se descartan
        expect(tags).not.toContain('aftercreditsstinger');
        expect(tags).not.toContain('Aftercreditsstinger');
        expect(tags).not.toContain('blind girl');
        expect(tags).not.toContain('Blind girl');

        // Ordenado alfabéticamente
        const sorted = [...tags].sort((a, b) => a.localeCompare(b));
        expect(tags).toEqual(sorted);

        // Sin duplicados insensibles a mayúsculas
        expect(tags.filter((t) => t.toLowerCase() === 'anime')).toHaveLength(1);
    });
});
