// Suscripción de un ViewModel al bus de mutaciones de items.
//
// Se engancha en el primer `load()` y no en el constructor: los ViewModels son
// singletons de módulo, así que suscribir al construirlos dejaba un listener
// global colgado por el mero hecho de importar el fichero — y si `window` no
// existía en ese momento (SSR, tests), no había segunda oportunidad. Hasta que
// hay datos el handler no haría nada de todos modos.
//
// No hay `dispose()`: el listener dura lo que el singleton, que dura lo que el
// documento. Desengancharlo no tendría a quién beneficiar.

import { ITEM_MUTATED_EVENT, type ItemMutatedDetail } from '../../data/api/mutations';

/**
 * Espera para agrupar mutaciones seguidas. Una sola acción del usuario emite
 * muchas: marcar una temporada como vista es una mutación POR EPISODIO, y sin
 * agrupar cada una disparaba una recarga completa de la biblioteca. Del mismo
 * orden que el debounce de la búsqueda: lo justo para que un lote se
 * reconozca como uno solo sin que se note la espera.
 */
export const MUTATION_DEBOUNCE_MS = 250;

export class ItemMutationSubscription {
    private subscriber: (() => void) | null = null;

    ensure(onMutated: (detail: ItemMutatedDetail) => void, debounceMs = 0): void {
        if (!this.subscriber) {
            let handler: ((e: Event) => void) | null = null;
            let timer: ReturnType<typeof setTimeout> | null = null;
            this.subscriber = () => {
                if (handler || typeof window === 'undefined') return;
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
        this.subscriber();
    }
}
