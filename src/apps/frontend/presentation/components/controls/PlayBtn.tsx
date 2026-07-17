import { useState } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';

type Props = {
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  label?: string;
  progress?: number | null;
  hoverText?: string | null;
};

// Play traslúcido con aro de progreso. Cuando no hay progreso, el aro se ve
// tenue; cuando lo hay, se ilumina el arco correspondiente.
export function PlayBtn({ size = 96, onClick, label, progress = null, hoverText = null }: Props) {
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
        transition: 'transform .3s cubic-bezier(.2,.7,.3,1)',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{
          position: 'absolute', inset: 0,
          transform: 'rotate(-90deg)', pointerEvents: 'none', overflow: 'visible',
        }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={sw} />
        {has && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (progress as number))}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.65,0,.35,1)' }}
          />
        )}
      </svg>

      <button
        onClick={onClick}
        aria-label={label || 'Reproducir'}
        style={{
          position: 'absolute', inset: 0,
          width: size, height: size, borderRadius: '50%',
          border: 'none',
          background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.95)',
          cursor: 'pointer', padding: 0,
          transition: 'border .2s, background .2s',
        }}
      >
        {hover && hoverText ? (
          <span style={{
            fontFamily: T.ui, fontSize: size * 0.1, lineHeight: 1.2, textAlign: 'center',
            padding: '0 14%', fontWeight: 600, letterSpacing: 0.2,
          }}>
            {hoverText}
          </span>
        ) : (
          <span style={{ marginLeft: size * 0.07, display: 'flex' }}>
            <Ic.Play size={size * 0.3} fill="currentColor" />
          </span>
        )}
      </button>
    </div>
  );
}
