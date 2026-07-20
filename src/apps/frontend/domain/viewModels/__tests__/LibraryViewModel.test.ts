import { describe, expect, test, vi } from 'vitest';
import { LibraryViewModel } from '../LibraryViewModel';
import type { ApiService } from '../../../data/api/ApiService';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const show = { id: 'sh1', title: 'Dandelion' };
const movie = { id: 'm1', title: 'Obsesión' };

function mockApi(opts: { authed?: boolean; moviesFail?: boolean } = {}): ApiService {
    return {
        session: {
            load: () => (opts.authed === false ? null : { accessToken: 'tok' })
        },
        catalog: {
            getShows: vi.fn(() => Promise.resolve([show])),
            getMovies: vi.fn(() =>
                opts.moviesFail ?
                    Promise.reject(new Error('petó')) :
                    Promise.resolve([movie]))
        }
    } as unknown as ApiService;
}

describe('LibraryViewModel', () => {
    test('load(movies) con sesión usa la API real', async () => {
        const api = mockApi();
        const vm = new LibraryViewModel(api);
        await vm.load('movies');
        expect(api.catalog.getMovies).toHaveBeenCalled();
        expect(vm.movies.value).toEqual([movie]);
        expect(vm.loading.value).toBe(false);
        expect(vm.error.value).toBeNull();
    });

    test('load(series) con sesión usa la API real', async () => {
        const vm = new LibraryViewModel(mockApi());
        await vm.load('series');
        expect(vm.shows.value).toEqual([show]);
    });

    test('sin sesión cae al catálogo proto (vacío) sin llamar a la API', async () => {
        const api = mockApi({ authed: false });
        const vm = new LibraryViewModel(api);
        await vm.load('movies');
        expect(api.catalog.getMovies).not.toHaveBeenCalled();
        expect(vm.loading.value).toBe(false);
    });

    test('un fallo de películas expone el error', async () => {
        const vm = new LibraryViewModel(mockApi({ moviesFail: true }));
        await vm.load('movies');
        expect(vm.error.value).toBe('petó');
        expect(vm.loading.value).toBe(false);
    });

    test('una carga antigua no pisa a la más reciente', async () => {
        let resolveOld!: (v: unknown) => void;
        const api = mockApi();
        const getMovies = api.catalog.getMovies as ReturnType<typeof vi.fn>;
        getMovies
            .mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }))
            .mockImplementationOnce(() => Promise.resolve([movie]));

        const vm = new LibraryViewModel(api);
        const first = vm.load('movies');
        await vm.load('movies');
        resolveOld([{ id: 'viejo' }]);
        await first;
        expect(vm.movies.value).toEqual([movie]);
    });
});
