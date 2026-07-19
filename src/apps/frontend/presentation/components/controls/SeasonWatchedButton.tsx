import { Ic } from '../../theme/icons';
import { WATCHED } from '../../../domain/stores';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { useSession } from '../../../domain/bridge/useSession';
import { markPlayed } from '../../../domain/api';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useToast } from '../toast/ToastProvider';
import type { Show, Season } from '../../../domain/models';

type Props = { show: Show; season: Season; size?: number };

// "Visto" para una temporada: agregado a partir de sus episodios. Con
// sesión real, marca a nivel de temporada en el server (propaga a
// episodios) y actualiza el store local para feedback instantáneo.
export function SeasonWatchedButton({ show, season, size = 15 }: Props) {
    const epIds = season.episodes.map((e) => `${show.id}-s${season.n}-e${e.n}`);
    useWatchedVersion();
    const toast = useToast();
    const { session } = useSession();
    const isReal = !!session?.accessToken;
    const all = epIds.length > 0 && epIds.every((id) => WATCHED.has(id));
    const toggleAll = async () => {
        const next = !all;
        WATCHED.setMany(epIds, next);
        if (!isReal || !season.jfId) {
            toast(next ?
                `Temporada ${season.n} marcada como vista` :
                `Temporada ${season.n} marcada como no vista`);
            return;
        }
        try {
            await markPlayed(season.jfId, next);
            toast(next ?
                `Temporada ${season.n} marcada como vista` :
                `Temporada ${season.n} marcada como no vista`, 'success');
        } catch (e) {
            WATCHED.setMany(epIds, !next);
            toast((e as Error).message, 'warn');
        }
    };
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
