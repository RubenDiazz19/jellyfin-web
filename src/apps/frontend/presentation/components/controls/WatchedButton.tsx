import { useWatched } from '../../../domain/bridge/useWatched';
import { WatchedToggle } from './WatchedToggle';

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
    return (
        <WatchedToggle
            active={w}
            applyLocal={() => toggle()}
            serverId={serverId}
            message={(next) => (next ? `Marcado como visto${suffix}` : `Marcado como no visto${suffix}`)}
            size={size}
            badge={badge}
            ariaLabel={w ? 'Marcar como no visto' : 'Marcar como visto'}
        />
    );
}

