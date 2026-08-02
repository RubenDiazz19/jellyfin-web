// El panel de «lo que está pasando» junta dos fuentes que el servidor publica
// por separado: la lista completa de tareas programadas y el progreso suelto de
// cada item que se refresca. Lo que se prueba aquí es esa fusión y, sobre todo,
// que nada se quede encallado en la lista: una barra parada al 40 % dice que
// algo se ha colgado, y eso es peor que no enseñar nada.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { TasksViewModel } from '../TasksViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { BackgroundTask } from '../../../data/api/tasks';

/** VM con las dos fuentes bajo control del test. */
function makeVm(initial: BackgroundTask[] = []) {
    let pushTasks: (t: BackgroundTask[]) => void = () => {};
    let pushProgress: (itemId: string, percent: number) => void = () => {};
    const api = {
        tasks: {
            getRunningTasks: vi.fn(() => Promise.resolve(initial)),
            watchScheduledTasks: (cb: typeof pushTasks) => { pushTasks = cb; return () => {}; },
            watchItemRefresh: (cb: typeof pushProgress) => { pushProgress = cb; return () => {}; }
        }
    } as unknown as ApiService;
    const vm = new TasksViewModel(api);
    vm.start();
    return {
        vm,
        pushTasks: (t: BackgroundTask[]) => pushTasks(t),
        pushProgress: (id: string, pct: number) => pushProgress(id, pct)
    };
}

const names = (vm: TasksViewModel) => vm.active.value.map((t) => t.name);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('tareas programadas', () => {
    test('lo que ya estaba corriendo se ve desde el primer momento', async () => {
        const { vm } = makeVm([{ id: 't1', name: 'Escanear biblioteca', progress: 12 }]);
        await vi.runAllTimersAsync();
        expect(names(vm)).toEqual(['Escanear biblioteca']);
    });

    test('cada empuje reemplaza la lista entera', () => {
        const { vm, pushTasks } = makeVm();
        pushTasks([{ id: 't1', name: 'Escanear', progress: 10 }]);
        expect(names(vm)).toEqual(['Escanear']);

        // El servidor manda siempre todas: la que ya no venga ha terminado.
        pushTasks([{ id: 't2', name: 'Miniaturas', progress: 3 }]);
        expect(names(vm)).toEqual(['Miniaturas']);
    });

    test('sin tareas, la lista queda vacía y el panel no se pinta', () => {
        const { vm, pushTasks } = makeVm();
        pushTasks([{ id: 't1', name: 'Escanear', progress: 10 }]);
        pushTasks([]);
        expect(vm.active.value).toEqual([]);
    });
});

describe('refresco de un item', () => {
    test('aparece nada más pedirlo, sin porcentaje todavía', () => {
        const { vm } = makeVm();
        vm.expect('lib1', 'Películas');
        expect(vm.active.value).toEqual([{ id: 'lib1', name: 'Películas', progress: null }]);
    });

    test('el progreso del servidor lo actualiza sin perder el nombre', () => {
        const { vm, pushProgress } = makeVm();
        vm.expect('lib1', 'Películas');
        pushProgress('lib1', 42);
        expect(vm.active.value).toEqual([{ id: 'lib1', name: 'Películas', progress: 42 }]);
    });

    test('al llegar al 100 % desaparece', () => {
        const { vm, pushProgress } = makeVm();
        vm.expect('lib1', 'Películas');
        pushProgress('lib1', 80);
        pushProgress('lib1', 100);
        expect(vm.active.value).toEqual([]);
    });

    test('un refresco lanzado desde otro sitio también se ve', () => {
        // Otro cliente, o el propio servidor: no hay nombre, pero sí progreso.
        const { vm, pushProgress } = makeVm();
        pushProgress('ajeno', 30);
        expect(vm.active.value).toEqual([{ id: 'ajeno', name: '', progress: 30 }]);
    });

    test('no duplica: el mismo item es una sola fila', () => {
        const { vm, pushProgress } = makeVm();
        vm.expect('lib1', 'Películas');
        pushProgress('lib1', 10);
        pushProgress('lib1', 20);
        expect(vm.active.value).toHaveLength(1);
    });

    test('uno que deja de dar señales se retira solo', () => {
        // El servidor no siempre manda el 100: si el item no necesitaba nada,
        // termina sin publicarlo y la fila se quedaría ahí para siempre.
        const { vm, pushProgress } = makeVm();
        vm.expect('lib1', 'Películas');
        pushProgress('lib1', 40);

        vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        expect(vm.active.value).toEqual([]);
    });

    test('mientras siga informando no se retira', () => {
        const { vm, pushProgress } = makeVm();
        vm.expect('lib1', 'Películas');
        for (let i = 0; i < 6; i++) {
            vi.advanceTimersByTime(4 * 60 * 1000);
            pushProgress('lib1', 10 * i);
        }
        expect(vm.active.value).toHaveLength(1);
    });
});

describe('las dos fuentes juntas', () => {
    test('se pintan en la misma lista', () => {
        const { vm, pushTasks } = makeVm();
        pushTasks([{ id: 't1', name: 'Escanear todo', progress: 5 }]);
        vm.expect('lib1', 'Películas');
        expect(names(vm)).toEqual(['Escanear todo', 'Películas']);
    });

    test('que termine una no se lleva a la otra por delante', () => {
        const { vm, pushTasks, pushProgress } = makeVm();
        pushTasks([{ id: 't1', name: 'Escanear todo', progress: 5 }]);
        vm.expect('lib1', 'Películas');

        pushTasks([]);
        expect(names(vm)).toEqual(['Películas']);

        pushProgress('lib1', 100);
        expect(vm.active.value).toEqual([]);
    });
});
