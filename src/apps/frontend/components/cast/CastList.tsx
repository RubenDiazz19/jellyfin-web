import { T } from '../../theme/tokens';
import type { CastMember } from '../../data';
import type { Navigate } from '../../router';

type Props = { cast: CastMember[]; navigate: Navigate; label?: string };

// Fila horizontal con las tarjetas del reparto. Pulsando una se abre la
// ficha de esa persona con su filmografía dentro de la biblioteca.
export function CastList({ cast, navigate, label = 'Reparto principal' }: Props) {
  return (
    <div>
      <div style={{
        fontFamily: T.ui, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
        color: T.dim, marginBottom: 18,
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none',
      }}>
        {cast.map((c) => (
          <div
            key={c.name}
            onClick={() => navigate({ page: 'person', name: c.name })}
            className="jfp-hoverlift"
            style={{ width: 180, flexShrink: 0, cursor: 'pointer' }}
          >
            <div style={{
              width: 180, height: 250, borderRadius: 12, overflow: 'hidden',
              background: 'linear-gradient(160deg,#1a1a2e,#2d1b4e)',
              border: `1px solid ${T.hairline}`, marginBottom: 9,
            }}>
              {c.photo ? (
                <img
                  src={c.photo}
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, color: 'rgba(255,255,255,0.15)',
                }}>
                  👤
                </div>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
              {c.name}
            </div>
            <div style={{ fontSize: 13, color: T.dim, fontStyle: 'italic', fontFamily: T.display }}>
              {c.role}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
