import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FavoritesViewModel } from '../FavoritesViewModel';
import { FAVS } from '../../../data/stores/favsStore';
import type { ApiService } from '../../../data/api/ApiService';
import type { Movie, Show } from '../../../data/models';

vi.mock('../../../data/stores/favsStore', () => ({
    FAVS: {
        all: vi.fn(),
        has: vi.fn()
    }
}));

const mockApi = {
    items: { hydrateFavorites: vi.fn() },
    catalog: {
        getMovie: vi.fn(),
        getShow: vi.fn()
    }
} as unknown as ApiService;

describe('FavoritesViewModel', () => {
    let vm: FavoritesViewModel;

    beforeEach(() => {
        vi.clearAllMocks();
        vm = new FavoritesViewModel(mockApi);
    });

    it('initializes in loading state', () => {
        expect(vm.loading.value).toBe(true);
    });

    it('loads favorites by hydrating and fetching from API', async () => {
        const mockMovie = { id: 'm1' } as Movie;
        const mockShow = {
            id: 's1',
            seasons: [
                { n: 1, episodes: [{ n: 1 }] }
            ]
        } as Show;

        vi.mocked(mockApi.items.hydrateFavorites).mockResolvedValue();
        vi.mocked(FAVS.all).mockReturnValue(['movie-m1', 's1', 's1-s1', 's1-s1-e1']);

        vi.mocked(mockApi.catalog.getMovie).mockImplementation(async (id) => {
            if (id === 'm1') return mockMovie;
            throw new Error('Not found');
        });

        vi.mocked(mockApi.catalog.getShow).mockImplementation(async (id) => {
            if (id === 's1') return mockShow;
            throw new Error('Not found');
        });

        await vm.load();

        expect(vm.loading.value).toBe(false);
        expect(vm.movies.value).toEqual([mockMovie]);
        expect(vm.shows.value).toEqual([mockShow]); // because 'show:s1' is in the list
        expect(vm.seasons.value).toEqual([{ show: mockShow, season: mockShow.seasons[0] }]);
        expect(vm.episodes.value).toEqual([{ show: mockShow, season: mockShow.seasons[0], episode: mockShow.seasons[0].episodes[0] }]);
    });

    it('syncWithStore removes unfavorited items', () => {
        vm.movies.value = [{ id: 'm1' } as Movie];
        vm.shows.value = [{ id: 's1' } as Show];
        vm.seasons.value = [{ show: { id: 's1' }, season: { n: 1 } } as any];
        vm.episodes.value = [{ show: { id: 's1' }, season: { n: 1 }, episode: { n: 1 } } as any];

        // Let's pretend only movie-m1 and s1 are still favorites
        vi.mocked(FAVS.has).mockImplementation((key) => {
            return key === 'movie-m1' || key === 's1';
        });

        vm.syncWithStore();

        expect(vm.movies.value).toHaveLength(1);
        expect(vm.shows.value).toHaveLength(1);
        expect(vm.seasons.value).toHaveLength(0); // show:s1:season:1 -> false
        expect(vm.episodes.value).toHaveLength(0); // show:s1:season:1:episode:1 -> false
    });
});
