import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
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
import { usePlayer } from '../player/PlayerProvider';
import { BottomSheet } from '../m3/BottomSheet';
import { useResponsive } from '../../theme/responsive';

type MenuItem =
  | { isDivider: true }
  | { isCustom: true; component: ReactNode }
  | { label: string; fn: () => void; danger?: boolean; disabled?: boolean };

type Props = {
    id: string;
    size?: number;
    items?: MenuItem[];
    type?: 'movie' | 'show' | 'season' | 'episode';
    itemTitle?: string;
    // Para series: id del episodio con el que arrancar "Reproducir siguiente
    // episodio" / "Reproducir todo". Si no viene, esas opciones se ocultan.
    nextEpisodeId?: string;
};

// Botón "más opciones" (tres puntos) con menú flotante y editor de metadata
// integrado. Las acciones se ejecutan contra la API real de Jellyfin.
export function MoreButton({
    id, size = 18, items, type = 'show', itemTitle, nextEpisodeId
}: Props) {
    const [open, setOpen] = useState(false);
    const [editor, setEditor] = useState<null | 'metadata' | 'identify' | 'images' | 'subtitles'>(null);
    const [addTo, setAddTo] = useState<null | 'playlist' | 'collection'>(null);
    const [menuPos, setMenuPos] = useState<{
        top?: number; bottom?: number; right: number; maxHeight: number;
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

    // -------- handlers reales --------
    const label = itemTitle ? ` · ${itemTitle}` : '';

    const doRefresh = async () => {
        try {
            await refreshItemMetadata(id);
            toast('Refresco de metadata lanzado', 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
        }
    };

    const doDelete = async () => {
        const confirmed = window.confirm(
            `Eliminar «${itemTitle ?? 'este item'}» del servidor. Esta acción es irreversible. ¿Continuar?`
        );
        if (!confirmed) return;
        try {
            await deleteItem(id);
            toast(`Eliminado${label}`, 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
        }
    };

    const openNative = (targetId?: string, extra = '') => {
        const url = nativeItemUrl(targetId ?? id) + extra;
        if (!url) return toast('URL del servidor no disponible', 'warn');
        window.open(url, '_blank', 'noopener');
    };

    const doDownload = () => {
        const url = downloadUrl(id);
        if (!url) return toast('URL de descarga no disponible', 'warn');
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
    const menuByType: Record<'movie' | 'show' | 'season' | 'episode', MenuItem[]> = {
        movie: [
            { label: 'Reproducir desde el principio', fn: () => doPlay({ fromStart: true }) },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { label: 'Añadir a colección', fn: () => setAddTo('collection') },
            { isDivider: true },
            { label: 'Descargar', fn: doDownload },
            { isDivider: true },
            { label: 'Identificar…', fn: () => setEditor('identify') },
            { label: 'Actualizar metadatos', fn: doRefresh },
            { label: 'Editar metadatos', fn: () => setEditor('metadata') },
            { label: 'Editar imágenes', fn: () => setEditor('images') },
            { label: 'Editar subtítulos', fn: () => setEditor('subtitles') },
            { isDivider: true },
            { label: 'Eliminar', fn: doDelete, danger: true }
        ],
        show: [
            ...(nextEpisodeId ? [
                { label: 'Reproducir siguiente episodio', fn: doPlayNextEpisode },
                { label: 'Reproducir todo', fn: doPlayNextEpisode }
            ] : []),
            { label: 'Reproducción aleatoria', fn: () => openNative(undefined, '&shuffle=true') },
            { isDivider: true },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { label: 'Añadir a colección', fn: () => setAddTo('collection') },
            { isDivider: true },
            { label: 'Identificar…', fn: () => setEditor('identify') },
            { label: 'Actualizar metadatos', fn: doRefresh },
            { label: 'Editar metadatos', fn: () => setEditor('metadata') },
            { label: 'Editar imágenes', fn: () => setEditor('images') },
            { isDivider: true },
            { label: 'Eliminar', fn: doDelete, danger: true }
        ],
        season: [
            ...(nextEpisodeId ? [
                { label: 'Reproducir siguiente episodio', fn: doPlayNextEpisode },
                { label: 'Reproducir todo', fn: doPlayNextEpisode }
            ] : []),
            { isDivider: true },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { label: 'Añadir a colección', fn: () => setAddTo('collection') },
            { isDivider: true },
            // Sin "Identificar…": las temporadas no tienen búsqueda remota
            // propia en Jellyfin, se identifican desde la serie.
            { label: 'Actualizar metadatos', fn: doRefresh },
            { label: 'Editar metadatos', fn: () => setEditor('metadata') },
            { label: 'Editar imágenes', fn: () => setEditor('images') },
            { isDivider: true },
            { label: 'Eliminar', fn: doDelete, danger: true }
        ],
        episode: [
            { label: 'Reproducir desde el principio', fn: () => doPlay({ fromStart: true }) },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { isDivider: true },
            { label: 'Descargar', fn: doDownload },
            { isDivider: true },
            { label: 'Identificar…', fn: () => setEditor('identify') },
            { label: 'Actualizar metadatos', fn: doRefresh },
            { label: 'Editar metadatos', fn: () => setEditor('metadata') },
            { label: 'Editar subtítulos', fn: () => setEditor('subtitles') },
            { isDivider: true },
            { label: 'Eliminar episodio', fn: doDelete, danger: true }
        ]
    };

    const menu = items ?? (isReal ? menuByType[type] : legacyMenu(toast));

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton onClick={openMenu} ariaLabel='Más opciones' active={open}>
                <Ic.Dots size={size} />
            </IconButton>
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
                        top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right,
                        maxHeight: menuPos.maxHeight, overflowY: 'auto', zIndex: 9999,
                        minWidth: 260,
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
        </div>
    );
}

// Menú antiguo (modo prototipo sin sesión Jellyfin) — solo toasts. Se
// mantiene para no romper demos sin backend.
function legacyMenu(toast: ReturnType<typeof useToast>): MenuItem[] {
    const notImpl = (l: string) => toast(`«${l}» — sin conexión con Jellyfin`, 'info');
    return [
        { label: 'Descargar', fn: () => notImpl('Descargar') }
    ];
}
