// Carátula con el logo (o el título) superpuesto abajo y la etiqueta de tipo
// arriba. La usan la búsqueda y el contenido de una lista.
//
// No es `PosterShell`: aquí no hay botones de visto/favorito ni barra de
// progreso, y el item puede no traer ninguna imagen —el buscador incluye el
// catálogo proto—, caso en el que se pinta la inicial centrada.

import { T } from '../../theme/tokens';
import { SelectionMark } from './SelectionMark';
import type { CardInteractions } from './useCardInteractions';

type Props = {
    title: string;
    /** «Serie», «Película», «Episodio»: qué es, arriba a la izquierda. */
    kindLabel: string;
    /** Imagen ya resuelta; sin ella se pinta la inicial del título. */
    cover?: string;
    logo?: string | null;
    /** Clic, clic derecho y estado de selección. */
    interactions: CardInteractions;
};

// Sin React.memo: `interactions` trae el menú y los handlers, que son nuevos
// en cada render, así que memoizar aquí no evitaría ni un repintado. Quien
// tiene props estables y sí memoiza es la tarjeta que la monta.
export function PosterTile({ title, kindLabel, cover, logo, interactions }: Props) {
    const { onClick, onContextMenu, selecting, selected, contextMenu } = interactions;
    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{ cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div style={{
                aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', position: 'relative',
                containerType: 'inline-size',
                background: 'rgba(255,255,255,0.05)',
                // Igual que en PosterShell: el marco no se pinta hasta que se
                // acerca al viewport. Ver la nota larga de allí.
                contentVisibility: 'auto',
                outline: selected ? '3px solid #fff' : undefined,
                outlineOffset: selected ? -3 : undefined
            }}>
                {/* Con `loading='lazy'`, que un fondo CSS no admite: una
                    búsqueda puede devolver la biblioteca entera. */}
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
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))'
                }} />
                <div style={{ position: 'absolute', top: 8, left: 10 }}>
                    {selecting ? <SelectionMark selected={selected} /> : (
                        <span style={{
                            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.55)',
                            background: 'rgba(0,0,0,0.5)',
                            padding: '3px 7px', borderRadius: 4
                        }}>
                            {kindLabel}
                        </span>
                    )}
                </div>
                {!cover && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: T.display, fontSize: 32,
                        color: 'rgba(255,255,255,0.15)'
                    }}>
                        {title?.[0]}
                    </div>
                )}
                {/* El logo va acotado a una caja con alto proporcional fijo
                    (11.9% del alto del póster) y ancho disponible de hasta el
                    86% de la tarjeta para unificar tamaños y escalar en responsive. */}
                {logo ? (
                    <div style={{
                        position: 'absolute',
                        left: '6%',
                        right: '8%',
                        bottom: '5%',
                        height: '11.9%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-start',
                        filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.7))',
                        pointerEvents: 'none'
                    }}>
                        <img
                            src={logo}
                            alt={title}
                            loading='lazy'
                            decoding='async'
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                objectPosition: 'left bottom'
                            }}
                        />
                    </div>
                ) : (
                    // La sombra va como `drop-shadow` del contenedor y no
                    // como `text-shadow` aquí: el recorte a dos líneas
                    // necesita `overflow: hidden`, que cortaría la sombra
                    // en seco y dejaría un rectángulo alrededor del título.
                    <div style={{
                        position: 'absolute',
                        left: '6%',
                        right: '6%',
                        bottom: '5%',
                        maxHeight: '24%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.7))',
                        pointerEvents: 'none'
                    }}>
                        <div style={{
                            fontFamily: T.display,
                            fontSize: 'clamp(11px, 7.5cqi, 15px)',
                            fontWeight: 600,
                            lineHeight: 1.2,
                            color: '#fff',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                        }}>
                            {title}
                        </div>
                    </div>
                )}
            </div>
            {contextMenu}
        </div>
    );
}
