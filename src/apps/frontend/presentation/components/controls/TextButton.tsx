// Botón que se ve como el texto que lo rodea pero lleva a algún sitio al
// pulsarlo: el logo del hero, la temporada y el episodio por los que ibas.
//
// Vive aquí y no dentro de una página porque los dos heroes de la portada
// —el de escritorio y el táctil— enseñan lo mismo y tienen que llevar a lo
// mismo. Cuando el reset del botón estaba suelto en HomePage, el hero táctil
// se quedó sin ninguna de las tres navegaciones.

import type { CSSProperties, ReactNode } from 'react';

// Que el botón no se note: ni fondo, ni borde, ni relleno, ni tipografía
// propia. Hereda del texto en el que está metido.
const RESET: CSSProperties = {
    background: 'none', border: 'none', padding: 0,
    font: 'inherit', color: 'inherit',
    letterSpacing: 'inherit', textTransform: 'inherit',
    cursor: 'pointer'
};

/**
 * Relleno que agranda la diana sin mover nada de sitio: el margen negativo
 * devuelve lo que el relleno horizontal había añadido, así la línea de
 * metadatos se sigue leyendo con los mismos espacios que cuando era texto
 * plano. En táctil el texto mide 14 px y sin esto no hay dónde dar.
 */
export const TEXT_BTN_TAP: CSSProperties = { padding: '7px 3px', margin: '0 -3px' };

type Props = {
    onClick: () => void;
    children: ReactNode;
    /** Para cuando el contenido es una imagen y no dice su propio nombre. */
    label?: string;
    /** El texto se aclara al pasar por encima. Sin efecto en táctil. */
    highlight?: boolean;
    style?: CSSProperties;
};

export function TextButton({ onClick, children, label, highlight, style }: Props) {
    return (
        <button
            onClick={onClick}
            // preventDefault en mousedown bloquea el focus nativo del
            // navegador. Sin esto Chrome enfoca el botón al bajar el ratón y
            // —los heroes son 100vh con el contenido pegado abajo— scrollea
            // unos px para acomodar el anillo de foco: el mouseup cae fuera y
            // el click no llega a dispararse.
            onMouseDown={(e) => e.preventDefault()}
            aria-label={label}
            style={{ ...RESET, ...style }}
            onMouseEnter={highlight ? (e) => (e.currentTarget.style.color = '#fff') : undefined}
            onMouseLeave={highlight ? (e) => (e.currentTarget.style.color = '') : undefined}
        >
            {children}
        </button>
    );
}
