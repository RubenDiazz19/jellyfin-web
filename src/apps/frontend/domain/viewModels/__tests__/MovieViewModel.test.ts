import { afterEach, describe, expect, test, vi } from 'vitest';
import { MovieViewModel } from '../MovieViewModel';
import { PROTO_DATA, type Movie } from '../../../data/models';
import type { ApiService } from '../../../data/api/ApiService';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const movie = { id: 'm1', title: 'Dandelion: la película', year: 2024 } as Movie;

function mockApi(getMovie = vi.fn(() => Promise.resolve(movie))): ApiService {
    return { catalog: { getMovie } } as unknown as ApiService;
}

describe('MovieViewModel', () => {
    afterEach(() => {
        PROTO_DATA.movies = {};
    });

    test('load() trae la película de la API y movieFor() filtra por id', async () => {
        const vm = new MovieViewModel(mockApi());
        await vm.load('m1');

        expect(vm.movie.value).toEqual(movie);
        expect(vm.loading.value).toBe(false);
        expect(vm.error.value).toBeNull();
        expect(vm.movieFor('m1')).toEqual(movie);
        expect(vm.movieFor('otra')).toBeNull();
    });

    test('load() del mismo id ya cargado no repite la petición', async () => {
        const getMovie = vi.fn(() => Promise.resolve(movie));
        const vm = new MovieViewModel(mockApi(getMovie));
        await vm.load('m1');
        await vm.load('m1');

        expect(getMovie).toHaveBeenCalledTimes(1);
    });

    test('expone el error si la API falla y no hay proto data', async () => {
        const vm = new MovieViewModel(mockApi(vi.fn(() => Promise.reject(new Error('404')))));
        await vm.load('m1');

        expect(vm.error.value).toBe('404');
        expect(vm.movie.value).toBeNull();
        expect(vm.loading.value).toBe(false);
    });

    test('con proto data pinta al instante y la API la reemplaza al llegar', async () => {
        const proto = { id: 'm1', title: 'Dandelion (proto)' } as Movie;
        PROTO_DATA.movies = { m1: proto };
        const vm = new MovieViewModel(mockApi());

        const promise = vm.load('m1');
        // Síncrono, antes de resolver la API: el dato proto ya es visible.
        expect(vm.movie.value).toEqual(proto);
        expect(vm.loading.value).toBe(false);

        await promise;
        expect(vm.movie.value).toEqual(movie);
    });

    test('si la API falla pero hay proto data, la conserva sin error', async () => {
        const proto = { id: 'm1', title: 'Dandelion (proto)' } as Movie;
        PROTO_DATA.movies = { m1: proto };
        const vm = new MovieViewModel(mockApi(vi.fn(() => Promise.reject(new Error('timeout')))));
        await vm.load('m1');

        expect(vm.movie.value).toEqual(proto);
        expect(vm.error.value).toBeNull();
    });

    test('cambiar de película limpia el error anterior y carga la nueva', async () => {
        const other = { id: 'm2', title: 'Otra' } as Movie;
        const getMovie = vi.fn()
            .mockRejectedValueOnce(new Error('404'))
            .mockResolvedValueOnce(other);
        const vm = new MovieViewModel(mockApi(getMovie));
        await vm.load('m1');
        expect(vm.error.value).toBe('404');

        await vm.load('m2');
        expect(vm.error.value).toBeNull();
        expect(vm.movie.value).toEqual(other);
    });
});
