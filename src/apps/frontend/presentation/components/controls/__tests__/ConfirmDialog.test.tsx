// Lo que se prueba de este diálogo es que sea DIFÍCIL de disparar sin querer.
//
// Se abre desde un menú desplegable y lo que borra es un fichero del disco, así
// que las salidas accidentales importan tanto como la acción: el foco arranca
// en Cancelar (un Enter reflejo no borra), Escape cancela, y pulsar dentro del
// panel no cuenta como pulsar fuera.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import globalize from 'lib/globalize';

import { ConfirmDialog } from '../ConfirmDialog';

// El botón de cancelar lo pone el propio diálogo, así que su texto sale del
// diccionario que carguen los tests (en-us); el de confirmar llega por props.
const CANCEL = globalize.translate('ButtonCancel');

let root: Root | null = null;
let host: HTMLElement | null = null;

const props = {
    title: '¿Borrar «Kabaneri»?',
    message: 'Se borra del disco y de la biblioteca.',
    confirmLabel: 'Borrar'
};

async function render(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
    const onConfirm = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
        root?.render(<ConfirmDialog {...props} onConfirm={onConfirm} onClose={onClose} {...overrides} />);
    });
    return { onConfirm, onClose };
}

/** El diálogo se pinta por portal en el body, no dentro del host. */
function dialog(): HTMLElement {
    const el = document.querySelector('[role="alertdialog"]');
    if (!el) throw new Error('no se ha pintado el diálogo');
    return el as HTMLElement;
}

function backdrop(): HTMLElement {
    return dialog().parentElement as HTMLElement;
}

function buttonNamed(text: string): HTMLButtonElement {
    const el = [...dialog().querySelectorAll('button')]
        .find((b) => b.textContent?.trim() === text);
    if (!el) throw new Error(`no hay botón «${text}»`);
    return el as HTMLButtonElement;
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('ConfirmDialog', () => {
    test('el foco arranca en Cancelar, no en el botón que borra', async () => {
        await render();
        expect(document.activeElement).toBe(buttonNamed(CANCEL));
    });

    test('confirmar ejecuta y cierra', async () => {
        const { onConfirm, onClose } = await render();
        await act(async () => { buttonNamed('Borrar').click(); });
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalled();
    });

    test('cancelar no ejecuta nada', async () => {
        const { onConfirm, onClose } = await render();
        await act(async () => { buttonNamed(CANCEL).click(); });
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    test('Escape cancela', async () => {
        const { onConfirm, onClose } = await render();
        await act(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(onClose).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('pulsar fuera cancela', async () => {
        const { onClose } = await render();
        await act(async () => { backdrop().click(); });
        expect(onClose).toHaveBeenCalled();
    });

    test('pulsar DENTRO del panel no cierra', async () => {
        // El clic burbujea hasta el fondo; sin comparar el target, leer el
        // mensaje cerraría el diálogo.
        const { onClose } = await render();
        await act(async () => { dialog().click(); });
        expect(onClose).not.toHaveBeenCalled();
    });

    test('si la acción falla el diálogo sigue abierto y se puede reintentar', async () => {
        const onConfirm = vi.fn(() => Promise.reject(new Error('HTTP 500')));
        const { onClose } = await render({ onConfirm });

        await act(async () => { buttonNamed('Borrar').click(); });

        expect(onClose).not.toHaveBeenCalled();
        expect(buttonNamed('Borrar').disabled).toBe(false);
    });
});
