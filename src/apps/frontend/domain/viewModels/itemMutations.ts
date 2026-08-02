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

export class ItemMutationSubscription {
    private handler: ((e: Event) => void) | null = null;

    /**
     * Engancha `onMutated` la primera vez que se llama; las siguientes no
     * hacen nada. El `itemId` del detalle llega `undefined` cuando la mutación
     * es de alcance desconocido (limpieza masiva de caché, refresh de
     * biblioteca…), y `deleted` marca las que no se pueden recargar.
     */
    ensure(onMutated: (detail: ItemMutatedDetail) => void): void {
        if (this.handler || typeof window === 'undefined') return;
        this.handler = (e: Event) => {
            onMutated((e as CustomEvent<ItemMutatedDetail>).detail ?? {});
        };
        window.addEventListener(ITEM_MUTATED_EVENT, this.handler);
    }
}
