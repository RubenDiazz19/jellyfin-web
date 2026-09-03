import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('lib/globalize', () => ({
    default: {
        translate: (key: string, ...args: unknown[]) => {
            const map: Record<string, string> = {
                ClearSelection: 'Quitar selección',
                Select: 'Seleccionar',
                AddToFavorites: 'Añadir a favoritos',
                RemoveFromFavorites: 'Quitar de favoritos',
                AddToCollection: 'Añadir a una colección',
                Delete: 'Borrar',
                HeaderDeleteItems: 'Borrar elementos',
                ConfirmDeleteItems: 'Confirmar borrado',
                MarkPlayed: 'Marcar como visto',
                MarkUnplayed: 'Marcar como no visto',
                AddToQueue: 'Añadir a la cola',
                Tags: 'Etiquetas',
                SelectAll: 'Seleccionar todo',
                HeaderSelectedCount: `${args[0]} seleccionados`
            };
            return map[key] ?? key;
        }
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
import { selectionVM, type SelectableItem } from '../../../../domain/viewModels/SelectionViewModel';
import { MoreButton, type ItemMenuHandle } from '../../controls/MoreButton';
import { CollectionCard } from '../../collection/CollectionCard';
import { SelectionBar } from '../../controls/SelectionBar';
import { FAVS } from '../../../../domain/stores';

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

    test('incluye «Seleccionar» en el menú cuando es una colección', async () => {
        const handleRef = { current: null as ItemMenuHandle | null };
        await mount(
            <MoreButton
                id='col1'
                type='collection'
                handle={handleRef}
                selectable={{
                    id: 'col1',
                    title: 'Colección de prueba',
                    kind: 'collection'
                }}
            />
        );

        act(() => {
            handleRef.current?.openAt(100, 100);
        });

        const buttons = Array.from(document.querySelectorAll('button'));
        const selectBtn = buttons.find((b) => b.textContent?.includes('Seleccionar'));
        expect(selectBtn).toBeTruthy();

        act(() => {
            selectBtn?.click();
        });

        expect(selectionVM.selecting.value).toBe(true);
        expect(selectionVM.has('col1')).toBe(true);
    });
});

describe('CollectionCard con selección', () => {
    test('en modo selección, el clic alterna selección en lugar de invocar onClick', async () => {
        const onNavigate = vi.fn();
        const colItem: SelectableItem = {
            id: 'col1',
            title: 'Saga Star Wars',
            kind: 'collection'
        };
        selectionVM.start();

        await mount(
            <CollectionCard
                id='col1'
                title='Saga Star Wars'
                onClick={onNavigate}
                selectable={colItem}
            />
        );

        const card = host?.firstElementChild as HTMLElement;
        expect(card).toBeTruthy();

        act(() => {
            card.click();
        });

        expect(onNavigate).not.toHaveBeenCalled();
        expect(selectionVM.has('col1')).toBe(true);

        act(() => {
            card.click();
        });

        expect(selectionVM.has('col1')).toBe(false);
    });

    test('muestra outline blanco y SelectionMark cuando está seleccionada', async () => {
        const colItem: SelectableItem = {
            id: 'col1',
            title: 'Saga Star Wars',
            kind: 'collection'
        };
        selectionVM.start(colItem);

        await mount(
            <CollectionCard
                id='col1'
                title='Saga Star Wars'
                onClick={vi.fn()}
                selectable={colItem}
            />
        );

        const card = host?.firstElementChild as HTMLElement;
        expect(card.style.outline).toBe('3px solid #fff');
        const mark = host?.querySelector('span');
        expect(mark?.textContent).toBe('✓');
    });
});

describe('SelectionBar con nuevas opciones', () => {
    test('renderiza opciones de favoritos, colección y borrar', async () => {
        selectionVM.start({ id: 'item1', title: 'Peli 1', kind: 'movie' });

        await mount(<SelectionBar />);

        const buttons = Array.from(document.body.querySelectorAll('button'));
        const favBtn = buttons.find((b) => b.textContent?.includes('Añadir a favoritos'));
        const colBtn = buttons.find((b) => b.textContent?.includes('Añadir a una colección'));
        const delBtn = buttons.find((b) => b.textContent?.includes('Borrar'));

        expect(favBtn).toBeTruthy();
        expect(colBtn).toBeTruthy();
        expect(delBtn).toBeTruthy();
    });

    test('muestra «Quitar de favoritos» si todos los elementos están en favoritos', async () => {
        FAVS.setMany(['movie-item1'], true);
        selectionVM.start({ id: 'item1', title: 'Peli 1', kind: 'movie' });

        await mount(<SelectionBar />);

        const buttons = Array.from(document.body.querySelectorAll('button'));
        const unfavBtn = buttons.find((b) => b.textContent?.includes('Quitar de favoritos'));
        expect(unfavBtn).toBeTruthy();
    });

    test('pulsar borrar abre el diálogo de confirmación', async () => {
        selectionVM.start({ id: 'item1', title: 'Peli 1', kind: 'movie' });

        await mount(<SelectionBar />);

        const buttons = Array.from(document.body.querySelectorAll('button'));
        const delBtn = buttons.find((b) => b.textContent?.includes('Borrar'));
        expect(delBtn).toBeTruthy();

        act(() => {
            delBtn?.click();
        });

        const dialogTitle = document.body.textContent;
        expect(dialogTitle).toContain('Borrar elementos');
    });

    test('pulsar añadir a colección abre AddToDialog', async () => {
        selectionVM.start({ id: 'item1', title: 'Peli 1', kind: 'movie' });

        await mount(<SelectionBar />);

        const buttons = Array.from(document.body.querySelectorAll('button'));
        const colBtn = buttons.find((b) => b.textContent?.includes('Añadir a una colección'));
        expect(colBtn).toBeTruthy();

        await act(async () => {
            colBtn?.click();
        });

        const dialog = document.body.querySelector('[role="dialog"]');
        expect(dialog).toBeTruthy();
    });
});
