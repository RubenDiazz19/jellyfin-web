import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { MenuEntry } from '../MenuEntry';
import { PopupPanel } from '../PopupPanel';
import { LoadState } from '../LoadState';

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('MenuEntry', () => {
    test('ejecuta onClick al hacer clic cuando no está deshabilitado', async () => {
        const onClick = vi.fn();
        await mount(<MenuEntry onClick={onClick}>Opción</MenuEntry>);
        const btn = host?.querySelector('button');
        expect(btn).toBeTruthy();
        await act(async () => {
            btn?.click();
        });
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('no ejecuta onClick si está deshabilitado', async () => {
        const onClick = vi.fn();
        await mount(<MenuEntry disabled onClick={onClick}>Opción</MenuEntry>);
        const btn = host?.querySelector('button');
        await act(async () => {
            btn?.click();
        });
        expect(onClick).not.toHaveBeenCalled();
    });
});

describe('PopupPanel', () => {
    test('se renderiza en portal cuando está abierto con posición', async () => {
        const onClose = vi.fn();
        await mount(
            <PopupPanel open={true} onClose={onClose} position={{ top: 100, left: 100 }}>
                <span>Contenido Panel</span>
            </PopupPanel>
        );
        const popup = document.querySelector('[data-jfp-popup]');
        expect(popup).toBeTruthy();
        expect(popup?.textContent).toContain('Contenido Panel');
    });

    test('Escape dispara onClose', async () => {
        const onClose = vi.fn();
        await mount(
            <PopupPanel open={true} onClose={onClose} position={{ top: 100, left: 100 }}>
                <span>Contenido Panel</span>
            </PopupPanel>
        );
        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('LoadState', () => {
    test('muestra error si hay error', async () => {
        await mount(
            <LoadState error='Error de red' count={5}>
                <div>Contenido</div>
            </LoadState>
        );
        expect(host?.textContent).toContain('Error de red');
    });

    test('muestra estado de carga si loading es true', async () => {
        await mount(
            <LoadState loading={true} loadingText='Cargando datos...'>
                <div>Contenido</div>
            </LoadState>
        );
        expect(host?.textContent).toContain('Cargando datos...');
    });

    test('muestra estado vacío si count es 0', async () => {
        await mount(
            <LoadState count={0} emptyText='No hay elementos'>
                <div>Contenido</div>
            </LoadState>
        );
        expect(host?.textContent).toContain('No hay elementos');
    });

    test('muestra children cuando los datos están listos', async () => {
        await mount(
            <LoadState count={3}>
                <div>Contenido Listo</div>
            </LoadState>
        );
        expect(host?.textContent).toContain('Contenido Listo');
    });
});
