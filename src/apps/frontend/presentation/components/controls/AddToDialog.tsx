import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';
import {
    getPlaylists, addToPlaylist, createPlaylist,
    getCollections, addToCollection, createCollection,
    type ListEntry
} from '../../../domain/api';

type Props = {
    kind: 'playlist' | 'collection';
    itemId: string;
    itemTitle?: string;
    onClose: () => void;
};

// Diálogo "Añadir a lista de reproducción / colección": lista las existentes
// y permite crear una nueva, todo contra la API (sin saltar al web nativo).
export function AddToDialog({ kind, itemId, itemTitle, onClose }: Props) {
    const toast = useToast();
    const [entries, setEntries] = useState<ListEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);

    const labels = kind === 'playlist' ?
        {
            title: globalize.translate('AddToPlaylist'),
            empty: globalize.translate('MessageNoPlaylistsYet'),
            create: globalize.translate('HeaderNewPlaylist')
        } :
        {
            title: globalize.translate('AddToCollection'),
            empty: globalize.translate('MessageNoCollectionsYet'),
            create: globalize.translate('HeaderNewCollection')
        };

    useEffect(() => {
        const fetchEntries = kind === 'playlist' ? getPlaylists : getCollections;
        fetchEntries().then(setEntries).catch((e) => setError((e as Error).message));
    }, [kind]);

    const suffix = itemTitle ? ` · ${itemTitle}` : '';

    const doAdd = async (entry: ListEntry) => {
        setBusy(true);
        try {
            await (kind === 'playlist' ? addToPlaylist : addToCollection)(entry.id, itemId);
            toast(globalize.translate('MessageAddedTo', entry.name) + suffix, 'success');
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
            setBusy(false);
        }
    };

    const doCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        setBusy(true);
        try {
            await (kind === 'playlist' ? createPlaylist : createCollection)(name, itemId);
            toast(globalize.translate('MessageCreated', name) + suffix, 'success');
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
            setBusy(false);
        }
    };

    return ReactDOM.createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(420px, 100%)', maxHeight: '70vh', overflowY: 'auto',
                    background: 'rgba(18,18,20,0.98)', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    padding: 20, fontFamily: T.ui, color: '#fff'
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', marginBottom: 16
                }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{labels.title}</div>
                    <button
                        onClick={onClose}
                        aria-label={globalize.translate('ButtonClose')}
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none',
                            color: T.dim, cursor: 'pointer', fontSize: 18, lineHeight: 1
                        }}
                    >×</button>
                </div>

                {error ? (
                    <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>
                ) : !entries ? (
                    <div style={{ color: T.dim, fontSize: 13 }}>{globalize.translate('Loading')}</div>
                ) : entries.length === 0 ? (
                    <div style={{ color: T.dim, fontSize: 13, marginBottom: 8 }}>{labels.empty}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
                        {entries.map((e) => (
                            <button
                                key={e.id}
                                disabled={busy}
                                onClick={() => doAdd(e)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '9px 10px', borderRadius: 8,
                                    background: 'none', border: 'none', color: '#fff',
                                    cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
                                    fontFamily: T.ui, fontSize: 14, transition: 'background .15s'
                                }}
                                onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{
                                    width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                                    background: e.image ?
                                        `url(${e.image}) center/cover` :
                                        'rgba(255,255,255,0.08)'
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {e.name}
                                    </div>
                                    {e.count != null && (
                                        <div style={{ fontSize: 12, color: T.dim }}>{globalize.translate('ItemCount', e.count)}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                <div style={{
                    display: 'flex', gap: 8, paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void doCreate(); }}
                        placeholder='Nombre de la nueva…'
                        style={{
                            flex: 1, background: 'rgba(255,255,255,0.06)', color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                            padding: '9px 12px', fontFamily: T.ui, fontSize: 13, outline: 'none'
                        }}
                    />
                    <button
                        disabled={busy || !newName.trim()}
                        onClick={doCreate}
                        style={{
                            padding: '9px 16px', borderRadius: 999,
                            background: newName.trim() ? '#fff' : 'rgba(255,255,255,0.15)',
                            color: newName.trim() ? '#000' : T.dim,
                            border: 'none', fontFamily: T.ui, fontSize: 13, fontWeight: 600,
                            cursor: busy || !newName.trim() ? 'default' : 'pointer'
                        }}
                    >
                        {labels.create}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
