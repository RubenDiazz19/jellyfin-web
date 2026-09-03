import type { MouseEvent, ReactNode } from 'react';
import { T } from '../../theme/tokens';
import { CardProgress } from './CardProgress';
import { CardOverlay } from './CardOverlay';
import { PosterFrame } from './PosterFrame';
import { PosterOverlay } from './PosterOverlay';
import { SelectionMark } from './SelectionMark';

// Carcasa del póster vertical 2:3. La comparten la card de serie, la de
// película en fila y la de película en grid: las tres pintaban exactamente
// el mismo marco (degradado, botones en las esquinas, logo-o-título abajo,
// barra de progreso y pie) y solo se diferencian en qué botón de "visto"
// montan y qué dice el pie.

type Props = {
    /** Imagen de fondo ya resuelta (póster, o backdrop si no hay póster). */
    cover?: string;
    onClick: () => void;
    /** Ancho fijo para las filas con scroll; null = llena la columna del grid. */
    width?: number | null;
    /** Degradado inferior; se deja configurable porque el grid lo usa más alto. */
    gradient?: string;
    /** Botón de "visto" (varía según sea serie, película o temporada). */
    watchedButton?: ReactNode;
    favButton?: ReactNode;
    logo?: string | null;
    title: string;
    /** Progreso 0..1. Solo se pinta a medias: ni empezado ni terminado. */
    progress?: number;
    /** Línea bajo la carátula: año, duración, tipo… */
    caption?: ReactNode;
    /** Modo selección: los botones de la carátula dejan paso a la marca. */
    selecting?: boolean;
    selected?: boolean;
    /** Clic derecho: abre el menú del item. Lo arma `useItemContextMenu`. */
    onContextMenu?: (e: MouseEvent) => void;
    /** El menú en sí, invisible hasta que se abre. */
    contextMenu?: ReactNode;
    /** Variante 'full' (con botones y caption) o 'tile' (ligera para búsqueda/listas). */
    variant?: 'full' | 'tile';
    /** Etiqueta superior cuando variant === 'tile' */
    kindLabel?: string;
    borderRadius?: number;
};

const DEFAULT_GRADIENT = 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))';

/**
 * Ancho del póster en desktop. Lo comparten las tarjetas y el hueco que deja
 * `LazyCard` cuando las desmonta: si no midieran igual, las filas cambiarían
 * de alto al montarse y el scroll daría tirones.
 */
export const POSTER_W = 230;

export function PosterShell({
    cover, onClick, width = null, gradient = DEFAULT_GRADIENT,
    watchedButton, favButton, logo, title, progress = 0, caption,
    selecting = false, selected = false, onContextMenu, contextMenu,
    variant = 'full', kindLabel, borderRadius
}: Props) {
    const isTile = variant === 'tile';
    const inProgress = !isTile && progress > 0 && progress < 1;
    const computedRadius = borderRadius ?? (isTile ? 8 : undefined);

    const topLeftOverlay = selecting ? (
        <SelectionMark selected={selected} />
    ) : isTile && kindLabel ? (
        <span style={{
            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            background: 'rgba(0,0,0,0.5)',
            padding: '3px 7px', borderRadius: 4
        }}>
            {kindLabel}
        </span>
    ) : watchedButton;

    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={width == null ?
                { width: '100%', cursor: 'pointer' } :
                { width, flex: `0 0 ${width}px`, cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <PosterFrame borderRadius={computedRadius} selected={selected}>
                {/* `<img>` y no `background-image`: un fondo CSS no admite
                    `loading='lazy'`, así que el navegador se descargaba de
                    golpe las carátulas de toda la rejilla —cientos— aunque no
                    se llegara a ver ninguna más allá de la primera fila. */}
                {cover && (
                    <img
                        src={cover}
                        alt=''
                        loading='lazy'
                        decoding='async'
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', objectPosition: 'center'
                        }}
                    />
                )}
                <div style={{ position: 'absolute', inset: 0, background: gradient }} />
                <CardOverlay
                    top={isTile ? 8 : undefined}
                    left={isTile ? 10 : undefined}
                    topLeft={topLeftOverlay}
                    topRight={selecting || isTile ? null : favButton}
                />
                {isTile && !cover && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: T.ui, fontSize: 32,
                        color: 'rgba(255,255,255,0.15)'
                    }}>
                        {title?.[0]}
                    </div>
                )}
                <PosterOverlay
                    logo={logo}
                    title={title}
                    inProgress={inProgress}
                    fontSize={isTile ? 'clamp(11px, 7.5cqi, 15px)' : undefined}
                    fontWeight={isTile ? 600 : undefined}
                />
                {inProgress && (
                    <CardProgress value={progress} />
                )}
            </PosterFrame>
            {caption && (
                <div style={{
                    marginTop: 10, fontFamily: T.ui, fontSize: 11, color: T.dim,
                    letterSpacing: 1, textTransform: 'uppercase'
                }}>
                    {caption}
                </div>
            )}
            {contextMenu}
        </div>
    );
}

