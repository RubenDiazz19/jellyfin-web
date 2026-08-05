import type { CSSProperties, ReactNode } from 'react';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

type Props = { title: string; children: ReactNode };

// Cabecera de fila horizontal (título en cursiva) usada por las filas de la
// home y de la librería. En mobile/tablet compacta márgenes y tipografía;
// en desktop conserva los valores de siempre.
export function Row({ title, children }: Props) {
    const r = useResponsive();
    return (
        <div style={{
            marginTop: r.touch ? 28 : 64,
            padding: r.touch ? `0 ${r.pagePad}px` : '0 56px'
        }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: r.touch ? 12 : 24 }}>
                <h3 style={{
                    fontFamily: T.display, fontStyle: 'italic',
                    fontSize: r.touch ? 21 : 30, fontWeight: 300,
                    margin: 0, letterSpacing: -0.3
                }}>
                    {title}
                </h3>
            </div>
            {children}
        </div>
    );
}

/**
 * La fila de tarjetas en sí: se arrastra de lado. En táctil encaja cada
 * tarjeta al soltar (scroll-snap) y esconde la barra de scroll, que ahí no
 * pinta nada. En escritorio se queda como estaba: flex con scroll a secas.
 */
export function RowScroller({ children }: { children: ReactNode }) {
    const r = useResponsive();
    const style: CSSProperties = {
        display: 'flex',
        gap: r.touch ? r.gap : 24,
        overflowX: 'auto',
        ...(r.touch ? {
            scrollSnapType: 'x mandatory',
            // Hueco para la sombra M3 de las tarjetas, que el scroll recorta.
            paddingBottom: 6,
            scrollbarWidth: 'none' as const
        } : {})
    };
    return (
        <div style={style} data-jfp-row=''>
            {children}
        </div>
    );
}
