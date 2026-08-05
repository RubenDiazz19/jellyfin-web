import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useScrollY } from '../../../domain/bridge/useScrollY';

type Props = { label?: string };

// Indicador flotante de "hay más contenido debajo" que se desvanece al bajar.
//
// Solo escritorio. En táctil no se pinta: el hero mide menos de una pantalla
// (ya se ve que hay más debajo), deslizar es el gesto natural y, sobre todo,
// esto va en absoluto pegado al fondo del hero y se comía el botón de
// reproducir de las fichas en cuanto la pantalla era corta.
export function ScrollHint({ label = 'Tu biblioteca' }: Props) {
    const r = useResponsive();
    const y = useScrollY();
    const vis = y < 80;
    if (r.touch) return null;
    return (
        <div style={{
            position: 'absolute', left: '50%', bottom: 32, transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            color: 'rgba(255,255,255,0.65)',
            fontFamily: T.ui, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            opacity: vis ? 1 : 0,
            transition: 'opacity .4s',
            pointerEvents: vis ? 'auto' : 'none'
        }}>
            {/* Sin rótulo queda solo la flecha: lo que quiere el hero de una
                colección, donde no debe haber una letra encima de la imagen. */}
            {label && <span style={{ opacity: 0.85, fontWeight: 500 }}>{label}</span>}
            <svg
                width='22' height='22' viewBox='0 0 24 24' fill='none'
                style={{ animation: 'jfp-arrow 1.8s ease-in-out infinite' }}
            >
                <path
                    d='M6 10l6 6 6-6'
                    stroke='rgba(255,255,255,0.85)'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </svg>
        </div>
    );
}
