// El aspecto de un botón de «visto», sin nada de su lógica.
//
// Episodio, película, temporada y serie agregan estados distintos y dicen
// cosas distintas, pero se pintan igual: un tick que se rellena, o —donde
// hace falta que «completado» se lea de un vistazo sobre una carátula— una
// insignia circular en su lugar.

import { Ic } from '../../theme/icons';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';

type Props = {
    /** Estado ya agregado por quien llama. */
    active: boolean;
    onClick: () => void;
    size?: number;
    /** Sobre una carátula, «completado» se pinta como insignia y no como tick. */
    badge?: boolean;
    /** Solo donde el hueco es justo; por defecto el del IconButton. */
    padding?: number;
    ariaLabel: string;
};

export function WatchedToggleIcon({
    active, onClick, size = 18, badge = false, padding, ariaLabel
}: Props) {
    return (
        <IconButton onClick={onClick} ariaLabel={ariaLabel} padding={padding}>
            {badge && active ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={active} />}
        </IconButton>
    );
}
