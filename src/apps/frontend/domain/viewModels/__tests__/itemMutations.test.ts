// Agrupado de mutaciones: una acción del usuario emite muchas —marcar una
// temporada como vista es un evento POR EPISODIO— y quien recarga la
// biblioteca entera no puede hacerlo una vez por evento.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// El bus de mutaciones arrastra la sesión y con ella el cliente oficial, que
// aquí no pinta nada. Mismo corte que en deletedItem.test.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { ITEM_MUTATED_EVENT } from '../../../data/api/mutations';
import { ItemMutationSubscription, MUTATION_DEBOUNCE_MS } from '../itemMutations';

function mutate(itemId?: string) {
    window.dispatchEvent(new CustomEvent(ITEM_MUTATED_EVENT, { detail: { itemId } }));
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('ItemMutationSubscription', () => {
    // Las fichas deciden según el itemId: perderse una mutación sería no
    // enterarse de que el item que enseñan ha cambiado.
    test('sin debounce llega una llamada por evento', () => {
        const onMutated = vi.fn();
        new ItemMutationSubscription().ensure(onMutated);

        mutate('a');
        mutate('b');

        expect(onMutated).toHaveBeenCalledTimes(2);
    });

    test('con debounce un lote de mutaciones es una sola llamada', () => {
        const onMutated = vi.fn();
        new ItemMutationSubscription().ensure(onMutated, MUTATION_DEBOUNCE_MS);

        for (const id of ['e1', 'e2', 'e3', 'e4', 'e5']) mutate(id);
        expect(onMutated).not.toHaveBeenCalled();

        vi.advanceTimersByTime(MUTATION_DEBOUNCE_MS);
        expect(onMutated).toHaveBeenCalledTimes(1);
        expect(onMutated).toHaveBeenCalledWith({ itemId: 'e5' });
    });

    test('dos lotes separados en el tiempo son dos llamadas', () => {
        const onMutated = vi.fn();
        new ItemMutationSubscription().ensure(onMutated, MUTATION_DEBOUNCE_MS);

        mutate('a');
        vi.advanceTimersByTime(MUTATION_DEBOUNCE_MS);
        mutate('b');
        vi.advanceTimersByTime(MUTATION_DEBOUNCE_MS);

        expect(onMutated).toHaveBeenCalledTimes(2);
    });

    test('ensure solo engancha una vez', () => {
        const first = vi.fn();
        const second = vi.fn();
        const subscription = new ItemMutationSubscription();
        subscription.ensure(first);
        subscription.ensure(second);

        mutate('a');

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });
});
