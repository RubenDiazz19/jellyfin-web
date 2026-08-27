import { useWatchedToggle } from './useWatchedToggle';
import { WatchedToggleIcon } from './WatchedToggleIcon';

type Props = {
    active: boolean;
    applyLocal: (next: boolean) => void;
    serverId?: string;
    message: (next: boolean) => string;
    size?: number;
    badge?: boolean;
    padding?: number;
    ariaLabel?: string;
};

// Componente genérico para alternar el estado "visto" conectando
// `useWatchedToggle` con `WatchedToggleIcon`.
export function WatchedToggle({
    active,
    applyLocal,
    serverId,
    message,
    size = 18,
    badge = false,
    padding,
    ariaLabel
}: Props) {
    const onClick = useWatchedToggle({
        active,
        applyLocal,
        serverId,
        message
    });
    return (
        <WatchedToggleIcon
            active={active}
            onClick={onClick}
            size={size}
            badge={badge}
            padding={padding}
            ariaLabel={ariaLabel ?? (active ? 'Marcar como no visto' : 'Marcar como visto')}
        />
    );
}
