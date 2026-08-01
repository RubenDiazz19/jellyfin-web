// Todo lo que hace una tarjeta de catálogo cuando la tocas: clic (navegar o
// marcar, según el modo selección) y clic derecho (menú del item).
//
// Las cuatro tarjetas —serie, película en fila, película en rejilla y
// resultado de búsqueda— montaban exactamente el mismo par de hooks con los
// mismos argumentos derivados del item. Aquí además vive la única regla que
// se repetía a mano en las cuatro: a qué ficha lleva cada tipo.

import type { MouseEvent, ReactNode } from 'react';
import type { Navigate } from '../../../app/router';
import type { CatalogItem } from '../../../domain/models';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import { useSelectionMode } from '../controls/useSelectionMode';

/** Lo que hace falta del item para navegar a su ficha y para encolarlo. */
export type CardItem = Pick<CatalogItem, 'id' | 'title' | 'kind' | 'year' | 'poster'>;

export type CardInteractions = {
    onClick: () => void;
    selecting: boolean;
    selected: boolean;
    onContextMenu: (e: MouseEvent) => void;
    /** Hay que pintarlo dentro de la tarjeta para que el menú exista. */
    contextMenu: ReactNode;
};

export function useCardInteractions(item: CardItem, navigate: Navigate): CardInteractions {
    const sel = useSelectionMode(
        {
            id: item.id,
            title: item.title,
            kind: item.kind,
            poster: item.poster,
            year: item.year
        },
        () => navigate(item.kind === 'show' ?
            { page: 'show', showId: item.id } :
            { page: 'movie', movieId: item.id })
    );
    const ctx = useItemContextMenu({
        id: item.id,
        type: item.kind,
        itemTitle: item.title,
        queueSubtitle: String(item.year),
        queuePoster: item.poster
    });
    return {
        onClick: sel.onClick,
        selecting: sel.selecting,
        selected: sel.selected,
        onContextMenu: ctx.onContextMenu,
        contextMenu: ctx.menu
    };
}
