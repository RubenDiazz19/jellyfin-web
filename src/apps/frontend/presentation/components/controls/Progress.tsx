type Props = {
    value: number;
    color?: string;
    track?: string;
    height?: number;
};

// Barra de progreso simple.
export function Progress({
    value,
    color = 'rgba(255,255,255,0.9)',
    track = 'rgba(255,255,255,0.18)',
    height = 2
}: Props) {
    return (
        <div style={{ width: '100%', height, background: track, borderRadius: 999, overflow: 'hidden' }}>
            <div
                style={{
                    width: `${value * 100}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 999,
                    transition: 'width 1.2s ease'
                }}
            />
        </div>
    );
}
