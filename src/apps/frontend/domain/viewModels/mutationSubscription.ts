// Suscripción declarativa a mutaciones de items para ViewModels.
// Regla MVVM: este módulo no importa React ni nada de presentation/.

import type { ItemMutatedDetail } from '../../data/api/mutations';
import { ItemMutationSubscription, MUTATION_DEBOUNCE_MS } from './itemMutations';

export type MutationOnLoadOptions = {
    debounce?: boolean | number;
};

/**
 * Crea una suscripción diferida a mutaciones que se activa al llamar a ensureSubscribed().
 */
export function mutationOnLoad(
    onMutated: (detail: ItemMutatedDetail) => void,
    opts?: MutationOnLoadOptions
): () => void {
    let subscription: ItemMutationSubscription | null = null;
    return () => {
        if (!subscription) subscription = new ItemMutationSubscription();
        const debounceMs = typeof opts?.debounce === 'number' ?
            opts.debounce :
            (opts?.debounce ? MUTATION_DEBOUNCE_MS : 0);
        subscription.ensure(onMutated, debounceMs);
    };
}
