import { useState } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';

type Props = {
    size?: number;
    onClick?: (e: React.MouseEvent) => void;
    label?: string;
    progress?: number | null;
    hoverText?: string | null;
    // Visto: el círculo se rellena de blanco suave y el icono pasa a un
    // tick negro, para distinguirlo de un vuelo de ojo del pendiente.
    watched?: boolean;
};

// Play traslúcido con aro de progreso. Cuando no hay progreso, el aro se ve
// tenue; cuando lo hay, se ilumina el arco correspondiente.
export function PlayBtn({
    size = 96, onClick, label, progress = null, hoverText = null, watched = false
}: Props) {
    const sw = 2;
    const r = size / 2 - sw / 2 - 2;
    const c = 2 * Math.PI * r;
    const has = progress !== null && progress > 0;
    const [hover, setHover] = useState(false);
    return (
        <div
            style={{
                position: 'relative', width: size, height: size,
                transform: hover ? 'scale(1.07)' : 'scale(1)',
                transition: 'transform .3s cubic-bezier(.2,.7,.3,1)'
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <svg
                width={size} height={size} viewBox={`0 0 ${size} ${size}`}
                style={{
                    position: 'absolute', inset: 0,
                    transform: 'rotate(-90deg)', pointerEvents: 'none', overflow: 'visible'
                }}
            >
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill='none'
                    stroke={watched ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}
                    strokeWidth={sw}
                />
                {has && (
                    <circle
                        cx={size / 2} cy={size / 2} r={r}
                        fill='none' stroke='rgba(255,255,255,0.9)' strokeWidth={sw}
                        strokeLinecap='round'
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - (progress as number))}
                        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.65,0,.35,1)' }}
                    />
                )}
            </svg>

            <button
                onClick={onClick}
                // preventDefault en mousedown bloquea el focus nativo del navegador.
                // Sin esto, Chrome enfoca el <button> al bajar el ratón y — si el
                // botón está cerca del borde inferior del viewport (nuestros heroes
                // son 100vh con `justify-content: flex-end`) — scrollea unos px para
                // acomodar el focus ring. Ese scroll desplaza visualmente el botón,
                // el mouseup cae fuera y el `click` no se dispara: hay que apretar
                // dos veces. El monkey-patch de HTMLElement.prototype.focus fuerza
                // preventScroll:true pero SÓLO en llamadas explícitas .focus() — el
                // focus nativo del navegador durante mousedown no pasa por él.
                onMouseDown={(e) => e.preventDefault()}
                aria-label={label || (watched ? 'Visto — reproducir de nuevo' : 'Reproducir')}
                style={{
                    position: 'absolute', inset: 0,
                    width: size, height: size, borderRadius: '50%',
                    border: 'none',
                    // Visto: blanco suave (no llega a sólido para no gritar
                    // sobre el backdrop); un pelín más opaco al hover.
                    background: watched ?
                        (hover ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.78)') :
                        (hover ? 'rgba(255,255,255,0.06)' : 'transparent'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: watched ? '#000' : 'rgba(255,255,255,0.95)',
                    cursor: 'pointer', padding: 0,
                    transition: 'border .2s, background .2s, color .2s'
                }}
            >
                {hover && hoverText ? (
                    <span style={{
                        fontFamily: T.ui, fontSize: size * 0.1, lineHeight: 1.2, textAlign: 'center',
                        padding: '0 14%', fontWeight: 600, letterSpacing: 0.2
                    }}>
                        {hoverText}
                    </span>
                ) : watched ? (
                    <span style={{ display: 'flex' }}>
                        <Ic.Check size={size * 0.34} stroke='#000' />
                    </span>
                ) : (
                    <span style={{ marginLeft: size * 0.07, display: 'flex' }}>
                        <Ic.Play size={size * 0.3} fill='currentColor' />
                    </span>
                )}
            </button>
        </div>
    );
}
