import { describe, expect, it } from 'vitest';
import { autoTagsFor, getItemTags, normalizeTagForSearch } from '../tags';

describe('autoTagsFor', () => {
    it('está exportada desde domain/tags y devuelve un array', () => {
        expect(Array.isArray(autoTagsFor(undefined))).toBe(true);
        expect(Array.isArray(autoTagsFor('inexistente-123'))).toBe(true);
    });
});

describe('normalizeTagForSearch', () => {
    it('normaliza a minúsculas y recorta espacios', () => {
        expect(normalizeTagForSearch('  Anime ')).toBe('anime');
        expect(normalizeTagForSearch('Ciencia Ficción')).toBe('ciencia ficción');
        expect(normalizeTagForSearch('')).toBe('');
        expect(normalizeTagForSearch(null)).toBe('');
        expect(normalizeTagForSearch(undefined)).toBe('');
    });
});

describe('getItemTags', () => {
    it('devuelve string[] con los tags del vocabulario cerrado, no objetos', () => {
        const item = {
            autoTags: ['Anime', 'Suspense'],
            tags: ['anime', 'Comedia']
        };
        const tags = getItemTags(item);
        // Debe devolver strings, no objetos con label/source
        expect(tags.every((t) => typeof t === 'string')).toBe(true);
    });

    it('autoTags del vocabulario pasan directamente', () => {
        const item = { autoTags: ['Anime', 'Terror', 'Suspense'] };
        const tags = getItemTags(item);
        expect(tags).toContain('Anime');
        expect(tags).toContain('Terror');
        expect(tags).toContain('Suspense');
    });

    it('server tags basura de TMDB se descartan', () => {
        const item = {
            tags: ['aftercreditsstinger', 'blind girl', 'based on novel']
        };
        const tags = getItemTags(item);
        // Los keywords de cola larga no están en el vocabulario
        expect(tags).not.toContain('aftercreditsstinger');
        expect(tags).not.toContain('Aftercreditsstinger');
        expect(tags).not.toContain('blind girl');
        expect(tags).not.toContain('Blind girl');
    });

    it('server tags que SÍ están en el vocabulario pasan', () => {
        const item = {
            tags: ['Anime', 'Terror psicológico']
        };
        const tags = getItemTags(item);
        expect(tags).toContain('Anime');
        expect(tags).toContain('Terror psicológico');
    });

    it('no incluye genres — los genres viven en su propio módulo', () => {
        const item = {
            genres: ['Action', 'Comedy'],
            tags: ['Anime']
        };
        const tags = getItemTags(item);
        // Los genres no pasan por getItemTags: no están en el vocabulario
        // como 'Action' o 'Comedy' (esos son en inglés y no son del vocabulario)
        expect(tags).not.toContain('Action');
        expect(tags).not.toContain('Acción');
        expect(tags).not.toContain('Comedy');
        expect(tags).not.toContain('Comedia');
        // Pero Anime sí está en el vocabulario
        expect(tags).toContain('Anime');
    });

    it('deduplica case-insensitive entre autoTags y server tags', () => {
        const item = {
            autoTags: ['Anime', 'Terror'],
            tags: ['anime', 'TERROR']
        };
        const tags = getItemTags(item);
        expect(tags.filter((t) => t.toLowerCase() === 'anime')).toHaveLength(1);
        expect(tags.filter((t) => t.toLowerCase() === 'terror')).toHaveLength(1);
    });

    it('ordena alfabéticamente', () => {
        const item = {
            autoTags: ['Terror', 'Anime', 'Comedia']
        };
        const tags = getItemTags(item);
        const sorted = [...tags].sort((a, b) => a.localeCompare(b));
        expect(tags).toEqual(sorted);
    });

    it('maneja items nulos o vacíos', () => {
        expect(getItemTags(null)).toEqual([]);
        expect(getItemTags(undefined)).toEqual([]);
        expect(getItemTags({})).toEqual([]);
        expect(getItemTags({ tags: [], autoTags: [] })).toEqual([]);
    });
});
