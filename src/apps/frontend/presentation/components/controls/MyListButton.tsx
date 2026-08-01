import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useToast } from '../toast/ToastProvider';
import { useInLists } from '../../../domain/bridge/useLists';
import { LISTS, type ListKind, type ListRef } from '../../../domain/stores';

// «Mi lista» de las fichas de película y serie. Abre un diálogo con TODAS las
// listas —de reproducción y colecciones— marcables a la vez: el título puede
// estar en varias, y obligar a abrir el diálogo una vez por lista sería
// absurdo. Sustituye a las dos entradas que había en el menú de más opciones.
//
// El botón se pinta relleno (fondo blanco, texto negro) en cuanto el título
// está en al menos una, y vuelve a su borde translúcido cuando sale de todas.
// Es la misma señal que da el botón de favorito, sin abrir nada.

type Props = {
    itemId: string;
    itemTitle: string;
    /** Compacto en la ficha de serie, algo mayor en la de película. */
    size?: 'sm' | 'md';
};

export function MyListButton({ itemId, itemTitle, size = 'md' }: Props) {
    const { inAny } = useInLists(itemId);
    const [open, setOpen] = useState(false);
    const pad = size === 'sm' ? '11px 18px' : '13px 22px';
    const fontSize = size === 'sm' ? 12 : 13;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                // Sin bloquear el foco nativo, Chrome desplaza el hero para
                // dejar el botón visible al pulsarlo: la página «salta» unos
                // píxeles entre el mousedown y el mouseup. Mismo fix que el
                // resto de botones del hero; el onClick sigue disparando y el
                // Tab conserva la accesibilidad.
                onMouseDown={(e) => e.preventDefault()}
                aria-haspopup='dialog'
                aria-label={`${globalize.translate('MyList')} · ${itemTitle}`}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: pad,
                    background: inAny ? '#fff' : 'transparent',
                    color: inAny ? '#000' : '#fff',
                    border: inAny ? '1px solid #fff' : '1px solid rgba(255,255,255,0.4)',
                    borderRadius: 999,
                    fontFamily: T.ui, fontSize, fontWeight: 500, cursor: 'pointer',
                    transition: 'background .15s, color .15s, border-color .15s'
                }}
            >
                {inAny ?
                    <Ic.Check size={14} stroke='#000' /> :
                    <Ic.Plus size={14} />}
                {globalize.translate('MyList')}
            </button>
            {open && (
                <MyListDialog
                    itemId={itemId}
                    itemTitle={itemTitle}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

/**
 * Diálogo de pertenencia: una fila por lista, marcada si el título está
 * dentro. Cada clic aplica el cambio al momento contra el servidor — no hay
 * «guardar», porque no hay nada que confirmar y así el estado del diálogo
 * nunca se desincroniza de lo que hay en el servidor.
 */
function MyListDialog({ itemId, itemTitle, onClose }: {
    itemId: string; itemTitle: string; onClose: () => void;
}) {
    const toast = useToast();
    // Se lee del hook para que las marcas sigan al store tras cada cambio.
    useInLists(itemId);
    const [lists, setLists] = useState<ListRef[]>(() => LISTS.all());
    const [loading, setLoading] = useState(() => LISTS.all().length === 0);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newKind, setNewKind] = useState<ListKind>('playlist');

    useEffect(() => {
        const sync = () => setLists(LISTS.all());
        window.addEventListener(LISTS.event, sync);
        LISTS.refresh()
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
        return () => window.removeEventListener(LISTS.event, sync);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const toggle = async (list: ListRef) => {
        const wasIn = LISTS.contains(list.kind, list.id, itemId);
        setBusy(`${list.kind}:${list.id}`);
        try {
            await LISTS.toggle(list.kind, list.id, itemId);
            toast(
                globalize.translate(wasIn ? 'MessageRemovedFrom' : 'MessageAddedTo', list.name)
                + ` · ${itemTitle}`,
                'success'
            );
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(null);
        }
    };

    const create = async () => {
        const name = newName.trim();
        if (!name) return;
        setBusy('__new__');
        try {
            await LISTS.create(newKind, name, itemId);
            toast(globalize.translate('MessageCreated', name) + ` · ${itemTitle}`, 'success');
            setNewName('');
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(null);
        }
    };

    const playlists = lists.filter((l) => l.kind === 'playlist');
    const collections = lists.filter((l) => l.kind === 'collection');

    return ReactDOM.createPortal(
        <div
            // Solo cierra si el clic cae en el fondo. Comparar el objetivo con
            // el propio elemento evita tener que parar la propagación dentro
            // del diálogo, que es lo que obligaba a colgarle un manejador de
            // ratón al contenedor con `role="dialog"`.
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                role='dialog'
                aria-modal='true'
                aria-label={globalize.translate('MyList')}
                style={{
                    width: 'min(440px, 100%)', maxHeight: '76vh',
                    display: 'flex', flexDirection: 'column',
                    background: 'rgba(18,18,20,0.98)', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    padding: 20, fontFamily: T.ui, color: '#fff'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                        {globalize.translate('MyList')}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label={globalize.translate('ButtonClose')}
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            color: T.dim, cursor: 'pointer', fontSize: 18, lineHeight: 1
                        }}
                    >×</button>
                </div>
                <div style={{
                    fontSize: 12, color: T.dim, marginBottom: 16,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    {itemTitle}
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: 14 }}>
                    {error ? (
                        <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>
                    ) : loading ? (
                        <div style={{ color: T.dim, fontSize: 13 }}>{globalize.translate('Loading')}</div>
                    ) : lists.length === 0 ? (
                        <div style={{ color: T.dim, fontSize: 13 }}>
                            {globalize.translate('MessageNoPlaylistsYet')}
                        </div>
                    ) : (
                        <>
                            <ListGroup
                                title={globalize.translate('Playlists')}
                                lists={playlists}
                                itemId={itemId}
                                busy={busy}
                                onToggle={toggle}
                            />
                            <ListGroup
                                title={globalize.translate('Collections')}
                                lists={collections}
                                itemId={itemId}
                                busy={busy}
                                onToggle={toggle}
                            />
                        </>
                    )}
                </div>

                <div style={{
                    paddingTop: 12, flexShrink: 0,
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                }}>
                    {/* Qué se crea se elige aquí: lista de reproducción o
                        colección. Las dos aceptan lo mismo, pero la colección
                        guarda las series enteras y la lista las desmenuza en
                        capítulos, así que no da igual cuál. */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <KindTab
                            label={globalize.translate('Playlists')}
                            active={newKind === 'playlist'}
                            onClick={() => setNewKind('playlist')}
                        />
                        <KindTab
                            label={globalize.translate('Collections')}
                            active={newKind === 'collection'}
                            onClick={() => setNewKind('collection')}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void create();
                                // Con texto a medio escribir, Escape cancela el
                                // nombre, no cierra el diálogo entero.
                                if (e.key === 'Escape' && newName) {
                                    e.stopPropagation();
                                    setNewName('');
                                }
                            }}
                            placeholder={globalize.translate('LabelNewName')}
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.06)', color: '#fff',
                                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                                padding: '9px 12px', fontFamily: T.ui, fontSize: 13, outline: 'none'
                            }}
                        />
                        <button
                            disabled={busy !== null || !newName.trim()}
                            onClick={() => { void create(); }}
                            style={{
                                padding: '9px 16px', borderRadius: 999,
                                background: newName.trim() ? '#fff' : 'rgba(255,255,255,0.15)',
                                color: newName.trim() ? '#000' : T.dim,
                                border: 'none', fontFamily: T.ui, fontSize: 13, fontWeight: 600,
                                cursor: busy !== null || !newName.trim() ? 'default' : 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {globalize.translate('ButtonCreate')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function KindTab({ label, active, onClick }: {
    label: string; active: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
                background: active ? '#fff' : 'rgba(255,255,255,0.08)',
                color: active ? '#000' : T.dim,
                border: 'none', fontFamily: T.ui, fontSize: 12, fontWeight: 500
            }}
        >
            {label}
        </button>
    );
}

/** Un bloque del diálogo: las listas de un tipo. Se oculta si no hay ninguna. */
function ListGroup({ title, lists, itemId, busy, onToggle }: {
    title: string;
    lists: ListRef[];
    itemId: string;
    busy: string | null;
    onToggle: (l: ListRef) => void;
}) {
    if (lists.length === 0) return null;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{
                fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
                color: T.dim, margin: '0 0 8px 2px'
            }}>
                {title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {lists.map((l) => {
                    const checked = LISTS.contains(l.kind, l.id, itemId);
                    return (
                        <button
                            key={`${l.kind}:${l.id}`}
                            role='checkbox'
                            aria-checked={checked}
                            disabled={busy !== null}
                            onClick={() => onToggle(l)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '9px 10px', borderRadius: 8,
                                background: 'none', border: 'none', color: '#fff',
                                cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
                                fontFamily: T.ui, fontSize: 14, transition: 'background .15s',
                                opacity: busy && busy !== `${l.kind}:${l.id}` ? 0.5 : 1
                            }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{
                                flexShrink: 0,
                                width: 20, height: 20, borderRadius: 4,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: checked ? '#fff' : 'transparent',
                                border: checked ? 'none' : '2px solid rgba(255,255,255,0.35)',
                                color: '#000', fontSize: 13, lineHeight: 1
                            }}>
                                {checked ? '✓' : ''}
                            </span>
                            <div style={{
                                width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                                background: l.image ?
                                    `url(${l.image}) center/cover` :
                                    'rgba(255,255,255,0.08)'
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {l.name}
                                </div>
                                {l.count != null && (
                                    <div style={{ fontSize: 12, color: T.dim }}>
                                        {globalize.translate('ItemCount', l.count)}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
