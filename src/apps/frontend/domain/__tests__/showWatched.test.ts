import { describe, expect, it } from 'vitest';
import {
    getSeasonEpisodeKeys,
    getShowEpisodeKeys,
    isSeasonFullyWatched,
    isShowFullyWatched
} from '../showWatched';
import { episodeKey } from '../../data/stores/itemKeys';

describe('showWatched', () => {
    const mockShow = {
        id: 'show-1',
        seasons: [
            {
                id: 's1',
                n: 1,
                title: 'Temporada 1',
                episodes: [
                    { id: 'e1', n: 1, title: 'Ep 1' },
                    { id: 'e2', n: 2, title: 'Ep 2' }
                ]
            },
            {
                id: 's2',
                n: 2,
                title: 'Temporada 2',
                episodes: [
                    { id: 'e3', n: 1, title: 'Ep 3' }
                ]
            }
        ]
    };

    it('getShowEpisodeKeys extrae todas las claves de episodios', () => {
        const keys = getShowEpisodeKeys(mockShow as any);
        expect(keys).toEqual([
            episodeKey('show-1', 1, 1),
            episodeKey('show-1', 1, 2),
            episodeKey('show-1', 2, 1)
        ]);
    });

    it('getSeasonEpisodeKeys extrae las claves de la temporada solicitada', () => {
        const keys = getSeasonEpisodeKeys('show-1', mockShow.seasons[0] as any);
        expect(keys).toEqual([
            episodeKey('show-1', 1, 1),
            episodeKey('show-1', 1, 2)
        ]);
    });

    it('isShowFullyWatched comprueba si todos los episodios están en el almacén', () => {
        const keys = getShowEpisodeKeys(mockShow as any);
        const watchedSet = new Set(keys);
        const fakeStore = { has: (k: string) => watchedSet.has(k) } as any;

        expect(isShowFullyWatched(mockShow as any, fakeStore)).toBe(true);

        watchedSet.delete(keys[0]);
        expect(isShowFullyWatched(mockShow as any, fakeStore)).toBe(false);
    });

    it('isShowFullyWatched comprueba el id de la serie si no hay episodios cargados', () => {
        const showWithoutEpisodes = { id: 'show-empty', seasons: [] };
        const watchedSet = new Set(['show-empty']);
        const fakeStore = { has: (k: string) => watchedSet.has(k) } as any;

        expect(isShowFullyWatched(showWithoutEpisodes as any, fakeStore)).toBe(true);
    });

    it('isSeasonFullyWatched comprueba que todos los episodios de la temporada están vistos', () => {
        const season = mockShow.seasons[0];
        const keys = getSeasonEpisodeKeys('show-1', season as any);
        const watchedSet = new Set(keys);
        const fakeStore = { has: (k: string) => watchedSet.has(k) } as any;

        expect(isSeasonFullyWatched('show-1', season as any, fakeStore)).toBe(true);

        watchedSet.delete(keys[1]);
        expect(isSeasonFullyWatched('show-1', season as any, fakeStore)).toBe(false);
    });
});
