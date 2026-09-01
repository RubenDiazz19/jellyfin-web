import {
    useImperativeHandle, useRef, useState, type RefObject
} from 'react';

import globalize from 'lib/globalize';

import { Ic } from '../../theme/icons';
import { IconButton } from './IconButton';
import { useToast } from '../toast/ToastProvider';
import { useSession } from '../../../domain/bridge/useSession';
import {
    refreshItemMetadata, deleteItem,
    downloadUrl, nativeItemUrl,
    type RefreshOptions
} from '../../../domain/api';
import { MetadataEditor, type EditorKind } from '../admin/editor';
import { RefreshDialog } from '../admin/RefreshDialog';
import { AddToDialog } from './AddToDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ItemMenuList, type MenuItem } from './ItemMenuList';
import { PopupPanel } from './PopupPanel';
import { queueVM } from '../../../domain/viewModels/QueueViewModel';
import { tasksVM } from '../../../domain/viewModels/TasksViewModel';
import { usePlayer } from '../player/PlayerProvider';
import { BottomSheet } from '../m3/BottomSheet';
import { useResponsive } from '../../theme/responsive';

/** Permite abrir el menú desde fuera, en un punto: el clic derecho. */

export type ItemMenuHandle = { openAt: (x: number, y: number) => void };

type ItemKind = 'movie' | 'show' | 'season' | 'episode' | 'collection';

type Props = {
    id: string;
    size?: number;
    /**
     * Sin él se pinta el botón de tres puntos. Con él, el menú existe pero
     * invisible: solo lo abre quien tenga el `handle` — así una tarjeta puede
     * ofrecer el menú por clic derecho sin llenarse de botones.
     */
    handle?: RefObject<ItemMenuHandle | null>;
    hideTrigger?: boolean;
    items?: MenuItem[];
    type?: ItemKind;
    itemTitle?: string;
    // Datos para la cola de reproducción. Sin `itemTitle` no encolamos: la
    // fila de la cola quedaría sin texto.
    queueSubtitle?: string;
    queuePoster?: string;
    // Para series: id del episodio con el que arrancar "Reproducir siguiente
    // episodio" / "Reproducir todo". Si no viene, esas opciones se ocultan.
    nextEpisodeId?: string;
    // Callback personalizado de reproducción aleatoria (para reproducir con el player propio)
    onShuffle?: () => void;
};

// Botón "más opciones" (tres puntos) con menú flotante y editor de metadata
// integrado. Las acciones se ejecutan contra la API real de Jellyfin.
const MENU_W = 260;
/** Alto que se le supone al menú para decidir si abre hacia arriba. */
const MENU_H = 540;
const GAP = 8;

/** Dónde plantar el desplegable para que quepa en pantalla. */
type MenuPos = {
    top?: number; bottom?: number; left?: number; right?: number; maxHeight: number;
};

export function MoreButton({
    id, size = 18, items, type = 'show', itemTitle, nextEpisodeId,
    queueSubtitle, queuePoster, handle, hideTrigger, onShuffle
}: Props) {
    const [open, setOpen] = useState(false);
    const [editor, setEditor] = useState<null | 'metadata' | 'identify' | 'images' | 'subtitles'>(null);
    const [addTo, setAddTo] = useState<null | 'playlist' | 'collection'>(null);
    const [refreshOpen, setRefreshOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const toast = useToast();
    const { session } = useSession();
    const { play } = usePlayer();
    const r = useResponsive();
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

    const openMenu = () => {
        if (open) { setOpen(false); return; }
        // En touch el menú es un bottom sheet: no hay que anclar nada.
        if (!r.touch) {
            const rect = ref.current?.getBoundingClientRect();
            // Colgando del botón, separado de él y alineado a su derecha.
            if (rect) {
                setMenuPos({
                    ...verticalPlacement(rect.bottom, rect.top, GAP),
                    right: Math.max(12, window.innerWidth - rect.right)
                });
            }
        }
        setOpen(true);
    };

    /**
     * Abre el menú donde se ha pulsado, para el clic derecho sobre una
     * tarjeta. En touch no hay clic derecho: el bottom sheet se abre igual y
     * la posición da lo mismo.
     */
    const openAt = (x: number, y: number) => {
        if (!r.touch) {
            setMenuPos({
                // Sin separación: un menú contextual sale pegado al puntero.
                ...verticalPlacement(y, y, 0),
                // Se voltea al otro lado del cursor si no cabe a la derecha.
                left: Math.min(x, window.innerWidth - MENU_W - 12)
            });
        }
        setOpen(true);
    };

    useImperativeHandle(handle, () => ({ openAt }));

    // -------- handlers reales --------
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

    // -------- construcción de menús --------
    const t = (key: string) => globalize.translate(key);
    const canQueue = !!queueableId && !!itemTitle;

    /** Mandar a la cola: idéntico para los cuatro tipos. */
    const queueing: MenuItem[] = [
        { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
        { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue }
    ];

    /**
     * El bloque de edición, que cierra los cuatro menús. Lo que cambia entre
     * tipos es solo qué existe para cada uno: una temporada no se identifica
     * por sí sola (se hace desde la serie) y un episodio no tiene imágenes
     * propias que valga la pena editar aquí.
     */
    const editing = (has: { identify?: boolean; images?: boolean; subtitles?: boolean }): MenuItem[] => [
        ...(has.identify ? [{ label: t('Identify'), fn: () => setEditor('identify') }] : []),
        { label: t('RefreshMetadata'), fn: () => setRefreshOpen(true) },
        { label: t('EditMetadata'), fn: () => setEditor('metadata') },
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

    const menuByType: Record<ItemKind, MenuItem[]> = {
        movie: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            ...queueing,
            // Sin «añadir a lista/colección»: de eso se encarga el botón
            // «Mi lista» de la ficha, que además enseña de un vistazo si el
            // título ya está en alguna y permite marcar varias a la vez.
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
            ...queueing,
            { isDivider: true },
            ...editing({ identify: true, images: true })
        ],
        season: [
            ...continueEntries,
            { isDivider: true },
            ...queueing,
            { label: t('AddToPlaylist'), fn: () => setAddTo('playlist') },
            { label: t('AddToCollection'), fn: () => setAddTo('collection') },
            { isDivider: true },
            ...editing({ images: true })
        ],
        episode: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            ...queueing,
            { label: t('AddToPlaylist'), fn: () => setAddTo('playlist') },
            { isDivider: true },
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            ...editing({ identify: true, subtitles: true })
        ],
        collection: [
            { label: t('AddToCollection'), fn: () => setAddTo('collection') },
            { isDivider: true },
            ...editing({ identify: true, images: true })
        ]
    };

    const menu = items ?? (isReal ? menuByType[type] : legacyMenu(toast));
    const close = () => setOpen(false);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
            {!hideTrigger && (
                <IconButton onClick={openMenu} ariaLabel={globalize.translate('ButtonMore')} active={open}>
                    <Ic.Dots size={size} />
                </IconButton>
            )}
            {/* Touch: bottom sheet M3 (spec 4.3). Desktop: popup anclado. */}
            {open && r.touch && (
                <BottomSheet title={itemTitle} onClose={close}>
                    <ItemMenuList items={menu} sheet onPick={close} />
                </BottomSheet>
            )}
            {open && !r.touch && menuPos && (
                <PopupPanel
                    open={open}
                    onClose={close}
                    position={menuPos}
                    minWidth={MENU_W}
                >
                    <ItemMenuList items={menu} onPick={close} />
                </PopupPanel>
            )}

            {editor && (

                <MetadataEditor
                    itemId={id}
                    kind={type as EditorKind}
                    initialTab={editor}
                    onClose={() => setEditor(null)}
                />
            )}
            {addTo && (
                <AddToDialog
                    kind={addTo}
                    itemId={id}
                    itemTitle={itemTitle}
                    onClose={() => setAddTo(null)}
                />
            )}
            {refreshOpen && (
                <RefreshDialog
                    subject={itemTitle ?? ''}
                    onRefresh={doRefresh}
                    onClose={() => setRefreshOpen(false)}
                />
            )}
            {confirmDelete && (
                <ConfirmDialog
                    title={itemTitle ?
                        globalize.translate('ConfirmDeleteTitle', itemTitle) :
                        globalize.translate('HeaderDeleteItem')}
                    message={globalize.translate('ConfirmDeleteItem')}
                    confirmLabel={globalize.translate('Delete')}
                    onConfirm={doDelete}
                    onClose={() => setConfirmDelete(false)}
                />
            )}
        </div>
    );
}

/**
 * Si el menú cae del borde inferior, se ancla por arriba y crece hacia el
 * otro lado. `below` es desde dónde colgaría y `above` hasta dónde llegaría
 * al voltearse: son el mismo punto en el clic derecho y los dos bordes del
 * botón cuando cuelga de él.
 */
function verticalPlacement(below: number, above: number, gap: number): Omit<MenuPos, 'left' | 'right'> {
    const dropUp = below + MENU_H + gap > window.innerHeight;
    return {
        top: dropUp ? undefined : below + gap,
        bottom: dropUp ? window.innerHeight - above + gap : undefined,
        maxHeight: dropUp ? above - gap - 12 : window.innerHeight - below - gap - 12
    };
}

// Menú antiguo (modo prototipo sin sesión Jellyfin) — solo toasts. Se
// mantiene para no romper demos sin backend.
function legacyMenu(toast: ReturnType<typeof useToast>): MenuItem[] {
    const label = globalize.translate('Download');
    return [
        { label, fn: () => toast(globalize.translate('MessageNotConnected', label), 'info') }
    ];
}
