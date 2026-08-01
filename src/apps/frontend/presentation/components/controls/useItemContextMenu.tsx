import { useEffect, useRef, useState } from 'react';

import { MoreButton, type ItemMenuHandle } from './MoreButton';

// Clic derecho sobre una tarjeta: abre el mismo menú que los tres puntos de la
// ficha (reproducir, cola, descargar, editar metadatos, borrar…).
//
// El menú se monta PEREZOSAMENTE, en el primer clic derecho. Montarlo siempre
// costaría un `MoreButton` por tarjeta —con sus suscripciones al reproductor y
// a la sesión— y una rejilla de biblioteca son cien tarjetas: cada cambio del
// contexto del reproductor las repintaría todas para un menú que casi nunca se
// abre. Como en ese primer clic el menú aún no existe, se guardan las
// coordenadas y se abre en cuanto está montado.

type Options = {
    id: string;
    type: 'movie' | 'show' | 'season' | 'episode';
    itemTitle: string;
    queueSubtitle?: string;
    queuePoster?: string;
    nextEpisodeId?: string;
};

export function useItemContextMenu(opts: Options) {
    const handle = useRef<ItemMenuHandle | null>(null);
    const [armed, setArmed] = useState(false);
    const [pending, setPending] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!armed || !pending) return;
        handle.current?.openAt(pending.x, pending.y);
        setPending(null);
    }, [armed, pending]);

    return {
        /** Va en el elemento que debe responder al clic derecho. */
        onContextMenu: (e: React.MouseEvent) => {
            // Sin `preventDefault` saldría el menú del navegador encima.
            e.preventDefault();
            // Para que el clic derecho sobre una tarjeta anidada no abra
            // también el menú de la de fuera.
            e.stopPropagation();
            const point = { x: e.clientX, y: e.clientY };
            if (armed) {
                handle.current?.openAt(point.x, point.y);
            } else {
                setPending(point);
                setArmed(true);
            }
        },
        /** Hay que pintarlo dentro de la tarjeta para que el menú exista. */
        menu: armed ? (
            <MoreButton
                hideTrigger
                handle={handle}
                id={opts.id}
                type={opts.type}
                itemTitle={opts.itemTitle}
                queueSubtitle={opts.queueSubtitle}
                queuePoster={opts.queuePoster}
                nextEpisodeId={opts.nextEpisodeId}
            />
        ) : null
    };
}
