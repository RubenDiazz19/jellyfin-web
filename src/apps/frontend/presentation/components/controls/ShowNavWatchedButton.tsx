import { Ic } from '../../theme/icons';
import { WATCHED } from '../../../data/stores/watchedStore';
import { useWatchedVersion } from '../../../domain/hooks/useWatched';
import { PROTO_DATA } from '../../../data/models';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useToast } from '../toast/ToastProvider';

// "Visto" para series — calcula el estado agregado desde todos los episodios
// de todas las temporadas y marca/desmarca todos a la vez. Se usa tanto en
// el Nav de la ficha como en las tarjetas de la Home/librería, para que
// marcar visto en la carátula quede reflejado en la ficha y viceversa.
type Props = { showId: string; size?: number; badge?: boolean };

export function ShowNavWatchedButton({ showId, size = 18, badge = false }: Props) {
  useWatchedVersion();
  const toast = useToast();
  const show = PROTO_DATA.shows[showId];
  const allEpIds = show
    ? (show.seasons || []).flatMap((season) =>
        (season.episodes || []).map((ep) => `${showId}-s${season.n}-e${ep.n}`),
      )
    : [];
  const allWatched = allEpIds.length > 0 && allEpIds.every((id) => WATCHED.has(id));
  const toggle = () => {
    WATCHED.setMany(allEpIds, !allWatched);
    toast(allWatched
      ? `Serie marcada como no vista · ${show?.title ?? ''}`
      : `Serie marcada como vista · ${show?.title ?? ''}`);
  };
  return (
    <IconButton
      onClick={toggle}
      ariaLabel={allWatched ? 'Marcar serie como no vista' : 'Marcar serie como vista'}
    >
      {badge && allWatched
        ? <WatchedBadge size={size} />
        : <Ic.Tick size={size} filled={allWatched} />}
    </IconButton>
  );
}
