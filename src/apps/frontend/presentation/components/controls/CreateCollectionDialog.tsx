import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';
import { LISTS, type ListKind } from '../../../domain/stores';
import { Dialog, DialogFooter, DialogHeader } from './Dialog';
import { PillButton, TextField } from './fields';
import { apiSend } from '../../../data/api/http';
import { applyRemoteSearchResult, type RemoteSearchResult } from '../../../domain/api';
import { logger } from '../../../shared/logger';

type Props = {
    kind?: ListKind;
    parentId?: string;
    parentTitle?: string;
    onClose: () => void;
    onCreated: (newId: string) => void;
};

/**
 * Diálogo para crear una lista de reproducción, colección o subcolección.
 */
export function CreateListDialog({
    kind = 'collection',
    parentId,
    parentTitle,
    onClose,
    onCreated
}: Props) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const isPlaylist = kind === 'playlist';
    const title = globalize.translate(isPlaylist ? 'HeaderNewPlaylist' : 'HeaderNewCollection');
    const subtitle = parentTitle ? parentTitle : undefined;

    const [results, setResults] = useState<RemoteSearchResult[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [selectedResult, setSelectedResult] = useState<RemoteSearchResult | null>(null);

    // Búsqueda interactiva
    useEffect(() => {
        if (isPlaylist) return;
        const timer = setTimeout(() => {
            setSearching(true);
            const queryName = name.trim();
            if (selectedResult && queryName === selectedResult.Name) {
                setSearching(false);
                return;
            }
            setSelectedResult(null);
            const body = { SearchInfo: { Name: queryName || undefined } };
            apiSend(`/Items/RemoteSearch/BoxSet`, 'POST', body)
                .then(r => r.json())
                .then(rs => setResults(rs as RemoteSearchResult[]))
                .catch(() => setResults(null))
                .finally(() => setSearching(false));
        }, 600);
        return () => clearTimeout(timer);
    }, [name, isPlaylist, selectedResult]);

    const doCreate = async () => {
        const cleanName = name.trim();
        if (!cleanName || busy) return;
        setBusy(true);
        try {
            const newId = await LISTS.create(kind, cleanName, undefined, parentId);
            if (selectedResult && !isPlaylist) {
                await applyRemoteSearchResult(newId, selectedResult).catch((err) => {
                    logger.debug('Error applying remote search result', err);
                });
            }
            toast(globalize.translate('MessageCreated', cleanName), 'success');
            onCreated(newId);
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
            setBusy(false);
        }
    };

    return (
        <Dialog label={title} onClose={onClose} width={420}>
            <DialogHeader
                title={title}
                subtitle={subtitle}
                onClose={onClose}
            />

            <div style={{ marginBottom: 18 }}>
                {!isPlaylist && (
                    <div style={{
                        fontSize: 12,
                        color: T.dim,
                        marginBottom: 10,
                        lineHeight: 1.5
                    }}>
                        {globalize.translate('SearchTmdbForCollection')}
                    </div>
                )}
                <TextField
                    value={name}
                    onChange={setName}
                    placeholder={globalize.translate(
                        isPlaylist ? 'LabelPlaylist' : 'NewCollectionNameExample'
                    ) + (isPlaylist ? '…' : '')}
                    autoFocus
                    onEnter={doCreate}
                />
            </div>

            {!isPlaylist && searching && (
                <div style={{ fontSize: 12, color: T.dim, padding: '0 4px', marginBottom: 14 }}>
                    Buscando...
                </div>
            )}

            {!isPlaylist && results && results.length > 0 && !selectedResult && !searching && (
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18,
                    maxHeight: 240, overflowY: 'auto', paddingRight: 4
                }}>
                    {results.map((r, i) => (
                        <div key={i} 
                            onClick={() => {
                                setName(r.Name ?? '');
                                setSelectedResult(r);
                            }}
                            style={{
                            display: 'flex', gap: 12, padding: 8,
                            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}>
                            {r.ImageUrl ? (
                                <img
                                    src={r.ImageUrl} alt=''
                                    style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                />
                            ) : (
                                <div style={{ width: 36, height: 54, background: 'rgba(255,255,255,0.1)', borderRadius: 4, flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
                                    {r.Name} {r.ProductionYear && <span style={{ color: T.dim }}>({r.ProductionYear})</span>}
                                </div>
                                {r.Overview && (
                                    <div style={{ fontSize: 11, color: T.dim, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {r.Overview}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <DialogFooter>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <PillButton
                        variant='ghost'
                        size='sm'
                        onClick={onClose}
                        disabled={busy}
                    >
                        {globalize.translate('ButtonCancel')}
                    </PillButton>
                    <PillButton
                        variant='primary'
                        size='sm'
                        busy={busy}
                        disabled={!name.trim()}
                        onClick={doCreate}
                    >
                        {globalize.translate('ButtonCreate')}
                    </PillButton>
                </div>
            </DialogFooter>
        </Dialog>
    );
}

export function CreateCollectionDialog(props: Omit<Props, 'kind'>) {
    return <CreateListDialog kind='collection' {...props} />;
}

export function CreatePlaylistDialog(props: Omit<Props, 'kind'>) {
    return <CreateListDialog kind='playlist' {...props} />;
}
