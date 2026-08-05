// Rejilla de tarjetas que se rellena sola: tantas columnas como quepan de al
// menos `minWidth`, y el sobrante repartido entre ellas.
//
// El `repeat(auto-fill, minmax(…, 1fr))` estaba escrito a mano en siete
// sitios. Lo que cambia de uno a otro es el ancho mínimo y el hueco —una
// rejilla de pósters verticales no se mide como una de portadas 16/9—, así
// que eso son props y la mecánica es una sola.

import type { CSSProperties, ReactNode } from 'react';

type Props = {
    /**
     * Ancho mínimo de columna, en píxeles. Es lo que decide cuántas caben:
     * por debajo de ese ancho la rejilla quita una columna y reparte.
     */
    minWidth: number;
    /** Hueco entre tarjetas. Un número son píxeles en los dos ejes. */
    gap: number | string;
    children: ReactNode;
    /** Ajustes puntuales del call-site. Se aplican los últimos. */
    style?: CSSProperties;
};

export function CardGrid({ minWidth, gap, children, style }: Props) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
            gap,
            ...style
        }}>
            {children}
        </div>
    );
}
