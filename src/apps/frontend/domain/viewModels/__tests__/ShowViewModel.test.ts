import { describe, expect, test, vi } from 'vitest';
import { ShowViewModel } from '../ShowViewModel';
import type { ApiService } from '../../../data/api/ApiService';

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const show = { id: 'sh1', title: 'Dandelion', seasons: [] };

function mockApi(getShow = vi.fn(() => Promise.resolve(show))): ApiService {
    return { catalog: { getShow } } as unknown as ApiService;
}

describe('ShowViewModel', () => {
    test('load() carga la serie y showFor() la filtra por id', async () => {
        const vm = new ShowViewModel(mockApi());
        await vm.load('sh1');

        expect(vm.show.value).toEqual(show);
        expect(vm.loading.value).toBe(false);
        expect(vm.showFor('sh1')).toEqual(show);
        expect(vm.showFor('otra')).toBeNull();
    });

    test('load() del mismo id refresca en segundo plano sin perder datos', async () => {
        const updated = { ...show, title: 'Dandelion (refrescado)' };
        const getShow = vi.fn()
            .mockResolvedValueOnce(show)
            .mockResolvedValueOnce(updated);
        const vm = new ShowViewModel(mockApi(getShow));
        await vm.load('sh1');
        expect(vm.show.value?.title).toBe('Dandelion');

        // Segunda llamada: re-fetch manteniendo el dato anterior mientras carga
        const promise = vm.load('sh1');
        expect(vm.show.value?.title).toBe('Dandelion'); // dato previo aún visible
        expect(vm.loading.value).toBe(false); // sin pantalla de carga
        await promise;
        expect(getShow).toHaveBeenCalledTimes(2);
        expect(vm.show.value?.title).toBe('Dandelion (refrescado)');
    });

    test('expone el error si la petición falla (sin datos previos)', async () => {
        const vm = new ShowViewModel(mockApi(vi.fn(() => Promise.reject(new Error('404')))));
        await vm.load('sh1');

        expect(vm.error.value).toBe('404');
        expect(vm.show.value).toBeNull();
        expect(vm.loading.value).toBe(false);
    });

    test('no sobreescribe datos previos con error del mismo id', async () => {
        const getShow = vi.fn()
            .mockResolvedValueOnce(show)
            .mockRejectedValueOnce(new Error('timeout'));
        const vm = new ShowViewModel(mockApi(getShow));
        await vm.load('sh1');
        expect(vm.show.value?.title).toBe('Dandelion');

        await vm.load('sh1');
        // El error no borra los datos previos
        expect(vm.show.value?.title).toBe('Dandelion');
        expect(vm.error.value).toBeNull();
    });

    test('cambiar de serie limpia el estado anterior', async () => {
        const other = { id: 'sh2', title: 'Otra', seasons: [] };
        const getShow = vi.fn()
            .mockResolvedValueOnce(show)
            .mockResolvedValueOnce(other);
        const vm = new ShowViewModel(mockApi(getShow));
        await vm.load('sh1');
        await vm.load('sh2');

        expect(vm.show.value).toEqual(other);
        expect(vm.showFor('sh1')).toBeNull();
    });

    describe('refresco ante mutaciones', () => {
        // El contenido de una serie (temporadas, episodios) tiene ids propios.
        // Al editar la carátula de una temporada la mutación llega con el id
        // de esa temporada, no con el de la serie: si no se reconociera como
        // propia, el cambio no se vería hasta recargar la página.
        const nested = {
            id: 'sh1',
            title: 'Dandelion',
            seasons: [
                { n: 1, jfId: 'season-1', episodes: [{ n: 1, jfId: 'ep-1' }] },
                { n: 2, jfId: 'season-2', episodes: [] }
            ]
        };

        async function loadedVm() {
            const getShow = vi.fn(() => Promise.resolve(nested));
            const vm = new ShowViewModel(mockApi(getShow));
            await vm.load('sh1');
            return { vm, getShow };
        }

        function mutate(itemId?: string) {
            window.dispatchEvent(new CustomEvent('jfp-item-mutated', { detail: { itemId } }));
        }

        test('recarga cuando muta una temporada de la serie cargada', async () => {
            const { getShow } = await loadedVm();
            mutate('season-2');
            await Promise.resolve();

            expect(getShow).toHaveBeenCalledTimes(2);
        });

        test('recarga cuando muta un episodio de la serie cargada', async () => {
            const { getShow } = await loadedVm();
            mutate('ep-1');
            await Promise.resolve();

            expect(getShow).toHaveBeenCalledTimes(2);
        });

        test('recarga cuando muta la propia serie', async () => {
            const { getShow } = await loadedVm();
            mutate('sh1');
            await Promise.resolve();

            expect(getShow).toHaveBeenCalledTimes(2);
        });

        test('ignora mutaciones de items ajenos a la serie', async () => {
            const { getShow } = await loadedVm();
            mutate('otra-cosa');
            await Promise.resolve();

            expect(getShow).toHaveBeenCalledTimes(1);
        });

        test('una mutación sin id (alcance desconocido) refresca por si acaso', async () => {
            const { getShow } = await loadedVm();
            mutate();
            await Promise.resolve();

            expect(getShow).toHaveBeenCalledTimes(2);
        });
    });
});
