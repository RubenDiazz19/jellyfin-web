import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import globalize from 'lib/globalize';

const mocks = vi.hoisted(() => ({
    editor: vi.fn(),
    addTo: vi.fn(),
    refresh: vi.fn(),
    tags: vi.fn(),
    color: vi.fn(),
    confirm: vi.fn(),
    toast: vi.fn()
}));

vi.mock('../../toast/ToastProvider', () => ({
    useToast: () => mocks.toast
}));

vi.mock('../../admin/editor/MetadataEditor', () => ({
    MetadataEditor: (props: { initialTab: string; onClose: () => void }) => {
        mocks.editor(props);
        return <div data-testid='metadata-editor' data-tab={props.initialTab} onClick={props.onClose} />;
    }
}));

vi.mock('../AddToDialog', () => ({
    AddToDialog: (props: { kind: string; itemId: string; onClose: () => void }) => {
        mocks.addTo(props);
        return <div data-testid='add-to-dialog' onClick={props.onClose} />;
    }
}));

vi.mock('../../admin/RefreshDialog', () => ({
    RefreshDialog: (props: { subject: string; onClose: () => void }) => {
        mocks.refresh(props);
        return <div data-testid='refresh-dialog' onClick={props.onClose} />;
    }
}));

vi.mock('../TagsDialog', () => ({
    TagsDialog: (props: { itemId: string; onClose: () => void }) => {
        mocks.tags(props);
        return <div data-testid='tags-dialog' onClick={props.onClose} />;
    }
}));

vi.mock('../ColorPickerDialog', () => ({
    ColorPickerDialog: (props: { onClose: () => void }) => {
        mocks.color(props);
        return <div data-testid='color-picker-dialog' onClick={props.onClose} />;
    }
}));

vi.mock('../ConfirmDialog', () => ({
    ConfirmDialog: (props: { onClose: () => void }) => {
        mocks.confirm(props);
        return <div data-testid='confirm-dialog' onClick={props.onClose} />;
    }
}));

import { ListCardMenu } from '../ListCardMenu';

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root?.unmount();
        root = null;
    });
    host?.remove();
    host = null;
});

describe('ListCardMenu', () => {
    test('renderiza las opciones limpias de colección y abre los diálogos correspondientes', async () => {
        const onChanged = vi.fn();

        await act(async () => {
            root?.render(
                <ListCardMenu
                    kind='collection'
                    listId='col-123'
                    title='Star Wars'
                    onChanged={onChanged}
                />
            );
        });

        // Abrir el menú pulsando el botón de tres puntos
        const btn = host?.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
        expect(btn).not.toBeNull();

        await act(async () => {
            btn.click();
        });

        // Comprobar que contiene las opciones limpias y simplificadas
        const entries = Array.from(document.body.querySelectorAll('button')).map((b) => b.textContent?.trim());
        expect(entries).toContain(globalize.translate('AddToCollection'));
        expect(entries).toContain(globalize.translate('EditMetadata'));
        expect(entries).not.toContain(globalize.translate('RefreshMetadata'));
        expect(entries).toContain(globalize.translate('OptionBackgroundColor'));
        expect(entries).toContain(globalize.translate('HeaderDeleteCollection'));

        // No debe mostrar opciones redundantes dispersas
        expect(entries).not.toContain(globalize.translate('Identify'));
        expect(entries).not.toContain(globalize.translate('EditTags'));
        expect(entries).not.toContain(globalize.translate('EditImages'));

        // Pulsar "Editar metadatos"
        const editBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === globalize.translate('EditMetadata')
        );
        expect(editBtn).not.toBeUndefined();

        await act(async () => {
            editBtn?.click();
        });

        // Verifica que se abrió MetadataEditor en la pestaña 'metadata'
        expect(mocks.editor).toHaveBeenCalledWith(
            expect.objectContaining({
                initialTab: 'metadata'
            })
        );
    });

    test('abrir Añadir a la colección lanza AddToDialog con kind=collection', async () => {
        await act(async () => {
            root?.render(
                <ListCardMenu
                    kind='collection'
                    listId='col-123'
                    title='Star Wars'
                    onChanged={vi.fn()}
                />
            );
        });

        const btn = host?.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
        await act(async () => {
            btn.click();
        });

        const addBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === globalize.translate('AddToCollection')
        );
        expect(addBtn).not.toBeUndefined();

        await act(async () => {
            addBtn?.click();
        });

        expect(mocks.addTo).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'collection',
                itemId: 'col-123'
            })
        );
    });
});
