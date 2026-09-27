// Flechas de navegación de los carruseles horizontales. Hasta ahora cada
// carrusel copiaba el mismo bloque de JSX+estilos (~90 líneas), con SVGs
// idénticos y pequeñas variaciones en `top`. Con este componente basta una
// línea por lado.

import type { CSSProperties } from 'react';

type Props = {
    direction: 'left' | 'right';
    onClick: () => void;
    visible: boolean;
    /** Eje vertical del botón; por defecto '50%'. */
    top?: string;
};

const BASE: CSSProperties = {
    position: 'absolute',
    width: 44,
    height: 72,
    background: 'rgba(9, 11, 16, 0.75)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 12,
    transition: 'opacity 0.2s ease, background 0.2s ease',
    boxShadow: '0 8px 24px rgba(0,0,0,0.7)'
};

function ChevronLeft() {
    return (
        <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='15 18 9 12 15 6' />
        </svg>
    );
}

function ChevronRight() {
    return (
        <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='9 18 15 12 9 6' />
        </svg>
    );
}

export function CarouselNavButton({ direction, onClick, visible, top = '50%' }: Props) {
    const isLeft = direction === 'left';
    return (
        <button
            type='button'
            aria-label={isLeft ? 'Desplazar a la izquierda' : 'Desplazar a la derecha'}
            onClick={onClick}
            style={{
                ...BASE,
                top,
                transform: 'translateY(-50%)',
                ...(isLeft
                    ? { left: -18, borderRadius: '0 8px 8px 0', borderLeft: 'none' }
                    : { right: -18, borderRadius: '8px 0 0 8px', borderRight: 'none' }),
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none'
            }}
        >
            {isLeft ? <ChevronLeft /> : <ChevronRight />}
        </button>
    );
}
