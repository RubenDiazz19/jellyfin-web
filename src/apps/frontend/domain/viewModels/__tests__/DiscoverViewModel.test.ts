// El ViewModel compartido por género, persona y «más como esto».
//
// Lo que importa aquí es que no se enseñe el recorte de otro sujeto: estas
// tres pantallas se encadenan (de una ficha a un género, de ahí a un actor) y
// una respuesta lenta que llega tarde pintaría la filmografía equivocada bajo
// el nombre nuevo.

import { describe, expect, test, vi } from 'vitest';
import { DiscoverViewModel } from '../DiscoverViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { Movie, Show } from '../../../data/models';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const api = {} as ApiService;

const show = (id: string) => ({ id, title: `Serie ${id}` }) as Show;
const movie = (id: string) => ({ id, title: `Peli ${id}` }) as Movie;

/** Un VM cuya consulta devuelve una serie y una película con el sujeto dentro. */
function stubVM() {
    const query = vi.fn((_api: ApiService, subject: string) =>
        Promise.resolve({ shows: [show(`s-${subject}`)], movies: [movie(`m-${subject}`)] }));
    return { vm: new DiscoverViewModel(api, query), query };
}

describe('DiscoverViewModel', () => {
    test('carga el recorte del sujeto', async () => {
        const { vm, query } = stubVM();
        await vm.load('Terror');
        expect(query).toHaveBeenCalledWith(api, 'Terror');
        expect(vm.shows.value).toEqual([show('s-Terror')]);
        expect(vm.movies.value).toEqual([movie('m-Terror')]);
        expect(vm.loading.value).toBe(false);
        expect(vm.error.value).toBeNull();
    });

    test('cambiar de sujeto vacía lo anterior antes de pedir', async () => {
        const { vm } = stubVM();
        await vm.load('Terror');

        const pending = vm.load('Comedia');
        // Todavía no ha contestado nadie: no puede quedar nada de Terror.
        expect(vm.shows.value).toEqual([]);
        expect(vm.movies.value).toEqual([]);
        expect(vm.loading.value).toBe(true);

        await pending;
        expect(vm.shows.value).toEqual([show('s-Comedia')]);
    });

    test('recargar el mismo sujeto no parpadea', async () => {
        const { vm } = stubVM();
        await vm.load('Terror');
        const pending = vm.load('Terror');
        expect(vm.shows.value).toEqual([show('s-Terror')]);
        await pending;
    });

    test('la respuesta lenta de un sujeto abandonado no pisa a la nueva', async () => {
        const slow: Record<string, (v: { shows: Show[]; movies: Movie[] }) => void> = {};
        const query = vi.fn((_api: ApiService, subject: string) =>
            new Promise<{ shows: Show[]; movies: Movie[] }>((resolve) => {
                slow[subject] = resolve;
            }));
        const vm = new DiscoverViewModel(api, query);

        const first = vm.load('ana');
        const second = vm.load('berta');
        slow.berta({ shows: [show('s-berta')], movies: [] });
        await second;
        slow.ana({ shows: [show('s-ana')], movies: [] });
        await first;

        expect(vm.shows.value).toEqual([show('s-berta')]);
        expect(vm.loading.value).toBe(false);
    });

    test('un fallo del servidor deja el error y ningún resultado', async () => {
        const vm = new DiscoverViewModel(api, () => Promise.reject(new Error('HTTP 500')));
        await vm.load('Terror');
        expect(vm.error.value).toBe('HTTP 500');
        expect(vm.shows.value).toEqual([]);
        expect(vm.loading.value).toBe(false);
    });
});
