// Carátula con el logo (o el título) superpuesto abajo y la etiqueta de tipo
// arriba. La usan la búsqueda y el contenido de una lista.
//
// No es `PosterShell`: aquí no hay botones de visto/favorito ni barra de
// progreso, y el item puede no traer ninguna imagen —el buscador incluye el
// catálogo proto—, caso en el que se pinta la inicial centrada.

import { PosterShell } from './PosterShell';
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
        <PosterShell
            variant='tile'
            title={title}
            kindLabel={kindLabel}
            cover={cover}
            logo={logo}
            onClick={onClick}
            onContextMenu={onContextMenu}
            selecting={selecting}
            selected={selected}
            contextMenu={contextMenu}
        />
    );
}

