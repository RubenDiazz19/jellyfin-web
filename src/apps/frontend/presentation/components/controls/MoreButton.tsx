import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useFav } from '../../../domain/bridge/useFav';
import { useWatched } from '../../../domain/bridge/useWatched';
import { IconButton } from './IconButton';
import { useToast } from '../toast/ToastProvider';
import { useSession } from '../../../domain/bridge/useSession';
import {
    markPlayed, toggleFavorite as apiToggleFavorite,
    refreshItemMetadata, deleteItem,
    downloadUrl, nativeItemUrl
} from '../../../domain/api';
import { MetadataEditor, type EditorKind } from '../admin/editor';
import { AddToDialog } from './AddToDialog';
import { usePlayer } from '../player/PlayerProvider';

type MenuItem =
  | { isDivider: true }
  | { isCustom: true; component: ReactNode }
  | { label: string; fn: () => void; danger?: boolean; disabled?: boolean };

type Props = {
    id: string;
    size?: number;
    items?: MenuItem[];
    type?: 'movie' | 'show' | 'episode';
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
    // `id` es SIEMPRE el id real del server (lo usan descarga, metadata,
    // imágenes, borrado…). Los stores locales de visto/favorito usan la
    // clave con prefijo para películas — la misma que el resto de botones.
    const localKey = type === 'movie' ? `movie-${id}` : id;
    const [w, toggleW] = useWatched(localKey);
    const [fav, toggleFav] = useFav(localKey);
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
        const r = ref.current?.getBoundingClientRect();
        if (r) {
            const MENU_H = 540;
            const GAP = 8;
            const dropUp = r.bottom + MENU_H + GAP > window.innerHeight;
            setMenuPos({
                top: dropUp ? undefined : r.bottom + GAP,
                bottom: dropUp ? window.innerHeight - r.top + GAP : undefined,
                right: Math.max(12, window.innerWidth - r.right),
                maxHeight: dropUp ? r.top - GAP - 12 : window.innerHeight - r.bottom - GAP - 12
            });
        }
        setOpen(true);
    };

    // -------- handlers reales --------
    const label = itemTitle ? ` · ${itemTitle}` : '';

    const doMarkPlayed = async () => {
        const next = !w;
        toggleW();
        try {
            await markPlayed(id, next);
            toast(next ? `Marcado como visto${label}` : `Marcado como no visto${label}`, 'success');
        } catch (e) {
            toggleW();
            toast((e as Error).message, 'warn');
        }
    };

    const doToggleFav = async () => {
        const next = !fav;
        toggleFav();
        try {
            await apiToggleFavorite(id, next);
            toast(next ? `Añadido a favoritos${label}` : `Quitado de favoritos${label}`, 'success');
        } catch (e) {
            toggleFav();
            toast((e as Error).message, 'warn');
        }
    };

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

    const doShare = async () => {
        const url = nativeItemUrl(id);
        if (!url) return toast('URL no disponible', 'warn');
        try {
            await navigator.clipboard.writeText(url);
            toast('Enlace copiado al portapapeles', 'success');
        } catch {
            toast(url, 'info');
        }
    };

    // -------- construcción de menús --------
    const menuByType: Record<'movie' | 'show' | 'episode', MenuItem[]> = {
        movie: [
            { label: 'Reproducir', fn: () => doPlay() },
            { label: 'Reproducir desde el principio', fn: () => doPlay({ fromStart: true }) },
            { isDivider: true },
            { label: w ? 'Marcar como no reproducido' : 'Marcar como reproducido',
                fn: doMarkPlayed },
            { label: fav ? 'Quitar de favoritos' : 'Añadir a favoritos',
                fn: doToggleFav },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { label: 'Añadir a colección', fn: () => setAddTo('collection') },
            { isDivider: true },
            { label: 'Descargar', fn: doDownload },
            { label: 'Compartir', fn: doShare },
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
            { label: w ? 'Marcar serie como no vista' : 'Marcar serie como vista',
                fn: doMarkPlayed },
            { label: fav ? 'Quitar de favoritos' : 'Añadir a favoritos',
                fn: doToggleFav },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { label: 'Añadir a colección', fn: () => setAddTo('collection') },
            { isDivider: true },
            { label: 'Compartir', fn: doShare },
            { isDivider: true },
            { label: 'Identificar…', fn: () => setEditor('identify') },
            { label: 'Actualizar metadatos', fn: doRefresh },
            { label: 'Editar metadatos', fn: () => setEditor('metadata') },
            { label: 'Editar imágenes', fn: () => setEditor('images') },
            { isDivider: true },
            { label: 'Eliminar', fn: doDelete, danger: true }
        ],
        episode: [
            { label: 'Reproducir', fn: () => doPlay() },
            { label: 'Reproducir desde el principio', fn: () => doPlay({ fromStart: true }) },
            { isDivider: true },
            { label: w ? 'Marcar como no reproducido' : 'Marcar como reproducido',
                fn: doMarkPlayed },
            { label: fav ? 'Quitar de favoritos' : 'Añadir a favoritos',
                fn: doToggleFav },
            { label: 'Añadir a lista de reproducción', fn: () => setAddTo('playlist') },
            { isDivider: true },
            { label: 'Descargar', fn: doDownload },
            { label: 'Compartir', fn: doShare },
            { isDivider: true },
            { label: 'Identificar…', fn: () => setEditor('identify') },
            { label: 'Actualizar metadatos', fn: doRefresh },
            { label: 'Editar metadatos', fn: () => setEditor('metadata') },
            { label: 'Editar subtítulos', fn: () => setEditor('subtitles') },
            { isDivider: true },
            { label: 'Eliminar episodio', fn: doDelete, danger: true }
        ]
    };

    const menu = items ?? (isReal ? menuByType[type] : legacyMenu(type, w, fav, toggleW, toggleFav, toast, label));

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
            <IconButton onClick={openMenu} ariaLabel='Más opciones' active={open}>
                <Ic.Dots size={size} />
            </IconButton>
            {open && menuPos && ReactDOM.createPortal(
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
function legacyMenu(
    type: 'movie' | 'show' | 'episode',
    w: boolean, fav: boolean,
    toggleW: () => void, toggleFav: () => void,
    toast: ReturnType<typeof useToast>, label: string
): MenuItem[] {
    const notImpl = (l: string) => toast(`«${l}» — sin conexión con Jellyfin`, 'info');
    const commonToggles: MenuItem[] = [
        { label: w ? 'Marcar como no reproducido' : 'Marcar como reproducido',
            fn: () => { toggleW(); toast(w ? `Marcado como no visto${label}` : `Marcado como visto${label}`); } },
        { label: fav ? 'Quitar de favoritos' : 'Añadir a favoritos',
            fn: () => { toggleFav(); toast(fav ? `Quitado de favoritos${label}` : `Añadido a favoritos${label}`); } }
    ];
    return [
        { label: 'Reproducir', fn: () => notImpl('Reproducir') },
        { isDivider: true },
        ...commonToggles,
        { isDivider: true },
        { label: 'Descargar', fn: () => notImpl('Descargar') }
    ];
}
