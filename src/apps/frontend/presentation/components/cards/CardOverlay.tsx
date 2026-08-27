import type { CSSProperties, ReactNode } from 'react';

type Props = {
    topLeft?: ReactNode;
    topRight?: ReactNode;
    top?: number;
    left?: number;
    right?: number;
    style?: CSSProperties;
    children?: ReactNode;
};

// Capa de esquinas superiores para tarjetas (visto / favorito / número de episodio / selección).
export function CardOverlay({
    topLeft,
    topRight,
    top = 10,
    left = 12,
    right = 12,
    style,
    children
}: Props) {
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
            {topLeft && (
                <div style={{ position: 'absolute', top, left, pointerEvents: 'auto' }}>
                    {topLeft}
                </div>
            )}
            {topRight && (
                <div style={{ position: 'absolute', top, right, pointerEvents: 'auto' }}>
                    {topRight}
                </div>
            )}
            {children}
        </div>
    );
}
