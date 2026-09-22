// Entra y sale del modo selección.
//
// Estaba copiado literal en la biblioteca y en los resultados de búsqueda, y
// la única diferencia era el `marginLeft: 'auto'` con el que la búsqueda lo
// empuja al final de su barra. Eso es lo que se parametriza; el aspecto del
// botón es uno solo.

import globalize from 'lib/globalize';

import { useSignalValue } from '../../../../domain/bridge/useViewModel';
import { selectionVM } from '../../../../domain/viewModels/SelectionViewModel';
import { PillToggle } from './PillToggle';

type Props = {
    /** Lo empuja al final de una barra flex (la de resultados de búsqueda). */
    pushRight?: boolean;
};

export function SelectToggle({ pushRight = false }: Props) {
    const on = useSignalValue(selectionVM.selecting);
    return (
        <PillToggle
            active={on}
            onClick={() => (on ? selectionVM.stop() : selectionVM.start())}
            style={pushRight ? { marginLeft: 'auto' } : undefined}
        >
            {globalize.translate(on ? 'ButtonCancel' : 'SelectItems')}
        </PillToggle>
    );
}
