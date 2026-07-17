import type { ReactNode } from 'react';
import { T } from '../../theme/tokens';

type Props = { title: string; children: ReactNode };

// Cabecera de fila horizontal (título en cursiva) usada por las filas de la
// home y de la librería.
export function Row({ title, children }: Props) {
  return (
    <div style={{ marginTop: 64, padding: '0 56px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 24 }}>
        <h3 style={{
          fontFamily: T.display, fontStyle: 'italic', fontSize: 30, fontWeight: 300,
          margin: 0, letterSpacing: -0.3,
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
