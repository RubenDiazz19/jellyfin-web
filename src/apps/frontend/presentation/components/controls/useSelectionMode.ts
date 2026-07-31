// Puente entre las tarjetas y el modo selección.
//
// Con el modo activo una tarjeta deja de navegar y pasa a marcar/desmarcar.
// Vive aquí y no en cada tarjeta para que las tres rejillas (series,
// películas y resultados de búsqueda) se comporten igual.

import { useVmSignals } from '../../../domain/bridge/useViewModel';
import { selectionVM, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';

export function useSelectionMode(item: SelectableItem, navigate: () => void) {
    useVmSignals(selectionVM, (vm) => [vm.selecting, vm.selected]);
    const selecting = selectionVM.selecting.value;
    return {
        selecting,
        selected: selecting && selectionVM.has(item.id),
        onClick: () => {
            if (selecting) selectionVM.toggle(item);
            else navigate();
        }
    };
}
