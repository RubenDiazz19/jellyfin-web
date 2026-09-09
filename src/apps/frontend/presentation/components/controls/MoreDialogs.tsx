import globalize from 'lib/globalize';

import { MetadataEditor, type EditorKind } from '../admin/editor';
import { RefreshDialog } from '../admin/RefreshDialog';
import { AddToDialog } from './AddToDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { TagsDialog } from './TagsDialog';
import type { AddToKind, EditorTab, ItemKind } from './useItemActions';
import type { RefreshOptions } from '../../../domain/api';

type MoreDialogsProps = {
    id: string;
    type?: ItemKind;
    itemTitle?: string;
    editor: EditorTab | null;
    onCloseEditor: () => void;
    addTo: AddToKind | null;
    onCloseAddTo: () => void;
    refreshOpen: boolean;
    onCloseRefresh: () => void;
    onRefresh: (opts: RefreshOptions) => Promise<void>;
    tagsOpen: boolean;
    onCloseTags: () => void;
    confirmDelete: boolean;
    onCloseConfirmDelete: () => void;
    onDelete: () => Promise<void>;
};

/**
 * Renderiza los diálogos modales activados desde el menú MoreButton:
 * editor de metadatos, añadir a lista/colección, refrescar biblioteca,
 * editor de tags y confirmación de borrado.
 */
export function MoreDialogs({
    id,
    type = 'show',
    itemTitle,
    editor,
    onCloseEditor,
    addTo,
    onCloseAddTo,
    refreshOpen,
    onCloseRefresh,
    onRefresh,
    tagsOpen,
    onCloseTags,
    confirmDelete,
    onCloseConfirmDelete,
    onDelete
}: MoreDialogsProps) {
    return (
        <>
            {editor && (
                <MetadataEditor
                    itemId={id}
                    kind={type as EditorKind}
                    initialTab={editor}
                    itemTitle={itemTitle}
                    onRefresh={onRefresh}
                    onClose={onCloseEditor}
                />
            )}
            {addTo && (
                <AddToDialog
                    kind={addTo}
                    itemId={id}
                    itemTitle={itemTitle}
                    onClose={onCloseAddTo}
                />
            )}
            {refreshOpen && (
                <RefreshDialog
                    subject={itemTitle ?? ''}
                    onRefresh={onRefresh}
                    onClose={onCloseRefresh}
                />
            )}
            {tagsOpen && (
                <TagsDialog
                    itemId={id}
                    itemTitle={itemTitle}
                    onClose={onCloseTags}
                />
            )}
            {confirmDelete && (
                <ConfirmDialog
                    title={itemTitle ?
                        globalize.translate('ConfirmDeleteTitle', itemTitle) :
                        globalize.translate('HeaderDeleteItem')}
                    message={globalize.translate('ConfirmDeleteItem')}
                    confirmLabel={globalize.translate('Delete')}
                    onConfirm={onDelete}
                    onClose={onCloseConfirmDelete}
                />
            )}
        </>
    );
}
