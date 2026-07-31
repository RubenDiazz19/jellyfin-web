import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useWatchedToggle } from './useWatchedToggle';

type Props = {
    id: string;
    size?: number;
    badge?: boolean;
    label?: string;
    // Id real del server (episodio jfId). Si viene y hay sesión, también
    // marca en Jellyfin. Sin él, el toggle es solo local (prototipo).
    serverId?: string;
};

// "Visto" para un único item (episodio o serie individual).
export function WatchedButton({ id, size = 18, badge = false, label, serverId }: Props) {
    const [w, toggle] = useWatched(id);
    const suffix = label ? ` · ${label}` : '';
    const onClick = useWatchedToggle({
        active: w,
        applyLocal: () => toggle(),
        serverId,
        message: (next) => (next ? `Marcado como visto${suffix}` : `Marcado como no visto${suffix}`)
    });
    return (
        <IconButton onClick={onClick} ariaLabel={w ? 'Marcar como no visto' : 'Marcar como visto'}>
            {badge && w ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={w} />}
        </IconButton>
    );
}
