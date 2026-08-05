// Cola de reproducción: orden, reordenado y persistencia.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { QUEUE, type QueueEntry } from '../../../data/stores/queueStore';
import { flushPersistentStores } from '../../../data/stores/persistentStore';
import { QueueViewModel } from '../QueueViewModel';

const A: QueueEntry = { itemId: 'a', title: 'Alfa' };
const B: QueueEntry = { itemId: 'b', title: 'Bravo' };
const C: QueueEntry = { itemId: 'c', title: 'Charlie' };

function ids(vm: QueueViewModel): string[] {
    return vm.items.value.map((e) => e.itemId);
}

describe('QueueViewModel', () => {
    let vm: QueueViewModel;
    let stop: () => void;

    beforeEach(() => {
        localStorage.clear();
        QUEUE.clear();
        vm = new QueueViewModel();
        stop = vm.start();
        return () => stop();
    });

    test('enqueue añade al final y playNext a la cabeza', () => {
        vm.enqueue(A);
        vm.enqueue(B);
        expect(ids(vm)).toEqual(['a', 'b']);

        vm.playNext(C);
        expect(ids(vm)).toEqual(['c', 'a', 'b']);
    });

    test('reencolar un item que ya está no lo duplica: lo mueve', () => {
        vm.enqueue(A);
        vm.enqueue(B);
        vm.enqueue(A);
        expect(ids(vm)).toEqual(['b', 'a']);

        vm.playNext(B);
        expect(ids(vm)).toEqual(['b', 'a']);
    });

    test('moveUp / moveDown reordenan y no se salen por los extremos', () => {
        vm.enqueue(A);
        vm.enqueue(B);
        vm.enqueue(C);

        vm.moveDown('a');
        expect(ids(vm)).toEqual(['b', 'a', 'c']);

        vm.moveUp('c');
        expect(ids(vm)).toEqual(['b', 'c', 'a']);

        // La primera no sube y la última no baja.
        vm.moveUp('b');
        vm.moveDown('a');
        expect(ids(vm)).toEqual(['b', 'c', 'a']);
    });

    test('moveUp de un item que no está en la cola no la altera', () => {
        vm.enqueue(A);
        vm.moveUp('zzz');
        expect(ids(vm)).toEqual(['a']);
    });

    test('takeNext saca la primera entrada', () => {
        vm.enqueue(A);
        vm.enqueue(B);

        expect(vm.takeNext()).toEqual(A);
        expect(ids(vm)).toEqual(['b']);
        expect(vm.takeNext()).toEqual(B);
        expect(vm.takeNext()).toBeNull();
    });

    test('takeFor saca una entrada concreta y deja el resto en su sitio', () => {
        vm.enqueue(A);
        vm.enqueue(B);
        vm.enqueue(C);

        expect(vm.takeFor('c')).toEqual(C);
        expect(ids(vm)).toEqual(['a', 'b']);
        expect(vm.takeFor('zzz')).toBeNull();
    });

    test('remove y clear', () => {
        vm.enqueue(A);
        vm.enqueue(B);
        vm.remove('a');
        expect(ids(vm)).toEqual(['b']);
        vm.clear();
        expect(ids(vm)).toEqual([]);
    });

    test('la cola sobrevive a un reinicio (localStorage)', () => {
        vm.enqueue(A);
        vm.enqueue(B);
        stop();

        // Simula una recarga: nuevo VM leyendo el store persistido.
        const fresh = new QueueViewModel();
        const stopFresh = fresh.start();
        expect(ids(fresh)).toEqual(['a', 'b']);
        stopFresh();
    });

    test('se sincroniza con cambios hechos fuera del ViewModel', () => {
        vm.enqueue(A);
        // Otro punto de la app encola directamente contra el store.
        QUEUE.enqueue(B);
        expect(ids(vm)).toEqual(['a', 'b']);
    });

    test('start() deja de escuchar al hacer cleanup', () => {
        vm.enqueue(A);
        stop();
        QUEUE.enqueue(B);
        expect(ids(vm)).toEqual(['a']);
    });

    // El store cachea en memoria, así que la lectura del storage solo ocurre
    // en frío: hay que recargar el módulo para ejercitar el parseo.
    test('ignora entradas corruptas del storage', async () => {
        // Las escrituras del store van por lotes: si quedara alguna en cola,
        // caería ENCIMA del valor que se siembra a mano justo debajo.
        flushPersistentStores();
        localStorage.setItem(
            'jfp-queue',
            JSON.stringify([{ itemId: 'ok', title: 'T' }, { nope: 1 }, null, 'suelta'])
        );
        vi.resetModules();
        const { QueueViewModel: Fresh } = await import('../QueueViewModel');

        const fresh = new Fresh();
        const stopFresh = fresh.start();
        expect(fresh.items.value.map((e) => e.itemId)).toEqual(['ok']);
        stopFresh();
    });

    test('un storage con JSON inválido arranca vacío', async () => {
        localStorage.setItem('jfp-queue', '{no es json');
        vi.resetModules();
        const { QueueViewModel: Fresh } = await import('../QueueViewModel');

        const fresh = new Fresh();
        const stopFresh = fresh.start();
        expect(fresh.items.value).toEqual([]);
        stopFresh();
    });
});
