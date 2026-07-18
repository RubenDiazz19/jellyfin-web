import { Ic } from '../../theme/icons';
import { WATCHED } from '../../../domain/stores';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useToast } from '../toast/ToastProvider';
import type { Show, Season } from '../../../domain/models';

type Props = { show: Show; season: Season; size?: number };

// "Visto" para una temporada: se ve marcada cuando todos sus episodios lo
// están; togglea todos a la vez.
export function SeasonWatchedButton({ show, season, size = 15 }: Props) {
  const epIds = season.episodes.map((e) => `${show.id}-s${season.n}-e${e.n}`);
  useWatchedVersion();
  const toast = useToast();
  const all = epIds.length > 0 && epIds.every((id) => WATCHED.has(id));
  const toggleAll = () => {
    WATCHED.setMany(epIds, !all);
    toast(all
      ? `Temporada ${season.n} marcada como no vista`
      : `Temporada ${season.n} marcada como vista`);
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
