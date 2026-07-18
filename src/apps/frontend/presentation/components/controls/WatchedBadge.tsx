import { Ic } from '../../theme/icons';

// Insignia circular blanca con check — "completado".
export function WatchedBadge({ size = 18 }: { size?: number }) {
    return (
        <div
            style={{
                width: size + 6, height: size + 6, borderRadius: '50%',
                background: 'rgba(255,255,255,0.96)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))'
            }}
        >
            <Ic.Check size={size * 0.72} />
        </div>
    );
}
