// Las piezas que se repiten en las cuatro fichas (serie, temporada, episodio
// y película): el estado de carga, el cuerpo bajo el hero, la rejilla de dos
// columnas, las cabeceras y la tabla de datos.
//
// Ninguna decide contenido: cada ficha sigue diciendo qué enseña y en qué
// orden. Lo que dejan de repetir son los cuatro bloques de estilo idénticos
// que había copiados en cada una.

import type { CSSProperties, ReactNode } from 'react';
import { T } from '../../theme/tokens';
import { MC, useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';
import { translateGenre } from '../../../domain/genres';

const FULL_SCREEN: CSSProperties = {
    minHeight: '100vh', background: '#000', fontFamily: T.ui,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
};

/**
 * La ficha todavía no tiene datos que pintar: o falló la carga, o sigue en
 * marcha. Ocupa la pantalla entera porque sustituye al hero.
 */
export function DetailStatus({ error }: { error?: string | null }) {
    if (error) {
        return (
            <section style={{ ...FULL_SCREEN, color: '#ff6b6b', padding: 24 }}>
                {error}
            </section>
        );
    }
    return (
        <section style={{
            ...FULL_SCREEN, color: T.dim,
            fontSize: 13, letterSpacing: 3, textTransform: 'uppercase'
        }}>
            Cargando…
        </section>
    );
}

/** Todo lo que va bajo el hero de una ficha: se desliza suavemente sobre el hero fijo. */
export function DetailBody({ children }: { children: ReactNode }) {
    const r = useResponsive();
    return (
        <section style={{
            position: 'relative',
            zIndex: 2,
            background: 'transparent',
            color: r.touch ? MC.fg : '#fff',
            padding: r.touch ? `24px ${r.pagePad}px 56px` : '32px 56px 96px',
            fontFamily: T.ui,
            minHeight: '100vh'
        }}>
            {children}
        </section>
    );
}

/**
 * Sinopsis a la izquierda, datos a la derecha.
 *
 * minmax(0,…) evita el grid blowout: sin él el track 1fr no baja del
 * min-content del reparto y la rejilla desborda el viewport. En touch la
 * ficha es de una sola columna (spec 4.3).
 */
export function DetailColumns({ children }: { children: ReactNode }) {
    const r = useResponsive();
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: r.touch ? 'minmax(0, 1fr)' : 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: r.touch ? 36 : 64
        }}>
            {children}
        </div>
    );
}

/** Rótulo pequeño en versales que encabeza cada bloque de la ficha. */
export function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <div style={{
            fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
            color: T.dim, marginBottom: 18
        }}>
            {children}
        </div>
    );
}

/** Cabecera de una sección grande de la ficha (temporadas, episodios, sagas). */
export function DetailHeading({
    title, marginBottom, onTitleClick, children
}: {
    title: string;
    marginBottom: number;
    /** Acción opcional al pulsar el título (ej: enlace a la colección). */
    onTitleClick?: () => void;
    /** Lo que va a la derecha del título: un recuento, un selector… */
    children?: ReactNode;
}) {
    const titleNode = onTitleClick ? (
        <button
            type='button'
            onClick={onTitleClick}
            style={{
                all: 'unset',
                cursor: 'pointer',
                fontFamily: T.display,
                fontSize: 30,
                fontWeight: 300,
                margin: 0,
                transition: 'opacity .2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
            {title}
        </button>
    ) : (
        <h3 style={{
            fontFamily: T.display, fontSize: 30, fontWeight: 300, margin: 0
        }}>
            {title}
        </h3>
    );

    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom, flexWrap: 'wrap' }}>
            {titleNode}
            {children}
        </div>
    );
}

/**
 * Tabla etiqueta → valor de la columna de datos.
 *
 * En táctil la etiqueta ocupa menos (120px de 360 son un tercio de la
 * pantalla) y el valor va en `minmax(0,…)`: con `1fr` a secas el mínimo es el
 * min-content del valor, y una fecha larga o un `1080p · HEVC · SDR` sacaban
 * la tabla fuera de la pantalla en vez de partirse en varias líneas.
 */
export function DetailTable({ children }: { children: ReactNode }) {
    const r = useResponsive();
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: r.touch ? 'minmax(88px, auto) minmax(0, 1fr)' : '120px minmax(0, 1fr)',
            rowGap: 14, columnGap: r.touch ? 14 : 18, fontSize: 13
        }}>
            {children}
        </div>
    );
}

/** Una fila de `DetailTable`: son dos celdas, no un elemento contenedor. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <span style={{ color: T.dim }}>{label}</span>
            <span>{children}</span>
        </>
    );
}

/** Los géneros del item como enlaces a su listado, separados por comas. */
export function GenreLinks({ genres, navigate }: { genres: string[]; navigate: Navigate }) {
    return (
        <>
            {genres.map((g, i) => (
                <span key={g}>
                    <button
                        onClick={() => navigate({ page: 'genre', genre: g })}
                        style={{
                            background: 'none', border: 'none', padding: 0,
                            font: 'inherit', color: 'inherit', cursor: 'pointer',
                            textDecoration: 'underline dotted', textUnderlineOffset: 3
                        }}
                    >{translateGenre(g)}</button>
                    {i < genres.length - 1 && ', '}
                </span>
            ))}
        </>
    );
}
