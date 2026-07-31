import { Ic } from '../../theme/icons';
import { WATCHED } from '../../../domain/stores';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useWatchedToggle } from './useWatchedToggle';
import type { Show, Season } from '../../../domain/models';

type Props = { show: Show; season: Season; size?: number };

// "Visto" para una temporada: agregado a partir de sus episodios. Con
// sesión real, marca a nivel de temporada en el server (propaga a
// episodios) y actualiza el store local para feedback instantáneo.
export function SeasonWatchedButton({ show, season, size = 15 }: Props) {
    const epIds = season.episodes.map((e) => `${show.id}-s${season.n}-e${e.n}`);
    useWatchedVersion();
    const all = epIds.length > 0 && epIds.every((id) => WATCHED.has(id));
    const toggleAll = useWatchedToggle({
        active: all,
        applyLocal: (next) => WATCHED.setMany(epIds, next),
        serverId: season.jfId,
        message: (next) => `Temporada ${season.n} marcada como ${next ? 'vista' : 'no vista'}`
    });
    return (
        <IconButton
            onClick={toggleAll}
            ariaLabel={all ? 'Marcar temporada como no vista' : 'Marcar temporada como vista'}
            padding={0}
        >
            {all ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={false} />}
        </IconButton>
    );
}
