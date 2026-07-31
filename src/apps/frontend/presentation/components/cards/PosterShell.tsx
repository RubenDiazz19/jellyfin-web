import type { ReactNode } from 'react';
import { T } from '../../theme/tokens';
import { Progress } from '../controls/Progress';

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
    width: number | null;
    /** Degradado inferior; se deja configurable porque el grid lo usa más alto. */
    gradient?: string;
    /** Botón de "visto" (varía según sea serie, película o temporada). */
    watchedButton: ReactNode;
    favButton: ReactNode;
    logo?: string | null;
    title: string;
    /** Progreso 0..1. Solo se pinta a medias: ni empezado ni terminado. */
    progress?: number;
    /** Línea bajo la carátula: año, duración, tipo… */
    caption: ReactNode;
    /** Modo selección: los botones de la carátula dejan paso a la marca. */
    selecting?: boolean;
    selected?: boolean;
};

const DEFAULT_GRADIENT = 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))';

export function PosterShell({
    cover, onClick, width, gradient = DEFAULT_GRADIENT,
    watchedButton, favButton, logo, title, progress = 0, caption,
    selecting = false, selected = false
}: Props) {
    const inProgress = progress > 0 && progress < 1;
    return (
        <div
            onClick={onClick}
            style={width == null ?
                { width: '100%', cursor: 'pointer' } :
                { width, flex: `0 0 ${width}px`, cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div
                className='jfp-card-m3'
                style={{
                    aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden', position: 'relative',
                    backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center',
                    // El marcado se ve de un vistazo aunque la carátula sea clara.
                    outline: selected ? '3px solid #fff' : undefined,
                    outlineOffset: selected ? -3 : undefined
                }}
            >
                <div style={{ position: 'absolute', inset: 0, background: gradient }} />
                {selecting ? (
                    // En modo selección los botones estorban: pulsar «visto» o
                    // «favorito» dentro de una tarjeta que se está marcando es
                    // ambiguo. Se sustituyen por la marca de seleccionado.
                    <div style={{
                        position: 'absolute', top: 10, left: 12,
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: selected ? '#fff' : 'rgba(0,0,0,0.45)',
                        border: selected ? 'none' : '2px solid rgba(255,255,255,0.7)',
                        color: '#000', fontSize: 13, lineHeight: 1
                    }}>
                        {selected ? '✓' : ''}
                    </div>
                ) : (
                    <>
                        <div style={{ position: 'absolute', top: 10, left: 12 }}>{watchedButton}</div>
                        <div style={{ position: 'absolute', top: 10, right: 12 }}>{favButton}</div>
                    </>
                )}
                {/* Con barra de progreso el título sube para no quedar debajo. */}
                <div style={{
                    position: 'absolute', left: 16, right: 16, bottom: inProgress ? 22 : 16
                }}>
                    {logo ? (
                        <img
                            src={logo}
                            alt={title}
                            loading='lazy'
                            decoding='async'
                            style={{
                                maxWidth: 140, maxHeight: 44, width: 'auto', height: 'auto',
                                objectFit: 'contain', objectPosition: 'left center',
                                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))'
                            }}
                        />
                    ) : (
                        <div style={{
                            fontFamily: T.display, fontSize: 20, lineHeight: 1.05,
                            textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                        }}>
                            {title}
                        </div>
                    )}
                </div>
                {inProgress && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 3 }}>
                        <Progress value={progress} height={3} />
                    </div>
                )}
            </div>
            <div style={{
                marginTop: 10, fontFamily: T.ui, fontSize: 11, color: T.dim,
                letterSpacing: 1, textTransform: 'uppercase'
            }}>
                {caption}
            </div>
        </div>
    );
}
