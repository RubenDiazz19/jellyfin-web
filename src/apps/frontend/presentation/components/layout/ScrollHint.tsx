import type { CSSProperties } from 'react';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useScrollY } from '../../../domain/bridge/useScrollY';

type Props = { label?: string; opacity?: number; style?: CSSProperties };

// Indicador flotante de "hay más contenido debajo" que se desvanece al bajar.
//
// Solo escritorio. En táctil no se pinta: el hero mide menos de una pantalla
// (ya se ve que hay más debajo), deslizar es el gesto natural y, sobre todo,
// esto va en absoluto pegado al fondo del hero y se comía el botón de
// reproducir de las fichas en cuanto la pantalla era corta.
export function ScrollHint({ label = 'Tu biblioteca', opacity, style }: Props) {
    const r = useResponsive();
    const y = useScrollY();
    const vis = y < 80;
    if (r.touch && opacity === undefined) return null;
    const effOpacity = opacity !== undefined ? opacity : (vis ? 1 : 0);
    return (
        <div style={{
            position: 'absolute', left: '50%', bottom: 32, transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: 'rgba(255,255,255,0.72)',
            fontFamily: T.ui, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase',
            textShadow: '0 1px 8px rgba(0,0,0,0.8)',
            zIndex: 5,
            opacity: effOpacity,
            transition: opacity !== undefined ? 'none' : 'opacity .4s',
            pointerEvents: effOpacity > 0.05 ? 'auto' : 'none',
            ...style
        }}>
            {/* Sin rótulo queda solo la flecha: lo que quiere el hero de una
                colección, donde no debe haber una letra encima de la imagen. */}
            {label && (
                <span style={{
                    fontWeight: 450,
                    letterSpacing: 2.5,
                    color: 'rgba(255,255,255,0.75)',
                    filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.8))'
                }}>
                    {label}
                </span>
            )}
            <svg
                width='13' height='13' viewBox='0 0 24 24' fill='none'
                style={{
                    animation: 'jfp-arrow 1.8s ease-in-out infinite',
                    filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.8))'
                }}
            >
                <path
                    d='M6 10l6 6 6-6'
                    stroke='rgba(255,255,255,0.75)'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </svg>
        </div>
    );
}
