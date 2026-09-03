// Selección en lote: qué se marca, y sobre todo que un fallo del servidor
// deje el estado local como estaba (el store se pinta al instante).

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

import { SelectionViewModel, watchedKey, type SelectableItem } from '../SelectionViewModel';
import { WATCHED } from '../../../data/stores/watchedStore';
import { QUEUE } from '../../../data/stores/queueStore';
import type { ApiService } from '../../../data/api/ApiService';

const movie: SelectableItem = { id: 'm1', title: 'Peli', kind: 'movie', year: 2020 };
const show: SelectableItem = { id: 's1', title: 'Serie', kind: 'show' };

function makeVm(overrides: {
    markPlayed?: ReturnType<typeof vi.fn>;
    setItemsTags?: ReturnType<typeof vi.fn>;
} = {}) {
    const api = {
        items: { markPlayed: overrides.markPlayed ?? vi.fn(() => Promise.resolve()) },
        metadata: { setItemsTags: overrides.setItemsTags ?? vi.fn(() => Promise.resolve()) }
    } as unknown as ApiService;
    return new SelectionViewModel(api);
}

beforeEach(() => {
    localStorage.clear();
    WATCHED.setMany([watchedKey(movie), watchedKey(show)], false);
    QUEUE.clear();
});

describe('watchedKey', () => {
    test('las películas van prefijadas y las series no', () => {
        expect(watchedKey(movie)).toBe('movie-m1');
        expect(watchedKey(show)).toBe('s1');
    });

    test('usa watchedKey explícito si está presente', () => {
        const ep: SelectableItem = {
            id: 'ep1',
            title: 'Episodio 1',
            kind: 'episode',
            watchedKey: 'show-s1-e1'
        };
        expect(watchedKey(ep)).toBe('show-s1-e1');
    });
});

describe('selección', () => {
    test('toggle añade y quita', () => {
        const vm = makeVm();
        vm.toggle(movie);
        expect(vm.has('m1')).toBe(true);
        vm.toggle(movie);
        expect(vm.has('m1')).toBe(false);
    });

    test('start con un item entra en modo selección ya marcado', () => {
        const vm = makeVm();
        vm.start(movie);
        expect(vm.selecting.value).toBe(true);
        expect(vm.count.value).toBe(1);
    });

    test('stop sale del modo y olvida lo marcado', () => {
        const vm = makeVm();
        vm.start(movie);
        vm.stop();
        expect(vm.selecting.value).toBe(false);
        expect(vm.empty.value).toBe(true);
    });

    test('selectAll reemplaza la selección', () => {
        const vm = makeVm();
        vm.toggle(movie);
        vm.selectAll([movie, show]);
        expect(vm.count.value).toBe(2);
    });

    test('setVisibleItems actualiza los items visibles', () => {
        const vm = makeVm();
        expect(vm.visibleItems.value).toEqual([]);
        vm.setVisibleItems([movie, show]);
        expect(vm.visibleItems.value).toEqual([movie, show]);
    });
});

describe('marcar como visto en lote', () => {
    test('actualiza el store y llama al servidor por cada item', async () => {
        const markPlayed = vi.fn(() => Promise.resolve());
        const vm = makeVm({ markPlayed });
        vm.selectAll([movie, show]);

        await vm.markWatched(true);

        expect(markPlayed).toHaveBeenCalledTimes(2);
        expect(WATCHED.has('movie-m1')).toBe(true);
        expect(WATCHED.has('s1')).toBe(true);
    });

    test('si el servidor falla, el store vuelve a como estaba', async () => {
        const markPlayed = vi.fn(() => Promise.reject(new Error('403')));
        const vm = makeVm({ markPlayed });
        vm.selectAll([movie]);

        await expect(vm.markWatched(true)).rejects.toThrow('403');

        expect(WATCHED.has('movie-m1')).toBe(false);
        expect(vm.busy.value).toBe(false);
    });

    test('al revertir, lo que ya estaba visto sigue visto', async () => {
        // El fallo que esto fija: revertir poniendo TODO a `!watched` dejaba
        // sin marcar lo que ya venía marcado desde antes del lote.
        WATCHED.setMany([watchedKey(show)], true);
        const markPlayed = vi.fn(() => Promise.reject(new Error('403')));
        const vm = makeVm({ markPlayed });
        vm.selectAll([movie, show]);

        await expect(vm.markWatched(true)).rejects.toThrow('403');

        expect(WATCHED.has('movie-m1')).toBe(false);
        expect(WATCHED.has('s1')).toBe(true);
    });

    test('sin selección no toca el servidor', async () => {
        const markPlayed = vi.fn(() => Promise.resolve());
        const vm = makeVm({ markPlayed });
        await vm.markWatched(true);
        expect(markPlayed).not.toHaveBeenCalled();
    });
});

describe('encolar en lote', () => {
    test('encola todo lo seleccionado y devuelve cuántos', () => {
        const vm = makeVm();
        vm.selectAll([movie, show]);
        expect(vm.enqueue()).toBe(2);
        expect(QUEUE.all().map((e) => e.itemId)).toEqual(['m1', 's1']);
    });

    test('el año va como subtítulo de la entrada', () => {
        const vm = makeVm();
        vm.selectAll([movie]);
        vm.enqueue();
        expect(QUEUE.all()[0].subtitle).toBe('2020');
    });
});

describe('etiquetar en lote', () => {
    test('manda todos los ids en una sola llamada', async () => {
        const setItemsTags = vi.fn(() => Promise.resolve());
        const vm = makeVm({ setItemsTags });
        vm.selectAll([movie, show]);

        expect(await vm.addTags(['nueva'])).toBe(2);
        expect(setItemsTags).toHaveBeenCalledWith(['m1', 's1'], ['nueva']);
    });

    test('sin etiquetas no llama al servidor', async () => {
        const setItemsTags = vi.fn(() => Promise.resolve());
        const vm = makeVm({ setItemsTags });
        vm.selectAll([movie]);
        expect(await vm.addTags([])).toBe(0);
        expect(setItemsTags).not.toHaveBeenCalled();
    });
});
