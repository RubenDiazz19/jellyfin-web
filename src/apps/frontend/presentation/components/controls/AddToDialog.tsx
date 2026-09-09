import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { useToast } from '../toast/ToastProvider';
import {
    getPlaylists, addToPlaylist, createPlaylist,
    getCollections, addToCollection, createCollection,
    type ListEntry
} from '../../../domain/api';
import { Dialog, DialogFooter, DialogHeader, DialogInputRow, DialogRow } from './Dialog';
import { PillButton, TextField } from './fields';
import { LoadState } from './LoadState';

import { T } from '../../theme/tokens';

type Props = {
    kind?: 'playlist' | 'collection';
    initialKind?: 'playlist' | 'collection';
    itemId?: string;
    itemIds?: string[];
    itemTitle?: string;
    onClose: () => void;
    onSuccess?: () => void;
};

// Diálogo "Añadir a lista de reproducción / colección": lista las existentes
// y permite crear una nueva, todo contra la API (sin saltar al web nativo).
export function AddToDialog({
    kind = 'playlist',
    initialKind,
    itemId,
    itemIds,
    itemTitle,
    onClose,
    onSuccess
}: Props) {
    const toast = useToast();
    const [activeKind, setActiveKind] = useState<'playlist' | 'collection'>(initialKind ?? kind);
    const [entries, setEntries] = useState<ListEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);

    const ids = itemIds ?? (itemId ? [itemId] : []);

    const isPlaylist = activeKind === 'playlist';
    const labels = isPlaylist ?
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

    const idKey = ids.join(',');

    useEffect(() => {
        setEntries(null);
        setError(null);
        const fetchEntries = isPlaylist ? getPlaylists : getCollections;
        fetchEntries()
            .then((list) => {
                const excluded = new Set(idKey.split(','));
                setEntries(list.filter((e) => !excluded.has(e.id)));
            })
            .catch((e) => setError((e as Error).message));
    }, [isPlaylist, idKey]);

    const suffix = itemTitle ? ` · ${itemTitle}` : (ids.length > 1 ? ` · ${ids.length}` : '');

    const doAdd = async (entry: ListEntry) => {
        setBusy(true);
        try {
            await (isPlaylist ? addToPlaylist : addToCollection)(entry.id, ids);
            toast(globalize.translate('MessageAddedTo', entry.name) + suffix, 'success');
            onSuccess?.();
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
            await (isPlaylist ? createPlaylist : createCollection)(name, ids);
            toast(globalize.translate('MessageCreated', name) + suffix, 'success');
            onSuccess?.();
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
            setBusy(false);
        }
    };

    return (
        <Dialog label={globalize.translate('AddTo')} maxHeight='70vh' onClose={onClose}>
            <DialogHeader title={globalize.translate('AddTo')} onClose={onClose} />

            <div style={{
                display: 'flex', gap: 6, padding: '0 4px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 12
            }}>
                <button
                    type='button'
                    onClick={() => setActiveKind('playlist')}
                    style={{
                        padding: '6px 14px', borderRadius: 999,
                        background: isPlaylist ? 'rgba(255,255,255,0.12)' : 'transparent',
                        border: isPlaylist ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                        color: isPlaylist ? '#fff' : T.dim,
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: T.ui
                    }}
                >
                    {globalize.translate('Playlists')}
                </button>
                <button
                    type='button'
                    onClick={() => setActiveKind('collection')}
                    style={{
                        padding: '6px 14px', borderRadius: 999,
                        background: !isPlaylist ? 'rgba(255,255,255,0.12)' : 'transparent',
                        border: !isPlaylist ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                        color: !isPlaylist ? '#fff' : T.dim,
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: T.ui
                    }}
                >
                    {globalize.translate('Collections')}
                </button>
            </div>

            <LoadState
                loading={!entries && !error}
                error={error}
                count={entries ? entries.length : undefined}
                emptyText={labels.empty}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
                    {entries?.map((e) => (
                        <DialogRow
                            key={e.id}
                            image={e.image}
                            name={e.name}
                            count={e.count}
                            busy={busy}
                            onClick={() => doAdd(e)}
                        />
                    ))}
                </div>
            </LoadState>

            <DialogFooter>
                <DialogInputRow
                    field={
                        <TextField
                            value={newName}
                            onChange={setNewName}
                            onEnter={doCreate}
                            placeholder='Nombre de la nueva…'
                        />
                    }
                    action={
                        <PillButton
                            onClick={doCreate}
                            size='sm'
                            busy={busy}
                            disabled={!newName.trim()}
                        >
                            {labels.create}
                        </PillButton>
                    }
                />
            </DialogFooter>
        </Dialog>
    );
}
