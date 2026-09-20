// Lo que se prueba del editor de fondos son sus dos contratos con el usuario:
// que reordenar deje las imágenes donde parece, y que un solo clic NUNCA borre
// nada. Este segundo es el motivo de que el `window.confirm()` se sustituyera
// por un botón de dos toques: la confirmación cambió de sitio, pero no puede
// desaparecer.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ImagesTab llega, por la fachada de domain/api, hasta ServerConnections y con
// él al bootstrap legacy (router raíz + playbackmanager), que tiene efectos a
// nivel de módulo. Se corta en la misma frontera que el resto de tests.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { movedTo, SectionHeader } from '../ImagesTab';
import { ConfirmDeleteButton } from '../primitives';

describe('movedTo', () => {
    const list = ['a', 'b', 'c', 'd'];

    test('lleva un elemento hacia atrás', () => {
        expect(movedTo(list, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    });

    test('lleva un elemento hacia delante', () => {
        expect(movedTo(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    });

    test('al final del todo', () => {
        expect(movedTo(list, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
    });

    test('moverlo a su sitio lo deja igual', () => {
        expect(movedTo(list, 1, 1)).toEqual(list);
    });

    test('no toca la lista original', () => {
        movedTo(list, 0, 3);
        expect(list).toEqual(['a', 'b', 'c', 'd']);
    });
});

let root: Root | null = null;
let host: HTMLElement | null = null;

async function render(ui: React.ReactElement) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root?.render(ui); });
}

function button(): HTMLButtonElement {
    const el = host?.querySelector('button');
    if (!el) throw new Error('no se ha pintado ningún botón');
    return el as HTMLButtonElement;
}

async function click() {
    await act(async () => { button().click(); });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    vi.useRealTimers();
});

describe('ConfirmDeleteButton', () => {
    const props = { idleLabel: 'Borrar', confirmLabel: '¿Borrar imagen?' };

    test('un solo clic no borra: arma y pregunta', async () => {
        const onConfirm = vi.fn(() => Promise.resolve());
        await render(<ConfirmDeleteButton {...props} onConfirm={onConfirm} />);

        await click();

        expect(onConfirm).not.toHaveBeenCalled();
        expect(button().getAttribute('aria-label')).toBe('¿Borrar imagen?');
    });

    test('el segundo clic sí borra', async () => {
        const onConfirm = vi.fn(() => Promise.resolve());
        await render(<ConfirmDeleteButton {...props} onConfirm={onConfirm} />);

        await click();
        await click();

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    test('se desarma solo: el clic de después vuelve a preguntar', async () => {
        vi.useFakeTimers();
        const onConfirm = vi.fn(() => Promise.resolve());
        await render(<ConfirmDeleteButton {...props} onConfirm={onConfirm} />);

        await click();
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(button().getAttribute('aria-label')).toBe('Borrar');

        await click();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('salir del botón lo desarma', async () => {
        const onConfirm = vi.fn(() => Promise.resolve());
        await render(<ConfirmDeleteButton {...props} onConfirm={onConfirm} />);

        await click();
        // React escucha `focusout`, no `blur`, así que hay que mover el foco
        // de verdad en vez de disparar el evento a mano.
        await act(async () => { button().focus(); button().blur(); });

        expect(button().getAttribute('aria-label')).toBe('Borrar');
    });

    test('si el borrado falla se puede reintentar', async () => {
        // Sin volver a 'idle', el botón se quedaría en «borrando…» para
        // siempre sobre una imagen que sigue ahí.
        const onConfirm = vi.fn(() => Promise.reject(new Error('HTTP 500')));
        await render(<ConfirmDeleteButton {...props} onConfirm={onConfirm} />);

        await click();
        await click();

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(button().getAttribute('aria-label')).toBe('Borrar');
        expect(button().disabled).toBe(false);
    });
});

describe('SectionHeader', () => {
    test('renderiza botones de iconos para buscar y para URL, sin botón de texto Buscar alternativas', async () => {
        const onSearch = vi.fn();
        const onApplyUrl = vi.fn();

        await render(
            <SectionHeader
                label='LOGO'
                onSearch={onSearch}
                loading={false}
                showing={false}
                onApplyUrl={onApplyUrl}
            />
        );

        // No debe haber botón con texto "Buscar alternativas"
        const buttons = host?.querySelectorAll('button') ?? [];
        const textBtn = Array.from(buttons).find((b) => b.textContent?.includes('Buscar alternativas'));
        expect(textBtn).toBeUndefined();

        // Debe haber dos botones de icono pequeños
        expect(buttons.length).toBe(2);

        // El primer botón de icono ejecuta onSearch (alternativas por API)
        await act(async () => {
            buttons[0]?.click();
        });
        expect(onSearch).toHaveBeenCalledTimes(1);

        // El segundo botón de icono (terminal) expande el campo de URL
        expect(host?.querySelector('input[type="url"]')).toBeNull();
        await act(async () => {
            buttons[1]?.click();
        });
        expect(host?.querySelector('input[type="url"]')).not.toBeNull();
    });
});

