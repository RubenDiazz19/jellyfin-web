import globalize from 'lib/globalize';

import { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import { useFavListener } from '../../../domain/bridge/useFav';
import { FAVS } from '../../../domain/stores';
import { selectionVM, watchedKey, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { knownTags } from '../../../domain/viewModels/knownTags';
import { aboveNav } from '../nav/navMetrics';
import { BulkTagsDialog } from './BulkTagsDialog';
import { AddToDialog } from './AddToDialog';
import { ConfirmDialog } from './ConfirmDialog';

type Props = {
    /** Todo lo visible ahora mismo, para «seleccionar todo». Opcional si se resuelve desde SelectionViewModel. */
    items?: SelectableItem[];
};

/**
 * Barra flotante con las acciones del lote. Se pinta en un portal para que
 * quede por encima de la rejilla y del FAB de subir, sin que ningún
 * `overflow` de la página la recorte.
 */
export function SelectionBar({ items: propItems }: Props = {}) {
    const toast = useToast();
    const [tagsOpen, setTagsOpen] = useState(false);
    const [collectionOpen, setCollectionOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [, setFavTick] = useState(0);
    useFavListener(() => setFavTick((t) => t + 1));

    useVmSignals(selectionVM, (vm) => [vm.selecting, vm.selected, vm.busy, vm.visibleItems]);

    if (!selectionVM.selecting.value) return null;

    const items = propItems ?? selectionVM.visibleItems.value;
    const count = selectionVM.count.value;
    const busy = selectionVM.busy.value;
    const disabled = busy || count === 0;
    const hasItems = items.length > 0;

    const allFav = count > 0 && selectionVM.selected.value.every((i) =>
        FAVS.has(watchedKey(i))
    );

    const doWatched = async (watched: boolean) => {
        try {
            await selectionVM.markWatched(watched);
            toast(globalize.translate(watched ? 'MarkPlayed' : 'MarkUnplayed'), 'success');
            selectionVM.stop();
        } catch (e) {
            toast((e as Error).message, 'warn');
        }
    };

    const doFavorite = async () => {
        const next = !allFav;
        try {
            await selectionVM.markFavorite(next);
            toast(
                globalize.translate(next ? 'MessageAddedToFavorites' : 'MessageRemovedFromFavorites') + ` · ${count}`,
                'success'
            );
            selectionVM.stop();
        } catch (e) {
            toast((e as Error).message, 'warn');
        }
    };

    const doQueue = () => {
        const n = selectionVM.enqueue();
        toast(globalize.translate('MessageAddedToQueue') + ` · ${n}`, 'success');
        selectionVM.stop();
    };

    const doDelete = async () => {
        try {
            const n = await selectionVM.deleteSelected();
            toast(globalize.translate('MessageItemDeleted') + ` · ${n}`, 'success');
            selectionVM.stop();
        } catch (e) {
            toast((e as Error).message, 'warn');
            throw e;
        }
    };

    return ReactDOM.createPortal(
        <>
            <div
                style={{
                    position: 'fixed', left: '50%', transform: 'translateX(-50%)',
                    // En desktop no hay navegación flotante y la var no
                    // existe: quedan los 24px + safe-area de siempre.
                    bottom: aboveNav(24), zIndex: 9000,
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    maxWidth: 'calc(100vw - 32px)',
                    padding: '10px 12px', borderRadius: 999,
                    background: 'rgba(22,22,24,0.97)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
                    fontFamily: T.ui, color: '#fff'
                }}
            >
                <span style={{ fontSize: 13, padding: '0 6px', whiteSpace: 'nowrap' }}>
                    {globalize.translate('HeaderSelectedCount', count)}
                </span>

                {hasItems && (
                    <BarButton
                        onClick={() => selectionVM.selectAll(items)}
                        disabled={busy || count === items.length}
                    >
                        {globalize.translate('SelectAll')}
                    </BarButton>
                )}
                <BarButton onClick={() => doWatched(true)} disabled={disabled}>
                    {globalize.translate('MarkPlayed')}
                </BarButton>
                <BarButton onClick={() => doWatched(false)} disabled={disabled}>
                    {globalize.translate('MarkUnplayed')}
                </BarButton>
                <BarButton onClick={doFavorite} disabled={disabled}>
                    {globalize.translate(allFav ? 'RemoveFromFavorites' : 'AddToFavorites')}
                </BarButton>
                <BarButton onClick={doQueue} disabled={disabled}>
                    {globalize.translate('AddToQueue')}
                </BarButton>
                <BarButton onClick={() => setCollectionOpen(true)} disabled={disabled}>
                    {globalize.translate('AddToCollection')}
                </BarButton>
                <BarButton onClick={() => setTagsOpen(true)} disabled={disabled}>
                    {globalize.translate('Tags')}
                </BarButton>
                <BarButton onClick={() => setConfirmDelete(true)} disabled={disabled} danger>
                    {globalize.translate('Delete')}
                </BarButton>

                <button
                    onClick={() => selectionVM.stop()}
                    aria-label={globalize.translate('ClearSelection')}
                    style={{
                        marginLeft: 4, width: 30, height: 30, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.10)', border: 'none', color: '#fff',
                        cursor: 'pointer', fontSize: 15, lineHeight: 1
                    }}
                >×</button>
            </div>

            {collectionOpen && (
                <AddToDialog
                    kind='collection'
                    itemIds={selectionVM.selected.value.map((i) => i.id)}
                    onClose={() => setCollectionOpen(false)}
                    onSuccess={() => selectionVM.stop()}
                />
            )}

            {confirmDelete && (
                <ConfirmDialog
                    title={globalize.translate('HeaderDeleteItems')}
                    message={globalize.translate('ConfirmDeleteItems')}
                    confirmLabel={globalize.translate('Delete')}
                    onConfirm={doDelete}
                    onClose={() => setConfirmDelete(false)}
                />
            )}

            {tagsOpen && (
                <BulkTagsDialog
                    count={count}
                    suggestions={knownTags()}
                    onClose={() => setTagsOpen(false)}
                    onApply={async (tags) => {
                        try {
                            const n = await selectionVM.addTags(tags);
                            toast(globalize.translate('MessageTagsAddedToCount', n), 'success');
                            setTagsOpen(false);
                            selectionVM.stop();
                        } catch (e) {
                            toast((e as Error).message, 'warn');
                        }
                    }}
                />
            )}
        </>,
        document.body
    );
}

function BarButton({
    onClick, disabled, danger, children
}: {
    onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
    let bg = disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)';
    let color = disabled ? T.dim : '#fff';
    if (danger && !disabled) {
        bg = 'rgba(239,68,68,0.2)';
        color = '#ff6b6b';
    }
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '7px 14px', borderRadius: 999, border: 'none',
                background: bg,
                color,
                fontFamily: T.ui, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                cursor: disabled ? 'default' : 'pointer'
            }}
        >
            {children}
        </button>
    );
}

/** Barra de selección a nivel de app. Se muestra en cualquier pantalla cuando hay selección activa. */
export function GlobalSelectionBar() {
    useVmSignals(selectionVM, (vm) => [vm.selecting]);
    if (!selectionVM.selecting.value) return null;
    return <SelectionBar />;
}
