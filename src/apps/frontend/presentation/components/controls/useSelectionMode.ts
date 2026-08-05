// Puente entre las tarjetas y el modo selección.
//
// Con el modo activo una tarjeta deja de navegar y pasa a marcar/desmarcar.
// Vive aquí y no en cada tarjeta para que las tres rejillas (series,
// películas y resultados de búsqueda) se comporten igual.

import { useSignalSelector, useSignalValue } from '../../../domain/bridge/useViewModel';
import { selectionVM, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';

export function useSelectionMode(item: SelectableItem, navigate: () => void) {
    const selecting = useSignalValue(selectionVM.selecting);
    // Por id y no por la lista entera: `selected` se reemplaza en cada
    // marcado, y suscribirse a ella repintaba TODAS las tarjetas de la rejilla
    // por cada click. Aquí solo repinta la tarjeta cuyo booleano cambió.
    const selected = useSignalSelector(selectionVM.selectedIds, (ids) => ids.has(item.id));
    return {
        selecting,
        selected: selecting && selected,
        onClick: () => {
            if (selecting) selectionVM.toggle(item);
            else navigate();
        }
    };
}
