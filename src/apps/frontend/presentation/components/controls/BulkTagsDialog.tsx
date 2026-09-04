import globalize from 'lib/globalize';

import { useState } from 'react';
import { Dialog, DialogFooter, DialogHeader, DialogInputRow } from './Dialog';
import { PillButton, TextField } from './fields';
import { TagChips, TagSuggestions, useTagDraft } from './TagEditor';

type Props = {
    /** Cuántos items recibirán las etiquetas; solo para el encabezado. */
    count: number;
    onApply: (tags: string[]) => void | Promise<void>;
    onClose: () => void;
};

/**
 * Etiquetas para un lote. A diferencia de `TagsDialog`, aquí no se leen las
 * etiquetas actuales: los items seleccionados tienen cada uno las suyas y
 * enseñar una lista combinada invitaría a creer que se van a reemplazar.
 * Lo que se hace es SUMAR: nadie pierde las que ya tenía.
 *
 * Solo se puede elegir del vocabulario cerrado.
 */
export function BulkTagsDialog({ count, onApply, onClose }: Props) {
    const [tags, setTags] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const { draft, setDraft, matches, add } = useTagDraft({
        tags,
        onAdd: (tag) => setTags((prev) => [...prev, tag])
    });

    const apply = async () => {
        if (tags.length === 0) return;
        setBusy(true);
        try {
            await onApply(tags);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            label={globalize.translate('EditTags')}
            // Por encima del diálogo normal: se abre desde la barra de
            // selección, que ya está flotando sobre la página.
            zIndex={10001}
            onClose={onClose}
        >
            <DialogHeader
                title={globalize.translate('EditTags')}
                subtitle={globalize.translate('HeaderSelectedCount', count)}
                onClose={onClose}
            />

            <TagChips tags={tags} onRemove={(tag) => setTags(tags.filter((t) => t !== tag))} />
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
                        <PillButton
                            onClick={apply}
                            size='sm'
                            busy={busy}
                            disabled={tags.length === 0}
                        >
                            {globalize.translate('Save')}
                        </PillButton>
                    }
                />
            </DialogFooter>
        </Dialog>
    );
}
