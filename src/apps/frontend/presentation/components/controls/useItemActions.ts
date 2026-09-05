import { useState } from 'react';
import globalize from 'lib/globalize';

import { useToast } from '../toast/ToastProvider';
import { useSession } from '../../../domain/bridge/useSession';
import { usePlayer } from '../player/PlayerProvider';
import { queueVM } from '../../../domain/viewModels/QueueViewModel';
import { tasksVM } from '../../../domain/viewModels/TasksViewModel';
import { selectionVM, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { useSignalSelector } from '../../../domain/bridge/useViewModel';
import {
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl,
    type RefreshOptions
} from '../../../domain/api';

export type ItemKind = 'movie' | 'show' | 'season' | 'episode' | 'collection';
export type EditorTab = 'metadata' | 'identify' | 'images' | 'subtitles';
export type AddToKind = 'playlist' | 'collection';

type UseItemActionsOptions = {
    id: string;
    type?: ItemKind;
    itemTitle?: string;
    queueSubtitle?: string;
    queuePoster?: string;
    nextEpisodeId?: string;
    selectable?: SelectableItem;
    onSelect?: () => void;
};

/**
 * Hook que encapsula el estado de diálogos y los manejadores de acción de un item:
 * reproducción, cola, refresco de metadatos, borrado, descarga y selección.
 */
export function useItemActions({
    id,
    type = 'show',
    itemTitle,
    queueSubtitle,
    queuePoster,
    nextEpisodeId,
    selectable,
    onSelect
}: UseItemActionsOptions) {
    const [editor, setEditor] = useState<EditorTab | null>(null);
    const [addTo, setAddTo] = useState<AddToKind | null>(null);
    const [refreshOpen, setRefreshOpen] = useState(false);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const toast = useToast();
    const { session } = useSession();
    const { play } = usePlayer();
    const isReal = !!session?.accessToken;

    const doPlay = (opts: { fromStart?: boolean } = {}) => {
        play({
            itemId: id,
            title: itemTitle,
            startTicks: opts.fromStart ? 0 : undefined
        });
    };

    const doPlayNextEpisode = () => {
        if (!nextEpisodeId) return;
        play({ itemId: nextEpisodeId, title: itemTitle });
    };

    // Series y temporadas no son reproducibles por sí mismas: se encola el
    // episodio con el que arrancarían.
    const queueableId = type === 'show' || type === 'season' ? nextEpisodeId : id;
    const canQueue = !!queueableId && !!itemTitle;

    const doQueue = (position: 'next' | 'last') => {
        if (!queueableId || !itemTitle) return;
        const entry = {
            itemId: queueableId,
            title: itemTitle,
            subtitle: queueSubtitle,
            poster: queuePoster
        };
        if (position === 'next') queueVM.playNext(entry);
        else queueVM.enqueue(entry);
        toast(globalize.translate(
            position === 'next' ? 'MessageAddedToQueueNext' : 'MessageAddedToQueue'
        ), 'success');
    };

    const label = itemTitle ? ` · ${itemTitle}` : '';

    const doRefresh = async (options: RefreshOptions) => {
        try {
            await refreshItemMetadata(id, options);
            // Refrescar una serie entera tarda; sin esto el aviso era todo lo
            // que el usuario llegaba a ver del proceso.
            tasksVM.expect(id, itemTitle ?? '');
            toast(globalize.translate('MessageRefreshQueued'), 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
            // Que la caja siga abierta: no se ha llegado a lanzar nada.
            throw e;
        }
    };

    // La confirmación la lleva el diálogo (ver ConfirmDialog): aquí solo se
    // borra. Se relanza el error para que el diálogo sepa que no debe cerrarse
    // sobre un item que sigue existiendo.
    const doDelete = async () => {
        try {
            await deleteItem(id);
            toast(globalize.translate('Deleted') + label, 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
            throw e;
        }
    };

    const openNative = (targetId?: string, extra = '') => {
        const url = nativeItemUrl(targetId ?? id) + extra;
        if (!url) return toast(globalize.translate('MessageServerUrlUnavailable'), 'warn');
        window.open(url, '_blank', 'noopener');
    };

    const doDownload = () => {
        const url = downloadUrl(id);
        if (!url) return toast(globalize.translate('MessageDownloadUrlUnavailable'), 'warn');
        // Un <a download> es más fiable que window.open (fuerza el guardado en
        // vez de que el browser abra el mkv como reproducción inline).
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const isSelected = useSignalSelector(
        selectionVM.selectedIds,
        (ids) => (selectable ? ids.has(selectable.id) : false)
    );

    const doSelect = () => {
        if (!selectable) return;
        if (onSelect) {
            onSelect();
        } else if (!selectionVM.selecting.value) {
            selectionVM.start(selectable);
        } else {
            selectionVM.toggle(selectable);
        }
    };

    return {
        // Estado de diálogos
        editor,
        setEditor,
        addTo,
        setAddTo,
        refreshOpen,
        setRefreshOpen,
        tagsOpen,
        setTagsOpen,
        confirmDelete,
        setConfirmDelete,
        // Contexto
        isReal,
        canQueue,
        isSelected,
        toast,
        // Acciones
        doPlay,
        doPlayNextEpisode,
        doQueue,
        doRefresh,
        doDelete,
        openNative,
        doDownload,
        doSelect
    };
}
