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
    private handler: ((e: Event) => void) | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Engancha `onMutated` la primera vez que se llama; las siguientes no
     * hacen nada. El `itemId` del detalle llega `undefined` cuando la mutación
     * es de alcance desconocido (limpieza masiva de caché, refresh de
     * biblioteca…), y `deleted` marca las que no se pueden recargar.
     *
     * Con `debounceMs` solo llega la ÚLTIMA mutación del lote, así que es para
     * quien recarga todo y no mira el detalle (los listados). Una ficha, que
     * decide según el `itemId`, tiene que enterarse de todas.
     */
    ensure(onMutated: (detail: ItemMutatedDetail) => void, debounceMs = 0): void {
        if (this.handler || typeof window === 'undefined') return;
        this.handler = (e: Event) => {
            const detail = (e as CustomEvent<ItemMutatedDetail>).detail ?? {};
            if (!debounceMs) {
                onMutated(detail);
                return;
            }
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.timer = null;
                onMutated(detail);
            }, debounceMs);
        };
        window.addEventListener(ITEM_MUTATED_EVENT, this.handler);
    }
}

/** Helper para suscribir un ViewModel a mutaciones de items con o sin debounce. */
export function subscribeToMutations(
    subscription: ItemMutationSubscription,
    onMutated: (detail: ItemMutatedDetail) => void,
    debounceMs = 0
): void {
    subscription.ensure(onMutated, debounceMs);
}

