import { seasonKey, WATCHED } from '../../../domain/stores';
import { getSeasonEpisodeKeys, isSeasonFullyWatched } from '../../../domain/showWatched';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { WatchedToggle } from './WatchedToggle';
import type { Show, Season } from '../../../domain/models';

type Props = { show: Show; season: Season; size?: number };

// "Visto" para una temporada: agregado a partir de sus episodios. Con
// sesión real, marca a nivel de temporada en el server (propaga a
// episodios) y actualiza el store local para feedback instantáneo.
export function SeasonWatchedButton({ show, season, size = 15 }: Props) {
    const epIds = getSeasonEpisodeKeys(show.id, season);
    useWatchedVersion(seasonKey(show.id, season.n));
    const all = isSeasonFullyWatched(show.id, season);
    return (
        <WatchedToggle
            active={all}
            applyLocal={(next) => WATCHED.setMany(epIds, next)}
            serverId={season.jfId}
            message={(next) => `Temporada ${season.n} marcada como ${next ? 'vista' : 'no vista'}`}
            size={size}
            badge
            padding={0}
            ariaLabel={all ? 'Marcar temporada como no vista' : 'Marcar temporada como vista'}
        />
    );
}

