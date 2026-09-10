// Suscripción declarativa a mutaciones de items para ViewModels.
// Regla MVVM: este módulo no importa React ni nada de presentation/.

import { ITEM_MUTATED_EVENT, type ItemMutatedDetail } from '../../data/api/mutations';
import { MUTATION_DEBOUNCE_MS } from './itemMutations';

export type MutationOnLoadOptions = {
    debounce?: boolean | number;
};

/**
 * Crea una suscripción diferida a mutaciones que se activa al llamar a la función devuelta.
 * Simplifica la suscripción a mutaciones eliminando capas intermedias innecesarias.
 */
export function mutationOnLoad(
    onMutated: (detail: ItemMutatedDetail) => void,
    opts?: MutationOnLoadOptions
): () => void {
    let handler: ((e: Event) => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    return () => {
        if (handler || typeof window === 'undefined') return;
        const debounceMs = typeof opts?.debounce === 'number' ?
            opts.debounce :
            (opts?.debounce ? MUTATION_DEBOUNCE_MS : 0);

        handler = (e: Event) => {
            const detail = (e as CustomEvent<ItemMutatedDetail>).detail ?? {};
            if (!debounceMs) {
                onMutated(detail);
                return;
            }
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                onMutated(detail);
            }, debounceMs);
        };
        window.addEventListener(ITEM_MUTATED_EVENT, handler);
    };
}

