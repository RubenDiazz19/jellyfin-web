import globalize from 'lib/globalize';

import { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import { selectionVM, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { knownTags } from '../../../domain/viewModels/knownTags';
import { BulkTagsDialog } from './BulkTagsDialog';

type Props = {
    /** Todo lo visible ahora mismo, para «seleccionar todo». */
    items: SelectableItem[];
};

/**
 * Barra flotante con las acciones del lote. Se pinta en un portal para que
 * quede por encima de la rejilla y del FAB de subir, sin que ningún
 * `overflow` de la página la recorte.
 */
export function SelectionBar({ items }: Props) {
    const toast = useToast();
    const [tagsOpen, setTagsOpen] = useState(false);
    useVmSignals(selectionVM, (vm) => [vm.selecting, vm.selected, vm.busy]);

    if (!selectionVM.selecting.value) return null;

    const count = selectionVM.count.value;
    const busy = selectionVM.busy.value;
    const disabled = busy || count === 0;

    const doWatched = async (watched: boolean) => {
        try {
            await selectionVM.markWatched(watched);
            toast(globalize.translate(watched ? 'MarkPlayed' : 'MarkUnplayed'), 'success');
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

    return ReactDOM.createPortal(
        <>
            <div
                style={{
                    position: 'fixed', left: '50%', transform: 'translateX(-50%)',
                    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', zIndex: 9000,
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

                <BarButton
                    onClick={() => selectionVM.selectAll(items)}
                    disabled={busy || count === items.length}
                >
                    {globalize.translate('SelectAll')}
                </BarButton>
                <BarButton onClick={() => doWatched(true)} disabled={disabled}>
                    {globalize.translate('MarkPlayed')}
                </BarButton>
                <BarButton onClick={() => doWatched(false)} disabled={disabled}>
                    {globalize.translate('MarkUnplayed')}
                </BarButton>
                <BarButton onClick={doQueue} disabled={disabled}>
                    {globalize.translate('AddToQueue')}
                </BarButton>
                <BarButton onClick={() => setTagsOpen(true)} disabled={disabled}>
                    {globalize.translate('Tags')}
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
    onClick, disabled, children
}: {
    onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '7px 14px', borderRadius: 999, border: 'none',
                background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)',
                color: disabled ? T.dim : '#fff',
                fontFamily: T.ui, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                cursor: disabled ? 'default' : 'pointer'
            }}
        >
            {children}
        </button>
    );
}
