import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { useSession } from '../../../domain/bridge/useSession';
import { markPlayed } from '../../../domain/api';
import { IconButton } from './IconButton';
import { WatchedBadge } from './WatchedBadge';
import { useToast } from '../toast/ToastProvider';

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
    const toast = useToast();
    const { session } = useSession();
    const isReal = !!session?.accessToken && !!serverId;
    const onClick = async () => {
        const next = !w;
        const title = label ? ` · ${label}` : '';
        toggle();
        if (!isReal) {
            toast(next ? `Marcado como visto${title}` : `Marcado como no visto${title}`);
            return;
        }
        try {
            await markPlayed(serverId, next);
            toast(next ? `Marcado como visto${title}` : `Marcado como no visto${title}`, 'success');
        } catch (e) {
            toggle();
            toast((e as Error).message, 'warn');
        }
    };
    return (
        <IconButton onClick={onClick} ariaLabel={w ? 'Marcar como no visto' : 'Marcar como visto'}>
            {badge && w ? <WatchedBadge size={size} /> : <Ic.Tick size={size} filled={w} />}
        </IconButton>
    );
}
