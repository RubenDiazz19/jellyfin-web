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
    setConfirmDelete
}: BuildMoreMenuItemsOptions): MenuItem[] {
    const t = (key: string) => globalize.translate(key);

    /** Mandar a la cola: idéntico para los cuatro tipos. */
    const queueing: MenuItem[] = [
        { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
        { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue }
    ];

    /**
     * Gestión y mantenimiento: edición integral de metadatos (que reúne
     * metadatos, identificar, refresco desde proveedores, imágenes, subtítulos
     * y etiquetas en una sola ventana con pestañas).
     */
    const management: MenuItem[] = [
        { label: t('EditMetadata'), fn: () => setEditor('metadata') },
        { isDivider: true },
        { label: t('Delete'), fn: () => setConfirmDelete(true), danger: true }
    ];

    /** Añadir a listas de reproducción o colecciones (diálogo unificado con pestañas). */
    const addToList: MenuItem[] = [
        { label: t('AddTo'), fn: () => setAddTo('playlist') }
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
            ...queueing,
            { isDivider: true },
            ...addToList,
            ...selectItem,
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            ...management
        ],
        show: [
            ...continueEntries,
            ...(onShuffle ?
                [{ label: t('ShufflePlay') || t('Shuffle'), fn: onShuffle }] :
                [{ label: t('Shuffle'), fn: () => openNative(undefined, '&shuffle=true') }]),
            ...queueing,
            { isDivider: true },
            ...addToList,
            ...selectItem,
            { isDivider: true },
            ...management
        ],
        season: [
            ...continueEntries,
            ...queueing,
            { isDivider: true },
            ...addToList,
            ...selectItem,
            { isDivider: true },
            ...management
        ],
        episode: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            ...queueing,
            { isDivider: true },
            ...addToList,
            ...selectItem,
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            ...management
        ],
        collection: [
            ...addToList,
            ...selectItem,
            { isDivider: true },
            ...management
        ]
    };

    return items ?? (isReal ? menuByType[type] : [...selectItem, ...legacyMenu(toast)]);
}
