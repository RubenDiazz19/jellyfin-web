import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { useToast } from '../toast/ToastProvider';
import { getItemRaw, setItemTags } from '../../../domain/api';
import { Dialog, DialogFooter, DialogHeader, DialogInputRow } from './Dialog';
import { ErrText, Muted, PillButton, TextField } from './fields';
import { TagChips, TagSuggestions, useTagDraft } from './TagEditor';

type Props = {
    itemId: string;
    itemTitle?: string;
    /** Etiquetas de toda la biblioteca, para autosugerir en vez de teclear. */
    suggestions?: string[];
    onClose: () => void;
};

/**
 * Editor de etiquetas de un item. Las etiquetas van al servidor (metadatos),
 * así que se leen frescas al abrir: otro cliente pudo cambiarlas.
 *
 * Guardar necesita permiso de edición de metadatos — `POST /Items/{id}` es la
 * misma puerta que el editor del admin. Sin permiso el servidor responde 403 y
 * se avisa por toast; leer y filtrar por etiquetas funciona para cualquiera.
 */
export function TagsDialog({ itemId, itemTitle, suggestions = [], onClose }: Props) {
    const toast = useToast();
    const [tags, setTags] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getItemRaw(itemId)
            .then((raw) => { if (alive) setTags(raw.Tags ?? []); })
            .catch((e) => { if (alive) setError((e as Error).message); });
        return () => { alive = false; };
    }, [itemId]);

    const { draft, setDraft, matches, add } = useTagDraft({
        tags,
        suggestions,
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

            {error ? (
                <ErrText>{error}</ErrText>
            ) : !tags ? (
                <Muted>{globalize.translate('Loading')}</Muted>
            ) : (
                <>
                    {tags.length === 0 ? (
                        <div style={{ marginBottom: 14 }}>
                            <Muted>{globalize.translate('MessageNoTagsYet')}</Muted>
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
                                    placeholder={globalize.translate('LabelNewTag')}
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
        </Dialog>
    );
}
