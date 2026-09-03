// El lienzo de una pantalla de catálogo: fondo, color, alto mínimo, márgenes
// y tipografía.
//
// Estaba copiado literal en cinco páginas (biblioteca, catálogo por sujeto,
// listas, favoritos y cola). No es solo ahorro de líneas: los márgenes de
// arriba dejan sitio a la barra de navegación, y con el bloque repetido
// cualquier ajuste de esa altura había que acordarse de hacerlo cinco veces.
//
// Mobile/tablet y desktop se separan aquí una sola vez: en táctil manda la
// paleta M3 (MC) y el margen lateral que dicta el viewport; en escritorio, el
// negro y los márgenes fijos de siempre.

import type { CSSProperties, ReactNode } from 'react';

import { useResponsive } from '../../theme/responsive';
import { C, T } from '../../theme/tokens';

type Props = {
    children: ReactNode;
    /** Ajustes puntuales de una página concreta. Se aplican los últimos. */
    style?: CSSProperties;
};

export function PageSection({ children, style }: Props) {
    const r = useResponsive();
    return (
        <section style={{
            background: C.bg,
            color: C.fg,
            minHeight: '100vh',
            padding: r.touch ? `76px ${r.pagePad}px 48px` : '120px 56px 96px',
            fontFamily: T.ui,
            ...style
        }}>
            {children}
        </section>
    );
}
