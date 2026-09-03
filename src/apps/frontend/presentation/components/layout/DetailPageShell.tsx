import type { CSSProperties, ReactNode } from 'react';
import { C } from '../../theme/tokens';

type Props = {
    hero: ReactNode;
    children: ReactNode;
    style?: CSSProperties;
};

/**
 * Contenedor raíz común para todas las páginas de detalle (Movie, Show, Season, Episode).
 * Aplica el fondo adaptativo C.bg, el alto mínimo de 100vh y posicionamiento relativo.
 */
export function DetailPageShell({ hero, children, style }: Props) {
    return (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: C.bg, ...style }}>
            {hero}
            {children}
        </div>
    );
}
