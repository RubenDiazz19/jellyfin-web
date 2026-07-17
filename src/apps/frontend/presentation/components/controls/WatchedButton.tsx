import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/hooks/useWatched';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useToast } from '../toast/ToastProvider';

type Props = { id: string; size?: number; badge?: boolean; label?: string };

// "Visto" para un único item (episodio o serie individual).
export function WatchedButton({ id, size = 18, badge = false, label }: Props) {
  const [w, toggle] = useWatched(id);
  const toast = useToast();
  const onClick = () => {
    toggle();
    const title = label ? ` · ${label}` : '';
    toast(w ? `Marcado como no visto${title}` : `Marcado como visto${title}`);
  };
  return (
    <IconButton onClick={onClick} ariaLabel={w ? 'Marcar como no visto' : 'Marcar como visto'}>
      {badge && w ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={w} />}
    </IconButton>
  );
}
