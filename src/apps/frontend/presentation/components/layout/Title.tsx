// Los títulos del app: el de una pantalla y el de un bloque dentro de ella.
//
// Son la misma tipografía —la display en cursiva y fina— repetida en una
// docena de sitios a mano, y por eso ya no medían lo mismo: 52px fijos en unas
// páginas y 32 en móvil en otras, 34 en una tercera. Puestos en un solo sitio,
// el tamaño de móvil deja de ser algo que haya que acordarse de poner.

import type { CSSProperties, ReactNode } from 'react';

import { useResponsive } from '../../theme/responsive';
import { T } from '../../theme/tokens';

const display: CSSProperties = {
    fontFamily: T.ui,
    fontWeight: 300
};

/**
 * El nombre de la pantalla. En una mano mide bastante menos: a 52px un título
 * largo se come media pantalla antes de que empiece el contenido.
 */
export function PageTitle({
    children, margin = 0
}: {
    children: ReactNode;
    /** Lo que separa del contenido; cada página tiene su ritmo. */
    margin?: CSSProperties['margin'];
}) {
    const r = useResponsive();
    return (
        <h1 style={{ ...display, fontSize: r.touch ? 32 : 52, letterSpacing: -0.5, margin }}>
            {children}
        </h1>
    );
}

/** El nombre de un bloque dentro de una pantalla: Series, Películas, Listas… */
export function SectionTitle({
    children, size = 26, margin = '0 0 20px'
}: {
    children: ReactNode;
    /** 26 en un índice; algo mayor donde el bloque es la pantalla entera. */
    size?: number;
    margin?: CSSProperties['margin'];
}) {
    return (
        <h3 style={{ ...display, fontSize: size, letterSpacing: -0.3, margin }}>
            {children}
        </h3>
    );
}
