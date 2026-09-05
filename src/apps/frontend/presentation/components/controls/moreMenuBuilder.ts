import globalize from 'lib/globalize';

import type { MenuItem } from './ItemMenuList';
import type { SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import type { AddToKind, EditorTab, ItemKind } from './useItemActions';
import type { useToast } from '../toast/ToastProvider';

type BuildMoreMenuItemsOptions = {
    type: ItemKind;
    isReal: boolean;
    items?: MenuItem[];
    selectable?: SelectableItem;
    isSelected: boolean;
    canQueue: boolean;
    nextEpisodeId?: string;
    onShuffle?: () => void;
    toast: ReturnType<typeof useToast>;
    doPlay: (opts?: { fromStart?: boolean }) => void;
    doPlayNextEpisode: () => void;
    doQueue: (position: 'next' | 'last') => void;
    openNative: (targetId?: string, extra?: string) => void;
    doDownload: () => void;
    doSelect: () => void;
    setEditor: (tab: EditorTab | null) => void;
    setAddTo: (kind: AddToKind | null) => void;
    setRefreshOpen: (open: boolean) => void;
    setTagsOpen: (open: boolean) => void;
    setConfirmDelete: (open: boolean) => void;
};

/**
 * Menú antiguo (modo prototipo sin sesión Jellyfin) — solo toasts. Se
 * mantiene para no romper demos sin backend.
 */
function legacyMenu(toast: ReturnType<typeof useToast>): MenuItem[] {
    const label = globalize.translate('Download');
    return [
        { label, fn: () => toast(globalize.translate('MessageNotConnected', label), 'info') }
    ];
}

/**
 * Construye la lista de opciones para el menú contextual o desplegable
 * en función del tipo de item (movie, show, season, episode, collection) y los permisos.
 */
export function buildMoreMenuItems({
    type,
    isReal,
    items,
    selectable,
    isSelected,
    canQueue,
    nextEpisodeId,
    onShuffle,
    toast,
    doPlay,
    doPlayNextEpisode,
    doQueue,
    openNative,
    doDownload,
    doSelect,
    setEditor,
    setAddTo,
    setRefreshOpen,
    setTagsOpen,
    setConfirmDelete
}: BuildMoreMenuItemsOptions): MenuItem[] {
    const t = (key: string) => globalize.translate(key);

    /** Mandar a la cola: idéntico para los cuatro tipos. */
    const queueing: MenuItem[] = [
        { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
        { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue }
    ];

    /**
     * El bloque de edición, que cierra los cuatro menús. Lo que cambia entre
     * tipos es solo qué existe para cada uno.
     */
    const editing = (has: { identify?: boolean; images?: boolean; subtitles?: boolean; tags?: boolean }): MenuItem[] => [
        ...(has.identify ? [{ label: t('Identify'), fn: () => setEditor('identify') }] : []),
        { label: t('RefreshMetadata'), fn: () => setRefreshOpen(true) },
        { label: t('EditMetadata'), fn: () => setEditor('metadata') },
        ...(has.tags !== false ? [{ label: t('EditTags'), fn: () => setTagsOpen(true) }] : []),
        ...(has.images ? [{ label: t('EditImages'), fn: () => setEditor('images') }] : []),
        ...(has.subtitles ? [{ label: t('EditSubtitles'), fn: () => setEditor('subtitles') }] : []),
        { isDivider: true },
        { label: t('Delete'), fn: () => setConfirmDelete(true), danger: true }
    ];

    /** Series y temporadas arrancan por el episodio que toca, no por sí mismas. */
    const continueEntries: MenuItem[] = nextEpisodeId ? [
        { label: t('PlayNextEpisode'), fn: doPlayNextEpisode },
        { label: t('HeaderPlayAll'), fn: doPlayNextEpisode }
    ] : [];

    const selectItem: MenuItem[] = selectable ? [
        {
            label: t(isSelected ? 'ClearSelection' : 'Select'),
            fn: doSelect
        }
    ] : [];

    const menuByType: Record<ItemKind, MenuItem[]> = {
        movie: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            ...selectItem,
            ...queueing,
            { isDivider: true },
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            ...editing({ identify: true, images: true, subtitles: true })
        ],
        show: [
            ...continueEntries,
            ...(onShuffle ?
                [{ label: t('ShufflePlay') || t('Shuffle'), fn: onShuffle }] :
                [{ label: t('Shuffle'), fn: () => openNative(undefined, '&shuffle=true') }]),
            { isDivider: true },
            ...selectItem,
            ...queueing,
            { isDivider: true },
            ...editing({ identify: true, images: true })
        ],
        season: [
            ...continueEntries,
            { isDivider: true },
            ...selectItem,
            ...queueing,
            { label: t('AddToPlaylist'), fn: () => setAddTo('playlist') },
            { label: t('AddToCollection'), fn: () => setAddTo('collection') },
            { isDivider: true },
            ...editing({ images: true, tags: false })
        ],
        episode: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            ...selectItem,
            ...queueing,
            { label: t('AddToPlaylist'), fn: () => setAddTo('playlist') },
            { isDivider: true },
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            ...editing({ identify: true, subtitles: true })
        ],
        collection: [
            ...selectItem,
            { label: t('AddToCollection'), fn: () => setAddTo('collection') },
            { isDivider: true },
            ...editing({ identify: true, images: true })
        ]
    };

    return items ?? (isReal ? menuByType[type] : [...selectItem, ...legacyMenu(toast)]);
}
