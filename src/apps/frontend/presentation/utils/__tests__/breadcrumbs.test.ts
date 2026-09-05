import { describe, expect, it } from 'vitest';
import { buildShowBreadcrumbs } from '../breadcrumbs';

describe('buildShowBreadcrumbs', () => {
    const mockShow = {
        id: 's-10',
        title: 'Breaking Bad',
        genres: ['Drama', 'Crime'],
        seasons: []
    } as any;

    const mockSeason = {
        id: 'season-1',
        n: 1,
        title: 'Temporada 1',
        episodes: []
    } as any;

    const mockEpisode = {
        id: 'ep-1',
        n: 1,
        title: 'Piloto'
    } as any;

    it('construye migas para una serie', () => {
        const crumbs = buildShowBreadcrumbs(mockShow);
        expect(crumbs).toHaveLength(3);
        expect(crumbs[0].to).toEqual({ page: 'home' });
        expect(crumbs[1].label).toBe('Drama');
        expect(crumbs[2].label).toBe('Breaking Bad');
        expect(crumbs[2].to).toBeUndefined();
    });

    it('construye migas para una temporada', () => {
        const crumbs = buildShowBreadcrumbs(mockShow, mockSeason);
        expect(crumbs).toHaveLength(3);
        expect(crumbs[0].to).toEqual({ page: 'home' });
        expect(crumbs[1].label).toBe('Breaking Bad');
        expect(crumbs[1].to).toEqual({ page: 'show', showId: 's-10' });
        expect(crumbs[2].label).toBe('Temporada 1');
        expect(crumbs[2].to).toBeUndefined();
    });

    it('construye migas para un episodio', () => {
        const crumbs = buildShowBreadcrumbs(mockShow, mockSeason, mockEpisode);
        expect(crumbs).toHaveLength(4);
        expect(crumbs[0].to).toEqual({ page: 'home' });
        expect(crumbs[1].label).toBe('Breaking Bad');
        expect(crumbs[1].to).toEqual({ page: 'show', showId: 's-10' });
        expect(crumbs[2].label).toBe('Temporada 1');
        expect(crumbs[2].to).toEqual({ page: 'season', showId: 's-10', seasonN: 1 });
        expect(crumbs[3].label).toBe('Episodio 1');
        expect(crumbs[3].to).toBeUndefined();
    });
});
