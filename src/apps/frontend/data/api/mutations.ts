// Bus de invalidación local: cualquier mutación sobre un item (imágenes,
// metadatos, favorito, played, delete…) emite este evento y los ViewModels
// que muestran ese item lo escuchan para refetchear. Sin esto, tras cambiar
// una imagen o editar metadatos había que recargar la página para verlo.

import { invalidateLists } from './listCache';
import { invalidatePlayback } from './playbackCache';

export const ITEM_MUTATED_EVENT = 'jfp-item-mutated';

export type ItemMutatedDetail = {
    // itemId ausente = mutación de alcance desconocido (limpieza masiva de
    // caché, refresh de biblioteca…). Los listados refetchean; los detalles
    // solo si están seguros de que aplica.
    itemId?: string;
    /**
     * El item ya no existe. Para un listado da igual —refetchea y deja de
     * salir—, pero una ficha NO puede tratarlo como un cambio más: recargar un
     * item borrado responde 404 y lo que veía el usuario era un error justo
     * después de un borrado que había ido bien.
     */
    deleted?: boolean;
};

export function emitItemMutated(itemId?: string): void {
    emit({ itemId });
}

/** Como `emitItemMutated`, pero avisando de que ese item ya no está. */
export function emitItemDeleted(itemId: string): void {
    emit({ itemId, deleted: true });
}

/**
 * Los listados cacheados han cambiado por su cuenta (una revalidación en
 * segundo plano trajo datos nuevos). Avisa igual que una mutación, pero SIN
 * invalidar la caché: acaba de refrescarse, y tirarla aquí obligaría a los
 * ViewModels a pedir por segunda vez lo que ya está en memoria.
 */
export function emitListsRefreshed(): void {
    dispatch({});
}

function emit(detail: ItemMutatedDetail): void {
    // Cualquier cambio en un item deja obsoleta la biblioteca cacheada. Va
    // antes del evento a propósito: los ViewModels refetchean al recibirlo y
    // se encontrarían la lista de antes de la mutación.
    invalidateLists();
    // Y también lo negociado con el servidor sobre él: un item editado (o una
    // reproducción que acaba de terminar, que emite la suya) puede haber
    // cambiado de fuentes, de pistas o de posición.
    invalidatePlayback(detail.itemId);
    dispatch(detail);
}

function dispatch(detail: ItemMutatedDetail): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ItemMutatedDetail>(ITEM_MUTATED_EVENT, { detail }));
}
