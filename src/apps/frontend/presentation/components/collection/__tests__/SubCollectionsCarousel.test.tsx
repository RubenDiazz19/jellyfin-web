import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { SubCollectionsCarousel } from '../SubCollectionsCarousel';
import { ToastProvider } from '../../toast/ToastProvider';
import type { PlaylistItem } from '../../../../domain/api';

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(<ToastProvider>{ui}</ToastProvider>);
    });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('SubCollectionsCarousel', () => {
    test('no renderiza nada si la lista de items está vacía', async () => {
        await mount(<SubCollectionsCarousel items={[]} navigate={vi.fn()} />);
        expect(host?.querySelector('.subCollectionsCarousel')).toBeNull();
    });

    test('renderiza las cards de colección con su carrusel y título', async () => {
        const items: PlaylistItem[] = [
            { id: 'col-1', title: 'Marvel', kind: 'collection', poster: '/marvel.jpg' },
            { id: 'col-2', title: 'Vengadores', kind: 'collection', poster: '/vengadores.jpg' }
        ];

        const navigate = vi.fn();
        await mount(<SubCollectionsCarousel items={items} navigate={navigate} />);

        const container = host?.querySelector('.subCollectionsCarousel');
        expect(container).toBeTruthy();

        const cards = host?.querySelectorAll('[role="button"]');
        expect(cards?.length).toBe(2);

        // Al hacer clic en una tarjeta navega a la colección
        act(() => {
            (cards?.[0] as HTMLElement).click();
        });
        expect(navigate).toHaveBeenCalledWith({ page: 'list', kind: 'collection', listId: 'col-1' });
    });
});
