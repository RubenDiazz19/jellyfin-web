import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useToast } from '../toast/ToastProvider';
import type { Movie } from '../../../domain/models';

type Props = { movie: Movie; size?: number; badge?: boolean };

// "Visto" para películas — completo = progreso 100% en datos O marcado a mano.
// Así el tick, la insignia y el botón de reproducir comparten el mismo estado.
export function MovieWatchedButton({ movie, size = 18, badge = false }: Props) {
  const [w, toggle] = useWatched(`movie-${movie.id}`);
  const toast = useToast();
  const complete = (movie.watched ?? 0) >= 1 || w;
  const onClick = () => {
    toggle();
    toast(complete ? `Marcada como no vista · ${movie.title}` : `Marcada como vista · ${movie.title}`);
  };
  return (
    <IconButton onClick={onClick} ariaLabel={complete ? 'Marcar como no vista' : 'Marcar como vista'}>
      {badge && complete ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={complete} />}
    </IconButton>
  );
}
