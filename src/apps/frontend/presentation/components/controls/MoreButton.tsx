import {
    useEffect, useImperativeHandle, useRef, useState, type ReactNode, type RefObject
} from 'react';
import ReactDOM from 'react-dom';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { IconButton } from './IconButton';
import { useToast } from '../toast/ToastProvider';
import { useSession } from '../../../domain/bridge/useSession';
import {
    refreshItemMetadata, deleteItem,
    downloadUrl, nativeItemUrl
} from '../../../domain/api';
import { MetadataEditor, type EditorKind } from '../admin/editor';
import { AddToDialog } from './AddToDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { TagsDialog } from './TagsDialog';
import { knownTags } from '../../../domain/viewModels/knownTags';
import { queueVM } from '../../../domain/viewModels/QueueViewModel';
import { tasksVM } from '../../../domain/viewModels/TasksViewModel';
import { usePlayer } from '../player/PlayerProvider';
import { BottomSheet } from '../m3/BottomSheet';
import { useResponsive } from '../../theme/responsive';

type MenuItem =
  | { isDivider: true }
  | { isCustom: true; component: ReactNode }
  | { label: string; fn: () => void; danger?: boolean; disabled?: boolean };

/** Permite abrir el menú desde fuera, en un punto: el clic derecho. */
export type ItemMenuHandle = { openAt: (x: number, y: number) => void };

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
    type?: 'movie' | 'show' | 'season' | 'episode';
    itemTitle?: string;
    // Datos para la cola de reproducción. Sin `itemTitle` no encolamos: la
    // fila de la cola quedaría sin texto.
    queueSubtitle?: string;
    queuePoster?: string;
    // Para series: id del episodio con el que arrancar "Reproducir siguiente
    // episodio" / "Reproducir todo". Si no viene, esas opciones se ocultan.
    nextEpisodeId?: string;
};

// Botón "más opciones" (tres puntos) con menú flotante y editor de metadata
// integrado. Las acciones se ejecutan contra la API real de Jellyfin.
const MENU_W = 260;

export function MoreButton({
    id, size = 18, items, type = 'show', itemTitle, nextEpisodeId,
    queueSubtitle, queuePoster, handle, hideTrigger
}: Props) {
    const [open, setOpen] = useState(false);
    const [editor, setEditor] = useState<null | 'metadata' | 'identify' | 'images' | 'subtitles'>(null);
    const [addTo, setAddTo] = useState<null | 'playlist' | 'collection'>(null);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [menuPos, setMenuPos] = useState<{
        top?: number; bottom?: number; left?: number; right?: number; maxHeight: number;
    } | null>(null);
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

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const openMenu = () => {
        if (open) { setOpen(false); return; }
        // En touch el menú es un bottom sheet: no hay que anclar nada.
        if (!r.touch) {
            const rect = ref.current?.getBoundingClientRect();
            if (rect) {
                const MENU_H = 540;
                const GAP = 8;
                const dropUp = rect.bottom + MENU_H + GAP > window.innerHeight;
                setMenuPos({
                    top: dropUp ? undefined : rect.bottom + GAP,
                    bottom: dropUp ? window.innerHeight - rect.top + GAP : undefined,
                    right: Math.max(12, window.innerWidth - rect.right),
                    maxHeight: dropUp ? rect.top - GAP - 12 : window.innerHeight - rect.bottom - GAP - 12
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
            const MENU_H = 540;
            const dropUp = y + MENU_H > window.innerHeight;
            setMenuPos({
                top: dropUp ? undefined : y,
                bottom: dropUp ? window.innerHeight - y : undefined,
                // Se voltea al otro lado del cursor si no cabe a la derecha.
                left: Math.min(x, window.innerWidth - MENU_W - 12),
                maxHeight: dropUp ? y - 12 : window.innerHeight - y - 12
            });
        }
        setOpen(true);
    };

    useImperativeHandle(handle, () => ({ openAt }));

    // -------- handlers reales --------
    const label = itemTitle ? ` · ${itemTitle}` : '';

    const doRefresh = async () => {
        try {
            await refreshItemMetadata(id);
            // Refrescar una serie entera tarda; sin esto el aviso era todo lo
            // que el usuario llegaba a ver del proceso.
            tasksVM.expect(id, itemTitle ?? '');
            toast(globalize.translate('MessageRefreshQueued'), 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
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

    const menuByType: Record<'movie' | 'show' | 'season' | 'episode', MenuItem[]> = {
        movie: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
            { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue },
            // Sin «añadir a lista/colección»: de eso se encarga el botón
            // «Mi lista» de la ficha, que además enseña de un vistazo si el
            // título ya está en alguna y permite marcar varias a la vez.
            { isDivider: true },
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            { label: t('Identify'), fn: () => setEditor('identify') },
            { label: t('RefreshMetadata'), fn: doRefresh },
            { label: t('EditMetadata'), fn: () => setEditor('metadata') },
            { label: t('EditTags'), fn: () => setTagsOpen(true) },
            { label: t('EditImages'), fn: () => setEditor('images') },
            { label: t('EditSubtitles'), fn: () => setEditor('subtitles') },
            { isDivider: true },
            { label: t('Delete'), fn: () => setConfirmDelete(true), danger: true }
        ],
        show: [
            ...(nextEpisodeId ? [
                { label: t('PlayNextEpisode'), fn: doPlayNextEpisode },
                { label: t('HeaderPlayAll'), fn: doPlayNextEpisode }
            ] : []),
            { label: t('Shuffle'), fn: () => openNative(undefined, '&shuffle=true') },
            { isDivider: true },
            { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
            { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue },
            // Sin «añadir a lista/colección»: de eso se encarga el botón
            // «Mi lista» de la ficha, que además enseña de un vistazo si el
            // título ya está en alguna y permite marcar varias a la vez.
            { isDivider: true },
            { label: t('Identify'), fn: () => setEditor('identify') },
            { label: t('RefreshMetadata'), fn: doRefresh },
            { label: t('EditMetadata'), fn: () => setEditor('metadata') },
            { label: t('EditTags'), fn: () => setTagsOpen(true) },
            { label: t('EditImages'), fn: () => setEditor('images') },
            { isDivider: true },
            { label: t('Delete'), fn: () => setConfirmDelete(true), danger: true }
        ],
        season: [
            ...(nextEpisodeId ? [
                { label: t('PlayNextEpisode'), fn: doPlayNextEpisode },
                { label: t('HeaderPlayAll'), fn: doPlayNextEpisode }
            ] : []),
            { isDivider: true },
            { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
            { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue },
            { label: t('AddToPlaylist'), fn: () => setAddTo('playlist') },
            { label: t('AddToCollection'), fn: () => setAddTo('collection') },
            { isDivider: true },
            // Sin "Identificar…": las temporadas no tienen búsqueda remota
            // propia en Jellyfin, se identifican desde la serie.
            { label: t('RefreshMetadata'), fn: doRefresh },
            { label: t('EditMetadata'), fn: () => setEditor('metadata') },
            { label: t('EditTags'), fn: () => setTagsOpen(true) },
            { label: t('EditImages'), fn: () => setEditor('images') },
            { isDivider: true },
            { label: t('Delete'), fn: () => setConfirmDelete(true), danger: true }
        ],
        episode: [
            { label: t('PlayFromBeginning'), fn: () => doPlay({ fromStart: true }) },
            { label: t('PlayNextInQueue'), fn: () => doQueue('next'), disabled: !canQueue },
            { label: t('AddToQueue'), fn: () => doQueue('last'), disabled: !canQueue },
            { label: t('AddToPlaylist'), fn: () => setAddTo('playlist') },
            { isDivider: true },
            { label: t('Download'), fn: doDownload },
            { isDivider: true },
            { label: t('Identify'), fn: () => setEditor('identify') },
            { label: t('RefreshMetadata'), fn: doRefresh },
            { label: t('EditMetadata'), fn: () => setEditor('metadata') },
            { label: t('EditTags'), fn: () => setTagsOpen(true) },
            { label: t('EditSubtitles'), fn: () => setEditor('subtitles') },
            { isDivider: true },
            { label: t('Delete'), fn: () => setConfirmDelete(true), danger: true }
        ]
    };

    const menu = items ?? (isReal ? menuByType[type] : legacyMenu(toast));

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
            {!hideTrigger && (
                <IconButton onClick={openMenu} ariaLabel={globalize.translate('ButtonMore')} active={open}>
                    <Ic.Dots size={size} />
                </IconButton>
            )}
            {/* Touch: bottom sheet M3 (spec 4.3). Desktop: popup anclado. */}
            {open && r.touch && (
                <BottomSheet title={itemTitle} onClose={() => setOpen(false)}>
                    {menu.map((it, i) =>
                        'isDivider' in it ? (
                            <div key={i} style={{
                                height: 1, margin: '6px 16px',
                                background: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.08))'
                            }} />
                        ) : 'isCustom' in it ? (
                            <div key={i}>{it.component}</div>
                        ) : (
                            <button
                                key={i}
                                data-ripple
                                onClick={(e) => { e.stopPropagation(); it.fn(); setOpen(false); }}
                                disabled={it.disabled}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    background: 'none', border: 'none',
                                    color: it.disabled ? 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.35))' :
                                        it.danger ? 'var(--md-sys-color-error, #ff6b6b)' :
                                            'var(--md-sys-color-on-surface, #fff)',
                                    cursor: it.disabled ? 'not-allowed' : 'pointer',
                                    minHeight: 48, padding: '12px 16px',
                                    fontSize: 15, fontFamily: T.ui,
                                    borderRadius: 'var(--md-sys-shape-corner-large, 16px)'
                                }}
                            >
                                {it.label}
                            </button>
                        )
                    )}
                </BottomSheet>
            )}
            {open && !r.touch && menuPos && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: menuPos.top, bottom: menuPos.bottom,
                        left: menuPos.left, right: menuPos.right,
                        maxHeight: menuPos.maxHeight, overflowY: 'auto', zIndex: 9999,
                        minWidth: MENU_W,
                        background: 'rgba(18,18,20,0.96)', backdropFilter: 'blur(14px)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6,
                        boxShadow: '0 18px 50px rgba(0,0,0,0.6)', fontFamily: T.ui
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {menu.map((it, i) =>
                        'isDivider' in it ? (
                            <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
                        ) : 'isCustom' in it ? (
                            <div key={i}>{it.component}</div>
                        ) : (
                            <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); it.fn(); setOpen(false); }}
                                disabled={it.disabled}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', background: 'none',
                                    border: 'none',
                                    color: it.disabled ? 'rgba(255,255,255,0.35)' :
                                        it.danger ? '#ff6b6b' : '#fff',
                                    cursor: it.disabled ? 'not-allowed' : 'pointer',
                                    padding: '11px 12px',
                                    fontSize: 14, borderRadius: 8, fontFamily: T.ui, letterSpacing: 0.1,
                                    transition: 'background .15s'
                                }}
                                onMouseEnter={(e) => {
                                    if (it.disabled) return;
                                    e.currentTarget.style.background = it.danger ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.08)';
                                }}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {it.label}
                            </button>
                        )
                    )}
                </div>,
                document.body
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
            {tagsOpen && (
                <TagsDialog
                    itemId={id}
                    itemTitle={itemTitle}
                    suggestions={knownTags()}
                    onClose={() => setTagsOpen(false)}
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

// Menú antiguo (modo prototipo sin sesión Jellyfin) — solo toasts. Se
// mantiene para no romper demos sin backend.
function legacyMenu(toast: ReturnType<typeof useToast>): MenuItem[] {
    const label = globalize.translate('Download');
    return [
        { label, fn: () => toast(globalize.translate('MessageNotConnected', label), 'info') }
    ];
}
