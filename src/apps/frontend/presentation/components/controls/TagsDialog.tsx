import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { useToast } from '../toast/ToastProvider';
import { getItemRaw, setItemTags } from '../../../domain/api';
import { Dialog, DialogFooter, DialogHeader, DialogInputRow } from './Dialog';
import { PillButton, TextField } from './fields';
import { LoadState } from './LoadState';
import { TagChips, TagSuggestions, useTagDraft } from './TagEditor';
import { autoTagsFor, getItemTags } from '../../../domain/tags';

type Props = {
    itemId: string;
    itemTitle?: string;
    onClose: () => void;
};

/**
 * Editor de etiquetas de un item. Solo gestiona tags del vocabulario cerrado.
 *
 * Al abrir se combinan los tags del servidor con las autoTags locales y se
 * filtran contra el vocabulario cerrado (descartando keywords basura).
 * El usuario busca y selecciona del vocabulario, no escribe texto libre.
 *
 * Guardar necesita permiso de edición de metadatos — `POST /Items/{id}` es la
 * misma puerta que el editor del admin. Sin permiso el servidor responde 403 y
 * se avisa por toast; leer y filtrar por etiquetas funciona para cualquiera.
 */
export function TagsDialog({ itemId, itemTitle, onClose }: Props) {
    const toast = useToast();
    const [tags, setTags] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getItemRaw(itemId)
            .then((raw) => {
                if (!alive) return;
                // Combinar tags del servidor con autoTags y filtrar con el vocabulario cerrado
                const serverTags = (raw.Tags ?? []) as string[];
                const valid = getItemTags({
                    tags: serverTags,
                    autoTags: autoTagsFor(itemId)
                });
                setTags(valid);
            })
            .catch((e) => { if (alive) setError((e as Error).message); });
        return () => { alive = false; };
    }, [itemId]);

    const { draft, setDraft, matches, add } = useTagDraft({
        tags,
        onAdd: (tag) => setTags([...(tags ?? []), tag])
    });

    const save = async () => {
        if (!tags) return;
        setBusy(true);
        try {
            await setItemTags(itemId, tags);
            toast(
                globalize.translate('MessageTagsSaved') + (itemTitle ? ` · ${itemTitle}` : ''),
                'success'
            );
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
            setBusy(false);
        }
    };

    return (
        <Dialog label={globalize.translate('EditTags')} maxHeight='70vh' onClose={onClose}>
            <DialogHeader title={globalize.translate('EditTags')} onClose={onClose} />

            <LoadState
                loading={!tags && !error}
                error={error}
            >
                {tags && (
                    <>
                        {tags.length === 0 ? (
                            <div style={{ marginBottom: 14 }}>
                                <LoadState count={0} emptyText={globalize.translate('MessageNoTagsYet')}>
                                    <div />
                                </LoadState>
                            </div>
                        ) : (
                            <TagChips
                                tags={tags}
                                onRemove={(tag) => setTags(tags.filter((t) => t !== tag))}
                            />
                        )}

                        <TagSuggestions suggestions={matches} onAdd={add} />

                        <DialogFooter>
                            <DialogInputRow
                                field={
                                    <TextField
                                        value={draft}
                                        onChange={setDraft}
                                        onEnter={() => add(draft)}
                                        placeholder={globalize.translate('LabelSearchTags')}
                                    />
                                }
                                action={
                                    <PillButton onClick={save} size='sm' busy={busy}>
                                        {globalize.translate('Save')}
                                    </PillButton>
                                }
                            />
                        </DialogFooter>
                    </>
                )}
            </LoadState>
        </Dialog>
    );
}
