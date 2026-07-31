import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { useSession } from '../../../domain/bridge/useSession';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useWatchedToggle } from './useWatchedToggle';
import type { Movie } from '../../../domain/models';

type Props = { movie: Movie; size?: number; badge?: boolean };

// "Visto" para películas. En sesión Jellyfin marca en el server; el
// store local se hidrata desde getMovie() y da feedback inmediato al
// toggle (revierte si el server falla).
export function MovieWatchedButton({ movie, size = 18, badge = false }: Props) {
    const [w, toggle] = useWatched(`movie-${movie.id}`);
    const { session } = useSession();
    // Sin sesión el estado del server (movie.watched) no cambia con los
    // clicks, así que sigue siendo un "or" con el toggle local. Con sesión,
    // getMovie() sincroniza el store en cada carga: confiamos en `w`.
    const complete = session?.accessToken ? w : ((movie.watched ?? 0) >= 1 || w);
    const onClick = useWatchedToggle({
        active: complete,
        applyLocal: () => toggle(),
        serverId: movie.id,
        message: (next) =>
            `${next ? 'Marcada como vista' : 'Marcada como no vista'} · ${movie.title}`
    });
    return (
        <IconButton onClick={onClick} ariaLabel={complete ? 'Marcar como no vista' : 'Marcar como vista'}>
            {badge && complete ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={complete} />}
        </IconButton>
    );
}
