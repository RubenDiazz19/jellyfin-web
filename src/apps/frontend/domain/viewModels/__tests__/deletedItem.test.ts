// Qué hacen las fichas cuando el item que enseñan deja de existir.
//
// El bus de mutaciones lo usan por igual editar una imagen y borrar el item, y
// la ficha reaccionaba a las dos recargando. Con un borrado eso es pedir algo
// que ya no está: el servidor contesta 404 y el usuario veía un error rojo
// justo después de un borrado que había ido bien.

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

import { emitItemDeleted, emitItemMutated } from '../../../data/api/mutations';
import { MovieViewModel } from '../MovieViewModel';
import { ShowViewModel } from '../ShowViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { Movie, Show } from '../../../data/models';

const movie = { id: 'm1', title: 'Obsesión' } as Movie;
const show = {
    id: 's1',
    title: 'Kabaneri',
    seasons: [{ n: 1, jfId: 'season-jf', episodes: [{ n: 1, jfId: 'ep-jf' }] }]
} as Show;

function movieVm() {
    const getMovie = vi.fn(() => Promise.resolve(movie));
    const api = { catalog: { getMovie } } as unknown as ApiService;
    return { vm: new MovieViewModel(api), getMovie };
}

function showVm() {
    const getShow = vi.fn(() => Promise.resolve(show));
    const api = { catalog: { getShow } } as unknown as ApiService;
    return { vm: new ShowViewModel(api), getShow };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('película borrada', () => {
    test('no se vuelve a pedir al servidor (era el 404)', async () => {
        const { vm, getMovie } = movieVm();
        await vm.load('m1');
        getMovie.mockClear();

        emitItemDeleted('m1');
        await Promise.resolve();

        expect(getMovie).not.toHaveBeenCalled();
        expect(vm.movie.value).toBeNull();
        expect(vm.error.value).toBeNull();
        expect(vm.gone.value).toBe('m1');
    });

    test('una edición normal sí la recarga', async () => {
        const { vm, getMovie } = movieVm();
        await vm.load('m1');
        getMovie.mockClear();

        emitItemMutated('m1');
        await Promise.resolve();

        expect(getMovie).toHaveBeenCalled();
        expect(vm.gone.value).toBeNull();
    });

    test('borrar otra película no toca esta ficha', async () => {
        const { vm, getMovie } = movieVm();
        await vm.load('m1');
        getMovie.mockClear();

        emitItemDeleted('otra');
        await Promise.resolve();

        expect(vm.movie.value).toEqual(movie);
        expect(vm.gone.value).toBeNull();
    });

    test('abrir otra película después deja de considerarla borrada', async () => {
        const { vm } = movieVm();
        await vm.load('m1');
        emitItemDeleted('m1');
        await Promise.resolve();
        expect(vm.gone.value).toBe('m1');

        await vm.load('m1', true);
        expect(vm.gone.value).toBeNull();
    });
});

describe('serie borrada', () => {
    test('la serie entera: no se recarga y las fichas de dentro se enteran', async () => {
        const { vm, getShow } = showVm();
        await vm.load('s1');
        getShow.mockClear();

        emitItemDeleted('s1');
        await Promise.resolve();

        expect(getShow).not.toHaveBeenCalled();
        expect(vm.show.value).toBeNull();
        expect(vm.gone.value).toBe('s1');
    });

    test('borrar una temporada SÍ recarga: la serie sigue existiendo', async () => {
        const { vm, getShow } = showVm();
        await vm.load('s1');
        getShow.mockClear();

        emitItemDeleted('season-jf');
        await Promise.resolve();

        expect(getShow).toHaveBeenCalledWith('s1');
        // La serie no ha desaparecido, así que su ficha no debe irse.
        expect(vm.gone.value).toBeNull();
    });

    test('borrar un episodio, igual', async () => {
        const { vm, getShow } = showVm();
        await vm.load('s1');
        getShow.mockClear();

        emitItemDeleted('ep-jf');
        await Promise.resolve();

        expect(getShow).toHaveBeenCalledWith('s1');
        expect(vm.gone.value).toBeNull();
    });
});
