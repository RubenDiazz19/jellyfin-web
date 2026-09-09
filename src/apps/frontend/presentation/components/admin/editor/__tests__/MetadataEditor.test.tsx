import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import globalize from 'lib/globalize';
import { MetadataEditor } from '../MetadataEditor';

const mockRefreshItemMetadata = vi.fn();
const mockTasksVMExpect = vi.fn();

vi.mock('../../../../../domain/api', () => ({
    refreshItemMetadata: (...args: unknown[]) => mockRefreshItemMetadata(...args)
}));

vi.mock('../../../../../domain/viewModels/TasksViewModel', () => ({
    tasksVM: {
        expect: (...args: unknown[]) => mockTasksVMExpect(...args)
    }
}));

vi.mock('../../../toast/ToastProvider', () => ({
    useToast: () => vi.fn()
}));

vi.mock('../MetadataTab', () => ({
    MetadataTab: () => <div data-testid='metadata-tab'>Metadata Content</div>
}));

vi.mock('../../RefreshDialog', () => ({
    RefreshDialog: ({ subject, onRefresh, onClose }: {
        subject: string;
        onRefresh: (opts: unknown) => Promise<void>;
        onClose: () => void;
    }) => (
        <div data-testid='refresh-dialog'>
            <span data-testid='refresh-subject'>{subject}</span>
            <button data-testid='confirm-refresh' onClick={() => onRefresh({ mode: 'scan' })}>Confirm</button>
            <button data-testid='close-refresh' onClick={onClose}>Close</button>
        </div>
    )
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    vi.clearAllMocks();
});

describe('MetadataEditor', () => {
    beforeEach(() => {
        mockRefreshItemMetadata.mockResolvedValue(undefined);
    });

    test('muestra el botón de actualizar metadatos en la cabecera y abre RefreshDialog', async () => {
        const onClose = vi.fn();
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);

        await act(async () => {
            root?.render(
                <MetadataEditor
                    itemId='movie-1'
                    kind='movie'
                    itemTitle='Gladiator'
                    onClose={onClose}
                />
            );
        });

        // Comprueba que el título de la cabecera existe
        expect(document.body.textContent).toContain(globalize.translate('EditMetadata'));

        // Busca el botón de actualizar metadatos
        const refreshBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes(globalize.translate('RefreshMetadata'))
        );
        expect(refreshBtn).not.toBeUndefined();

        // Antes de pulsar no debe estar abierto RefreshDialog
        expect(document.body.querySelector('[data-testid="refresh-dialog"]')).toBeNull();

        // Pulsa el botón de actualizar metadatos
        await act(async () => {
            refreshBtn?.click();
        });

        // Ahora debe estar visible RefreshDialog con el título adecuado
        const dialog = document.body.querySelector('[data-testid="refresh-dialog"]');
        expect(dialog).not.toBeNull();
        expect(document.body.querySelector('[data-testid="refresh-subject"]')?.textContent).toBe('Gladiator');

        // Confirmar el refresco
        const confirmBtn = document.body.querySelector('[data-testid="confirm-refresh"]') as HTMLButtonElement;
        await act(async () => {
            confirmBtn.click();
        });

        expect(mockRefreshItemMetadata).toHaveBeenCalledWith('movie-1', { mode: 'scan' });
    });

    test('permite cerrar el editor con el botón cerrar', async () => {
        const onClose = vi.fn();
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);

        await act(async () => {
            root?.render(
                <MetadataEditor
                    itemId='movie-1'
                    kind='movie'
                    onClose={onClose}
                />
            );
        });

        const closeBtn = document.body.querySelector('button[aria-label="' + globalize.translate('ButtonClose') + '"]') as HTMLButtonElement;
        expect(closeBtn).not.toBeNull();

        await act(async () => {
            closeBtn.click();
        });

        expect(onClose).toHaveBeenCalled();
    });
});
