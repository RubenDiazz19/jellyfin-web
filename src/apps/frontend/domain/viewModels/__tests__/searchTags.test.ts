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
                mockShow('s1', ['Anime', 'Comedia']),
                mockMovie('m1', ['anime', 'Drama'])
            ];

            const result = computeAllTags(items);
            // Deduplicado ignorando mayúsculas y ordenado alfabéticamente
            expect(result).toEqual(['Anime', 'Comedia', 'Drama']);
        });

        it('devuelve array vacío si no hay etiquetas', () => {
            const items = [mockShow('s1', []), mockMovie('m1')];
            expect(computeAllTags(items)).toEqual([]);
        });
    });

    describe('computeAvailableTags', () => {
        const allTags = ['Acción', 'Anime', 'Comedia', 'Drama'];

        it('devuelve todas las etiquetas si no hay ningún filtro activo', () => {
            const result = computeAvailableTags({
                allTags,
                activeTags: [],
                currentResults: [mockMovie('m1', ['Anime'])],
                hasOtherFilters: false
            });

            expect(result).toEqual(allTags);
        });

        it('mantiene activas las etiquetas seleccionadas y añade las que discriminan', () => {
            const m1 = mockMovie('m1', ['Anime', 'Acción']);
            const m2 = mockMovie('m2', ['Anime', 'Comedia']);

            const result = computeAvailableTags({
                allTags,
                activeTags: ['Anime'],
                currentResults: [m1, m2],
                hasOtherFilters: true
            });

            expect(result).toContain('Anime');
            expect(result).toContain('Acción');
            expect(result).toContain('Comedia');
        });

        it('filtra etiquetas no presentes cuando solo hay filtros de categoría/tipo', () => {
            const m1 = mockMovie('m1', ['Acción']);

            const result = computeAvailableTags({
                allTags,
                activeTags: [],
                currentResults: [m1],
                hasOtherFilters: true
            });

            expect(result).toEqual(['Acción']);
        });
    });
});
