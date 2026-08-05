// Entra y sale del modo selección.
//
// Estaba copiado literal en la biblioteca y en los resultados de búsqueda, y
// la única diferencia era el `marginLeft: 'auto'` con el que la búsqueda lo
// empuja al final de su barra. Eso es lo que se parametriza; el aspecto del
// botón es uno solo.

import globalize from 'lib/globalize';

import { useSignalValue } from '../../../domain/bridge/useViewModel';
import { selectionVM } from '../../../domain/viewModels/SelectionViewModel';
import { T } from '../../theme/tokens';

type Props = {
    /** Lo empuja al final de una barra flex (la de resultados de búsqueda). */
    pushRight?: boolean;
};

export function SelectToggle({ pushRight = false }: Props) {
    const on = useSignalValue(selectionVM.selecting);
    return (
        <button
            onClick={() => (on ? selectionVM.stop() : selectionVM.start())}
            style={{
                marginLeft: pushRight ? 'auto' : undefined,
                padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                background: on ? '#fff' : 'rgba(255,255,255,0.08)',
                color: on ? '#000' : T.dim,
                border: on ? 'none' : '1px solid rgba(255,255,255,0.15)',
                fontFamily: T.ui, fontSize: 12
            }}
        >
            {globalize.translate(on ? 'ButtonCancel' : 'SelectItems')}
        </button>
    );
}
