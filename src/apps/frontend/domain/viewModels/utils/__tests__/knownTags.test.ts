import { describe, expect, it } from 'vitest';
import { knownTags, registerTagSource } from '../knownTags';

describe('knownTags', () => {
    it('solo incluye tags del vocabulario cerrado, no géneros traducidos', () => {
        registerTagSource(() => [
            {
                tags: ['Vampiros', 'aftercreditsstinger', 'blind girl'],
                autoTags: ['Melancólica', 'Trepidante']
            },
            {
                tags: ['vampiros', 'Venganza'],
                autoTags: ['Distopía']
            }
        ]);

        const tags = knownTags();

        // Tags del vocabulario que pasan canonicalTag()
        expect(tags).toContain('Vampiros');
        expect(tags).toContain('Melancólica');
        expect(tags).toContain('Trepidante');
        expect(tags).toContain('Venganza');
        expect(tags).toContain('Distopía');

        // Keywords basura de TMDB se descartan
        expect(tags).not.toContain('aftercreditsstinger');
        expect(tags).not.toContain('Aftercreditsstinger');
        expect(tags).not.toContain('blind girl');
        expect(tags).not.toContain('Blind girl');

        // Ordenado alfabéticamente
        const sorted = [...tags].sort((a, b) => a.localeCompare(b));
        expect(tags).toEqual(sorted);

        // Sin duplicados insensibles a mayúsculas
        expect(tags.filter((t) => t.toLowerCase() === 'vampiros')).toHaveLength(1);
    });
});
