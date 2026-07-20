import { describe, expect, test, vi } from 'vitest';
import { HomeViewModel } from '../HomeViewModel';
import type { ApiService } from '../../../data/api/ApiService';

// El singleton apiService arrastra ServerConnections; los tests construyen
// sus propios VMs con mocks, así que el módulo real se sustituye entero.
vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const slide = { id: 's1', type: 'continue', title: 'Dandelion' };
const show = { id: 'sh1', title: 'Dandelion' };
const movie = { id: 'm1', title: 'Obsesión' };

function mockApi(overrides: {
    carousel?: () => Promise<unknown>;
    shows?: () => Promise<unknown>;
    movies?: () => Promise<unknown>;
} = {}): ApiService {
    return {
        catalog: {
            getHomeCarousel: vi.fn(overrides.carousel ?? (() => Promise.resolve([slide]))),
            getShows: vi.fn(overrides.shows ?? (() => Promise.resolve([show]))),
            getMovies: vi.fn(overrides.movies ?? (() => Promise.resolve([movie])))
        }
    } as unknown as ApiService;
}

describe('HomeViewModel', () => {
    test('load() rellena carrusel y biblioteca', async () => {
        const vm = new HomeViewModel(mockApi());
        await vm.load();
        // El carrusel se resuelve en un then() paralelo; drena la microtask.
        await Promise.resolve();

        expect(vm.slides.value).toEqual([slide]);
        expect(vm.shows.value).toEqual([show]);
        expect(vm.movies.value).toEqual([movie]);
        expect(vm.heroLoading.value).toBe(false);
        expect(vm.showsLoading.value).toBe(false);
        expect(vm.heroReady.value).toBe(true);
        expect(vm.showsReady.value).toBe(true);
        expect(vm.showsError.value).toBeNull();
    });

    test('si el hero falla, la biblioteca sigue cargando', async () => {
        const vm = new HomeViewModel(mockApi({
            carousel: () => Promise.reject(new Error('hero caído'))
        }));
        await vm.load();
        await Promise.resolve();

        expect(vm.slides.value).toEqual([]);
        expect(vm.shows.value).toEqual([show]);
        expect(vm.showsError.value).toBeNull();
        expect(vm.heroReady.value).toBe(true);
    });

    test('si la biblioteca falla, expone el error', async () => {
        const vm = new HomeViewModel(mockApi({
            shows: () => Promise.reject(new Error('sin conexión'))
        }));
        await vm.load();

        expect(vm.showsError.value).toBe('sin conexión');
        expect(vm.showsLoading.value).toBe(false);
    });

    test('si fallan solo las películas, las series siguen cargando', async () => {
        const vm = new HomeViewModel(mockApi({
            movies: () => Promise.reject(new Error('movies caídas'))
        }));
        await vm.load();

        expect(vm.shows.value).toEqual([show]);
        expect(vm.movies.value).toEqual([]);
        expect(vm.showsError.value).toBeNull();
    });

    test('una carga antigua no pisa a la más reciente', async () => {
        let resolveOld!: (v: unknown) => void;
        const old = new Promise((r) => { resolveOld = r; });
        const api = mockApi();
        const getShows = api.catalog.getShows as ReturnType<typeof vi.fn>;
        getShows
            .mockImplementationOnce(() => old)
            .mockImplementationOnce(() => Promise.resolve([show]));

        const vm = new HomeViewModel(api);
        const first = vm.load();
        await vm.load();
        resolveOld([{ id: 'viejo', title: 'stale' }]);
        await first;

        expect(vm.shows.value).toEqual([show]);
    });
});
