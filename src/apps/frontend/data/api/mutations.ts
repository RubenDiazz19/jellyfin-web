// Bus de invalidación local: cualquier mutación sobre un item (imágenes,
// metadatos, favorito, played, delete…) emite este evento y los ViewModels
// que muestran ese item lo escuchan para refetchear. Sin esto, tras cambiar
// una imagen o editar metadatos había que recargar la página para verlo.

export const ITEM_MUTATED_EVENT = 'jfp-item-mutated';

export type ItemMutatedDetail = {
    // itemId ausente = mutación de alcance desconocido (limpieza masiva de
    // caché, refresh de biblioteca…). Los listados refetchean; los detalles
    // solo si están seguros de que aplica.
    itemId?: string;
};

export function emitItemMutated(itemId?: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ItemMutatedDetail>(ITEM_MUTATED_EVENT, {
        detail: { itemId }
    }));
}
