// Todo lo que hace una tarjeta de catálogo cuando la tocas: clic (navegar o
// marcar, según el modo selección) y clic derecho (menú del item).
//
// Las cuatro tarjetas —serie, película en fila, película en rejilla y
// resultado de búsqueda— montaban exactamente el mismo par de hooks con los
// mismos argumentos derivados del item. Aquí además vive la única regla que
// se repetía a mano en las cuatro: a qué ficha lleva cada tipo.

import type { MouseEvent, ReactNode } from 'react';
import type { Navigate } from '../../../app/router';
import type { SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import { useSelectionMode } from '../controls/useSelectionMode';

export type CardKind = 'show' | 'movie' | 'season' | 'episode';

/** Lo que hace falta del item para navegar a su ficha y para encolarlo. */
export type CardItem = {
    id: string;
    title: string;
    kind: CardKind;
    year?: number | string;
    poster?: string;
    watchedKey?: string;
    /** Navegación específica de season/episode */
    showId?: string;
    seasonN?: number;
    epN?: number;
    nextEpisodeId?: string;
    queueSubtitle?: string;
    queuePoster?: string;
    onOpen?: () => void;
};

export type CardInteractions = {
    onClick: () => void;
    selecting: boolean;
    selected: boolean;
    onContextMenu: (e: MouseEvent) => void;
    /** Hay que pintarlo dentro de la tarjeta para que el menú exista. */
    contextMenu: ReactNode;
};

export function useCardInteractions(item: CardItem, navigate: Navigate): CardInteractions {
    const selectable: SelectableItem = {
        id: item.id,
        title: item.title,
        kind: item.kind,
        poster: item.poster,
        year: item.year,
        watchedKey: item.watchedKey
    };

    const onOpen = () => {
        if (item.onOpen) {
            item.onOpen();
            return;
        }
        if (item.kind === 'show') {
            navigate({ page: 'show', showId: item.id });
        } else if (item.kind === 'movie') {
            navigate({ page: 'movie', movieId: item.id });
        } else if (item.kind === 'season' && item.showId && item.seasonN != null) {
            navigate({ page: 'season', showId: item.showId, seasonN: item.seasonN });
        } else if (item.kind === 'episode' && item.showId && item.seasonN != null && item.epN != null) {
            navigate({ page: 'episode', showId: item.showId, seasonN: item.seasonN, epN: item.epN });
        }
    };

    const sel = useSelectionMode(selectable, onOpen);

    const ctx = useItemContextMenu({
        id: item.id,
        type: item.kind,
        itemTitle: item.title,
        nextEpisodeId: item.nextEpisodeId,
        queueSubtitle: item.queueSubtitle ?? (item.year ? String(item.year) : undefined),
        queuePoster: item.queuePoster ?? item.poster,
        selectable
    });

    return {
        onClick: sel.onClick,
        selecting: sel.selecting,
        selected: sel.selected,
        onContextMenu: ctx.onContextMenu,
        contextMenu: ctx.menu
    };
}
