import { useState, type CSSProperties, type ReactNode } from 'react';

type Props = {
    onClick?: (e: React.MouseEvent) => void;
    ariaLabel?: string;
    padding?: number;
    active?: boolean;
    style?: CSSProperties;
    children: ReactNode;
};

// Botón base de icono: sin fondo/borde, "scale" al hover, stopPropagation
// automático (para que un click en el corazón/tick de una tarjeta no navegue).
export function IconButton({ onClick, ariaLabel, padding = 4, active = false, style, children }: Props) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            aria-label={ariaLabel}
            style={{
                background: 'none', border: 'none', cursor: 'pointer', padding,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
                transform: hover || active ? 'scale(1.14)' : 'scale(1)',
                transition: 'transform .2s',
                ...style
            }}
        >
            {children}
        </button>
    );
}
