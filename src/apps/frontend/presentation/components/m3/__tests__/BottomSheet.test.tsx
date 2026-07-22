import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BottomSheet } from '../BottomSheet';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(onClose: () => void) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <BottomSheet title='Opciones del título' onClose={onClose}>
                <button>Descargar</button>
            </BottomSheet>
        );
    });
}

describe('BottomSheet', () => {
    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    it('se monta como portal con título y contenido', () => {
        render(() => undefined);
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog?.textContent).toContain('Opciones del título');
        expect(dialog?.textContent).toContain('Descargar');
    });

    it('el scrim cierra; el contenido no', () => {
        const onClose = vi.fn();
        render(onClose);
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement;

        act(() => { dialog.click(); });
        expect(onClose).not.toHaveBeenCalled();

        const scrim = dialog.parentElement as HTMLElement;
        act(() => { scrim.click(); });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape cierra', () => {
        const onClose = vi.fn();
        render(onClose);
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
