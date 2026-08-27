// Carátula con el logo (o el título) superpuesto abajo y la etiqueta de tipo
// arriba. La usan la búsqueda y el contenido de una lista.
//
// No es `PosterShell`: aquí no hay botones de visto/favorito ni barra de
// progreso, y el item puede no traer ninguna imagen —el buscador incluye el
// catálogo proto—, caso en el que se pinta la inicial centrada.

import { T } from '../../theme/tokens';
import { CardOverlay } from './CardOverlay';
import { PosterFrame } from './PosterFrame';
import { PosterOverlay } from './PosterOverlay';
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
            <PosterFrame borderRadius={8} selected={selected}>
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
                <CardOverlay
                    top={8}
                    left={10}
                    topLeft={selecting ? <SelectionMark selected={selected} /> : (
                        <span style={{
                            fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.55)',
                            background: 'rgba(0,0,0,0.5)',
                            padding: '3px 7px', borderRadius: 4
                        }}>
                            {kindLabel}
                        </span>
                    )}
                />
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
                <PosterOverlay
                    logo={logo}
                    title={title}
                    fontSize='clamp(11px, 7.5cqi, 15px)'
                    fontWeight={600}
                />
            </PosterFrame>
            {contextMenu}
        </div>
    );
}

