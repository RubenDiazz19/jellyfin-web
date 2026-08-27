import globalize from 'lib/globalize';

import { useState } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useToast } from '../toast/ToastProvider';
import { useInLists, useListsSync } from '../../../domain/bridge/useLists';
import { LISTS, type ListKind, type ListRef } from '../../../domain/stores';
import { Dialog, DialogFooter, DialogHeader, DialogInputRow, DialogRow } from './Dialog';
import { PillButton, TextField } from './fields';
import { LoadState } from './LoadState';

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
    const { lists, loading, error } = useListsSync();
    const [busy, setBusy] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newKind, setNewKind] = useState<ListKind>('playlist');

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

    return (
        <Dialog
            label={globalize.translate('MyList')}
            width={440}
            maxHeight='76vh'
            column
            onClose={onClose}
        >
            <DialogHeader
                title={globalize.translate('MyList')}
                subtitle={itemTitle}
                onClose={onClose}
            />

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: 14 }}>
                <LoadState
                    loading={loading}
                    error={error}
                    count={lists.length}
                    emptyText={globalize.translate('MessageNoPlaylistsYet')}
                >
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
                </LoadState>
            </div>

            <DialogFooter>

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
                <DialogInputRow
                    field={
                        <TextField
                            value={newName}
                            onChange={setNewName}
                            onEnter={() => { void create(); }}
                            onKeyDown={(e) => {
                                // Con texto a medio escribir, Escape cancela el
                                // nombre, no cierra el diálogo entero.
                                if (e.key === 'Escape' && newName) {
                                    e.stopPropagation();
                                    setNewName('');
                                }
                            }}
                            placeholder={globalize.translate('LabelNewName')}
                        />
                    }
                    action={
                        <PillButton
                            onClick={() => { void create(); }}
                            size='sm'
                            busy={busy !== null}
                            disabled={!newName.trim()}
                        >
                            {globalize.translate('ButtonCreate')}
                        </PillButton>
                    }
                />
            </DialogFooter>
        </Dialog>
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
                    const key = `${l.kind}:${l.id}`;
                    return (
                        <DialogRow
                            key={key}
                            image={l.image}
                            name={l.name}
                            count={l.count}
                            checked={LISTS.contains(l.kind, l.id, itemId)}
                            busy={busy !== null}
                            // En vuelo pero en otra fila: se apaga para que se
                            // vea cuál se está moviendo.
                            dimmed={busy !== null && busy !== key}
                            onClick={() => onToggle(l)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
