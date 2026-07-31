// Orden de la biblioteca: cada criterio, el desempate por título y que el
// orden aleatorio sea estable entre lecturas (si no, la rejilla se
// reordenaría sola en cada re-render).

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { LibraryViewModel } from '../LibraryViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { Movie } from '../../../data/models';

function movie(id: string, title: string, extra: Partial<Movie> = {}): Movie {
    return {
        id, title, year: 2000, runtime: '100 min',
        rating: { imdb: 5, rt: 0, age: '' }, genres: [],
        ...extra
    } as Movie;
}

function makeVm(movies: Movie[]) {
    const api = { session: { load: () => null }, catalog: {} } as unknown as ApiService;
    const vm = new LibraryViewModel(api);
    vm.movies.value = movies;
    return vm;
}

const titles = (vm: LibraryViewModel) => vm.sortedMovies.value.map((m) => m.title);

beforeEach(() => localStorage.clear());

describe('orden de la biblioteca', () => {
    test('por título, con collator (acentos y números naturales)', () => {
        const vm = makeVm([movie('1', 'Ñandú'), movie('2', 'Ángel'), movie('3', 'Zeta')]);
        vm.setSort('title');
        expect(titles(vm)).toEqual(['Ángel', 'Ñandú', 'Zeta']);
    });

    test('«Capítulo 2» va antes que «Capítulo 10»', () => {
        const vm = makeVm([movie('1', 'Capítulo 10'), movie('2', 'Capítulo 2')]);
        vm.setSort('title');
        expect(titles(vm)).toEqual(['Capítulo 2', 'Capítulo 10']);
    });

    test('por año, lo más nuevo primero', () => {
        const vm = makeVm([
            movie('1', 'Vieja', { year: 1990 }),
            movie('2', 'Nueva', { year: 2020 })
        ]);
        vm.setSort('year');
        expect(titles(vm)).toEqual(['Nueva', 'Vieja']);
    });

    test('por puntuación, la mejor primero', () => {
        const vm = makeVm([
            movie('1', 'Mala', { rating: { imdb: 3, rt: 0, age: '' } }),
            movie('2', 'Buena', { rating: { imdb: 9, rt: 0, age: '' } })
        ]);
        vm.setSort('rating');
        expect(titles(vm)).toEqual(['Buena', 'Mala']);
    });

    test('por duración, la más corta primero (el runtime es texto)', () => {
        const vm = makeVm([
            movie('1', 'Larga', { runtime: '180 min' }),
            movie('2', 'Corta', { runtime: '90 min' }),
            movie('3', 'Sin dato', { runtime: '—' })
        ]);
        vm.setSort('runtime');
        expect(titles(vm)).toEqual(['Sin dato', 'Corta', 'Larga']);
    });

    test('empates de año se rompen por título', () => {
        const vm = makeVm([
            movie('1', 'Beta', { year: 2000 }),
            movie('2', 'Alfa', { year: 2000 })
        ]);
        vm.setSort('year');
        expect(titles(vm)).toEqual(['Alfa', 'Beta']);
    });

    test('no muta la lista original', () => {
        const vm = makeVm([movie('1', 'Zeta'), movie('2', 'Alfa')]);
        vm.setSort('title');
        void vm.sortedMovies.value;
        expect(vm.movies.value.map((m) => m.title)).toEqual(['Zeta', 'Alfa']);
    });
});

describe('orden aleatorio', () => {
    const many = () => makeVm(
        Array.from({ length: 12 }, (_, i) => movie(String(i), `M${i}`))
    );

    test('es estable entre lecturas: no se rebaraja en cada render', () => {
        const vm = many();
        vm.setSort('random');
        expect(titles(vm)).toEqual(titles(vm));
    });

    test('volver a elegir aleatorio rebaraja', () => {
        const vm = many();
        vm.setSort('random');
        const first = titles(vm);
        vm.setSort('random');
        expect(titles(vm)).not.toEqual(first);
    });

    test('mantiene todos los elementos', () => {
        const vm = many();
        vm.setSort('random');
        expect(titles(vm).sort()).toEqual(vm.movies.value.map((m) => m.title).sort());
    });
});

describe('persistencia', () => {
    test('el criterio sobrevive a una instancia nueva', () => {
        makeVm([]).setSort('year');
        expect(makeVm([]).sortKey.value).toBe('year');
    });

    test('un valor corrupto en storage cae al orden por defecto', () => {
        localStorage.setItem('jfp-library-sort', 'basura');
        expect(makeVm([]).sortKey.value).toBe('title');
    });
});
