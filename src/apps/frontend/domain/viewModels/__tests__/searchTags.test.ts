import { describe, it, expect } from 'vitest';
import { computeAllTags, computeAvailableTags } from '../searchTags';
import type { Movie, Show } from '../../../data/models';

function mockShow(id: string, tags?: string[], autoTags?: string[]): Show {
    return { id, tags, autoTags, seasons: [] } as unknown as Show;
}

function mockMovie(id: string, tags?: string[], autoTags?: string[]): Movie {
    return { id, tags, autoTags } as unknown as Movie;
}

describe('searchTags', () => {
    describe('computeAllTags', () => {
        it('extrae, normaliza y ordena etiquetas de series y películas deduplicando', () => {
            const items = [
                mockShow('s1', ['Space opera', 'Venganza']),
                mockMovie('m1', ['space opera', 'Melancólica'])
            ];

            const result = computeAllTags(items);
            // Deduplicado ignorando mayúsculas y ordenado alfabéticamente
            expect(result).toEqual(['Melancólica', 'Space opera', 'Venganza']);
        });

        it('devuelve array vacío si no hay etiquetas', () => {
            const items = [mockShow('s1', []), mockMovie('m1')];
            expect(computeAllTags(items)).toEqual([]);
        });
    });

    describe('computeAvailableTags', () => {
        const allTags = ['Melancólica', 'Space opera', 'Trepidante', 'Venganza'];

        it('devuelve todas las etiquetas si no hay ningún filtro activo', () => {
            const result = computeAvailableTags({
                allTags,
                activeTags: [],
                currentResults: [mockMovie('m1', ['Space opera'])],
                hasOtherFilters: false
            });

            expect(result).toEqual(allTags);
        });

        it('mantiene activas las etiquetas seleccionadas y añade las que discriminan', () => {
            const m1 = mockMovie('m1', ['Space opera', 'Trepidante']);
            const m2 = mockMovie('m2', ['Space opera', 'Venganza']);

            const result = computeAvailableTags({
                allTags,
                activeTags: ['Space opera'],
                currentResults: [m1, m2],
                hasOtherFilters: true
            });

            expect(result).toContain('Space opera');
            expect(result).toContain('Trepidante');
            expect(result).toContain('Venganza');
        });

        it('filtra etiquetas no presentes cuando solo hay filtros de categoría/tipo', () => {
            const m1 = mockMovie('m1', ['Trepidante']);

            const result = computeAvailableTags({
                allTags,
                activeTags: [],
                currentResults: [m1],
                hasOtherFilters: true
            });

            expect(result).toEqual(['Trepidante']);
        });
    });
});
