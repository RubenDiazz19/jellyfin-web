import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('lib/globalize', () => ({
    default: {
        translate: (key: string) => (key === 'ClearSelection' ? 'Quitar selección' : key === 'Select' ? 'Seleccionar' : key)
    }
}));

vi.mock('../../toast/ToastProvider', () => ({
    useToast: () => vi.fn()
}));

vi.mock('../../../../domain/bridge/useSession', () => ({
    useSession: () => ({ session: { accessToken: 'token123' } })
}));

vi.mock('../../player/PlayerProvider', () => ({
    usePlayer: () => ({ play: vi.fn() })
}));

import { SelectionMark } from '../SelectionMark';
import { selectionVM } from '../../../../domain/viewModels/SelectionViewModel';
import { MoreButton, type ItemMenuHandle } from '../../controls/MoreButton';

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

beforeEach(() => {
    selectionVM.stop();
});

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('SelectionMark', () => {
    test('renderiza círculo blanco con marca de verificación si está seleccionado', async () => {
        await mount(<SelectionMark selected={true} />);
        const mark = host?.firstElementChild as HTMLElement;
        expect(mark).toBeTruthy();
        expect(mark.style.background).toBe('rgb(255, 255, 255)');
        expect(mark.textContent).toBe('✓');
    });

    test('renderiza borde translúcido sin relleno si no está seleccionado', async () => {
        await mount(<SelectionMark selected={false} />);
        const mark = host?.firstElementChild as HTMLElement;
        expect(mark).toBeTruthy();
        expect(mark.style.background).toBe('rgba(0, 0, 0, 0.45)');
        expect(mark.textContent).toBe('');
    });
});

describe('MoreButton con opción de selección', () => {
    test('incluye «Seleccionar» en el menú cuando se pasa prop selectable', async () => {
        const handleRef = { current: null as ItemMenuHandle | null };
        await mount(
            <MoreButton
                id='item1'
                handle={handleRef}
                selectable={{
                    id: 'item1',
                    title: 'Título de prueba',
                    kind: 'movie'
                }}
            />
        );

        // Abrir menú en una coordenada
        act(() => {
            handleRef.current?.openAt(100, 100);
        });

        // El menú debe contener el botón de «Seleccionar»
        const buttons = Array.from(document.querySelectorAll('button'));
        const selectBtn = buttons.find((b) => b.textContent?.includes('Seleccionar'));
        expect(selectBtn).toBeTruthy();

        // Al pulsar «Seleccionar», selectionVM entra en modo selección
        act(() => {
            selectBtn?.click();
        });

        expect(selectionVM.selecting.value).toBe(true);
        expect(selectionVM.has('item1')).toBe(true);
    });

    test('muestra «Quitar selección» cuando el item ya está seleccionado', async () => {
        selectionVM.start({
            id: 'item1',
            title: 'Título de prueba',
            kind: 'movie'
        });

        const handleRef = { current: null as ItemMenuHandle | null };
        await mount(
            <MoreButton
                id='item1'
                handle={handleRef}
                selectable={{
                    id: 'item1',
                    title: 'Título de prueba',
                    kind: 'movie'
                }}
            />
        );

        act(() => {
            handleRef.current?.openAt(100, 100);
        });

        const buttons = Array.from(document.querySelectorAll('button'));
        const deselectBtn = buttons.find((b) => b.textContent?.includes('Quitar selección'));
        expect(deselectBtn).toBeTruthy();

        act(() => {
            deselectBtn?.click();
        });

        expect(selectionVM.has('item1')).toBe(false);
    });
});
