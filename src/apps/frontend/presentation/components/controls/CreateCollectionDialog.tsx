import globalize from 'lib/globalize';

import { useState } from 'react';
import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';
import { LISTS, type ListKind } from '../../../domain/stores';
import { Dialog, DialogFooter, DialogHeader } from './Dialog';
import { PillButton, TextField } from './fields';

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

    const doCreate = async () => {
        const cleanName = name.trim();
        if (!cleanName || busy) return;
        setBusy(true);
        try {
            const newId = await LISTS.create(kind, cleanName, undefined, parentId);
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
                        {globalize.translate('NewCollectionHelp')}
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
