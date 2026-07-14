import { T } from '../../theme/tokens';
import { useScrollY } from '../../hooks/useScrollY';

type Props = { label?: string };

// Indicador flotante de "hay más contenido debajo" que se desvanece al bajar.
export function ScrollHint({ label = 'Tu biblioteca' }: Props) {
  const y = useScrollY();
  const vis = y < 80;
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 32, transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      color: 'rgba(255,255,255,0.65)',
      fontFamily: T.ui, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
      opacity: vis ? 1 : 0,
      transition: 'opacity .4s',
      pointerEvents: vis ? 'auto' : 'none',
    }}>
      <span style={{ opacity: 0.85, fontWeight: 500 }}>{label}</span>
      <svg
        width="22" height="22" viewBox="0 0 24 24" fill="none"
        style={{ animation: 'jfp-arrow 1.8s ease-in-out infinite' }}
      >
        <path
          d="M6 10l6 6 6-6"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
