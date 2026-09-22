import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { getPlaylists, addToPlaylist, createPlaylist,
    getCollections, addToCollection, createCollection,
    type ListEntry
} from '../../../../domain/api';
import { Dialog, DialogFooter, DialogHeader, DialogInputRow, DialogRow } from './Dialog';
import { PillButton, TextField } from '../fields';
import { LoadState } from '../LoadState';
import { useAsyncToast } from '../../../hooks/useAsyncToast';
import { useFetch } from '../../../hooks/useFetch';

import { T } from '../../../theme/tokens';

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
    const [activeKind, setActiveKind] = useState<'playlist' | 'collection'>(initialKind ?? kind);
    const isPlaylist = activeKind === 'playlist';
    const ids = itemIds ? itemIds : (itemId ? [itemId] : []);
    const idKey = ids.join(',');
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);
    const labels = {
        empty: globalize.translate(isPlaylist ? 'NoPlaylists' : 'NoCollections'),
        create: globalize.translate(isPlaylist ? 'CreatePlaylist' : 'CreateCollection')
    };

    const { data: entries, error, mutate: setEntries } = useFetch(async () => {
        const fetchEntries = isPlaylist ? getPlaylists : getCollections;
        const list = await fetchEntries();
        const excluded = new Set(idKey.split(','));
        return list.filter((e) => !excluded.has(e.id));
    }, [isPlaylist, idKey]);

    const suffix = itemTitle ? ` · ${itemTitle}` : (ids.length > 1 ? ` · ${ids.length}` : '');

    const { run: runAdd, loading: adding } = useAsyncToast();
    const { run: runCreate, loading: creating } = useAsyncToast();

    const doAdd = (entry: ListEntry) => runAdd(async () => {
        await (isPlaylist ? addToPlaylist : addToCollection)(entry.id, ids);
    }, {
        successMessage: globalize.translate('MessageAddedTo', entry.name) + suffix,
        onSuccess: () => {
            onSuccess?.();
            onClose();
        }
    });

    const doCreate = () => runCreate(async () => {
        const name = newName.trim();
        if (!name) return;
        await (isPlaylist ? createPlaylist : createCollection)(name, ids);
        return name;
    }, {
        successMessage: (name) => name ? globalize.translate('MessageCreated', name) + suffix : '',
        onSuccess: (name) => {
            if (name) {
                onSuccess?.();
                onClose();
            }
        }
    });

    // Combina los estados busy
    useEffect(() => { setBusy(adding || creating); }, [adding, creating]);

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
                error={error?.message}
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
                            placeholder={globalize.translate('NewNamePlaceholder')}
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
