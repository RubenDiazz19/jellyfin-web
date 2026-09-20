import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { CollectionCardCarousel } from '../CollectionCardCarousel';
import type { PlaylistItem } from '../../../../domain/api';

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

describe('CollectionCardCarousel', () => {
    test('no renderiza nada si la lista de items está vacía', async () => {
        await mount(<CollectionCardCarousel items={[]} navigate={vi.fn()} />);
        expect(host?.innerHTML).toBe('');
    });

    test('renderiza las cards con scroll horizontal', async () => {
        const items: PlaylistItem[] = [
            { id: '1', title: 'Película 1', kind: 'movie', year: 2021, poster: '/p1.jpg' },
            { id: '2', title: 'Serie 1', kind: 'show', year: 2022, poster: '/s1.jpg' }
        ];

        await mount(<CollectionCardCarousel items={items} navigate={vi.fn()} />);

        const container = host?.querySelector('.collectionCarouselContainer');
        expect(container).toBeTruthy();

        const cards = host?.querySelectorAll('.collectionCardPremium');
        expect(cards?.length).toBe(2);
    });

    test('aplica el ancho estilizado a las tarjetas en escritorio', async () => {
        const items: PlaylistItem[] = [
            { id: '1', title: 'Película 1', kind: 'movie', year: 2021, poster: '/p1.jpg' }
        ];

        await mount(<CollectionCardCarousel items={items} navigate={vi.fn()} />);

        const card = host?.querySelector<HTMLElement>('.collectionCardPremium');
        expect(card).toBeTruthy();
        expect(card?.style.width).toBe('316px');
        expect(card?.style.flex).toBe('0 0 316px');
    });
});
