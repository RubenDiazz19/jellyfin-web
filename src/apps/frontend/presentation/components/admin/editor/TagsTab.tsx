import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { useToast } from '../../toast/ToastProvider';
import { getItemRaw, setItemTags } from '../../../../domain/api';
import { PillButton, TextField, Muted } from '../../controls/fields';
import { LoadState } from '../../controls/LoadState';
import { TagChips, TagSuggestions, useTagDraft } from '../../controls/TagEditor';
import { autoTagsFor, getItemTags } from '../../../../domain/tags';

type Props = {
    itemId: string;
    onClose?: () => void;
};

/**
 * Pestaña de edición de etiquetas dentro de MetadataEditor.
 * Permite seleccionar etiquetas del vocabulario cerrado y guardarlas en el item.
 */
export function TagsTab({ itemId, onClose }: Props) {
    const toast = useToast();
    const [tags, setTags] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getItemRaw(itemId)
            .then((raw) => {
                if (!alive) return;
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
            toast(globalize.translate('MessageTagsSaved'), 'success');
            onClose?.();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Muted>
                {globalize.translate('LabelSearchTags')}
            </Muted>

            <LoadState
                loading={!tags && !error}
                error={error}
            >
                {tags && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {tags.length === 0 ? (
                            <LoadState count={0} emptyText={globalize.translate('MessageNoTagsYet')}>
                                <div />
                            </LoadState>
                        ) : (
                            <TagChips
                                tags={tags}
                                onRemove={(tag) => setTags(tags.filter((t) => t !== tag))}
                            />
                        )}

                        <TagSuggestions suggestions={matches} onAdd={add} />

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                            <div style={{ flex: 1 }}>
                                <TextField
                                    value={draft}
                                    onChange={setDraft}
                                    onEnter={() => add(draft)}
                                    placeholder={globalize.translate('LabelSearchTags')}
                                />
                            </div>
                            <PillButton onClick={save} busy={busy}>
                                {globalize.translate('Save')}
                            </PillButton>
                        </div>
                    </div>
                )}
            </LoadState>
        </div>
    );
}
