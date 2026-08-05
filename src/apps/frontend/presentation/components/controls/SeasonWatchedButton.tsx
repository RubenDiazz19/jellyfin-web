import { episodeKey, seasonKey, WATCHED } from '../../../domain/stores';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { useWatchedToggle } from './useWatchedToggle';
import { WatchedToggleIcon } from './WatchedToggleIcon';
import type { Show, Season } from '../../../domain/models';

type Props = { show: Show; season: Season; size?: number };

// "Visto" para una temporada: agregado a partir de sus episodios. Con
// sesión real, marca a nivel de temporada en el server (propaga a
// episodios) y actualiza el store local para feedback instantáneo.
export function SeasonWatchedButton({ show, season, size = 15 }: Props) {
    const epIds = season.episodes.map((e) => episodeKey(show.id, season.n, e.n));
    useWatchedVersion(seasonKey(show.id, season.n));
    const all = epIds.length > 0 && epIds.every((id) => WATCHED.has(id));
    const toggleAll = useWatchedToggle({
        active: all,
        applyLocal: (next) => WATCHED.setMany(epIds, next),
        serverId: season.jfId,
        message: (next) => `Temporada ${season.n} marcada como ${next ? 'vista' : 'no vista'}`
    });
    return (
        <WatchedToggleIcon
            active={all}
            onClick={toggleAll}
            size={size}
            badge
            padding={0}
            ariaLabel={all ? 'Marcar temporada como no vista' : 'Marcar temporada como vista'}
        />
    );
}
