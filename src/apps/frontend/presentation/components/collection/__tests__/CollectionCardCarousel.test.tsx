import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { CollectionCardCarousel } from '../CollectionCardCarousel';
import { COLLECTION_STYLES } from '../../../../domain/stores';
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

    test('Caso B: si las cards caben en la pantalla, se mantienen estáticas sin duplicación', async () => {
        // En jsdom por defecto window.innerWidth = 1024px.
        // 2 cards de 220px + 20px gap = 460px < 1024px.
        const items: PlaylistItem[] = [
            { id: '1', title: 'Película 1', kind: 'movie', year: 2021, poster: '/p1.jpg' },
            { id: '2', title: 'Serie 1', kind: 'show', year: 2022, poster: '/s1.jpg' }
        ];

        await mount(<CollectionCardCarousel items={items} navigate={vi.fn()} />);

        const container = host?.querySelector('.collectionCarouselContainer');
        expect(container).toBeTruthy();

        // En Caso B debe tener la clase estática centrada y exactamente 2 tarjetas
        const staticTrack = host?.querySelector('.collectionMarqueeStatic');
        expect(staticTrack).toBeTruthy();

        const cards = host?.querySelectorAll('.jfp-hoverlift');
        expect(cards?.length).toBe(2);
    });

    test('Caso A: si las cards desbordan la pantalla, activa animación de scroll continuo con exactamente 2 copias', async () => {
        // 10 cards de 220px + gaps = ~2380px > 1024px
        const items: PlaylistItem[] = Array.from({ length: 10 }, (_, i) => ({
            id: `item-${i}`,
            title: `Título ${i}`,
            kind: 'movie',
            year: 2020 + i,
            poster: `/p${i}.jpg`
        }));

        await mount(<CollectionCardCarousel items={items} navigate={vi.fn()} />);

        const container = host?.querySelector('.collectionCarouselContainer');
        expect(container).toBeTruthy();

        // En Caso A debe tener la clase animada y exactamente 2 copias (20 tarjetas en total)
        const animatedTrack = host?.querySelector('.collectionMarqueeAnimated');
        expect(animatedTrack).toBeTruthy();

        const cards = host?.querySelectorAll('.jfp-hoverlift');
        expect(cards?.length).toBe(20);
    });

    test('aplica el orden guardado previamente en COLLECTION_STYLES para la colección', async () => {
        const items: PlaylistItem[] = [
            { id: 'item-a', title: 'Película A', kind: 'movie', year: 2021, poster: '/a.jpg' },
            { id: 'item-b', title: 'Película B', kind: 'movie', year: 2022, poster: '/b.jpg' }
        ];

        COLLECTION_STYLES.setOrder('col-test-1', ['item-b', 'item-a']);

        await mount(<CollectionCardCarousel items={items} listId='col-test-1' navigate={vi.fn()} />);

        const cards = host?.querySelectorAll('[data-card-id]');
        expect(cards?.[0]?.getAttribute('data-card-id')).toBe('item-b');
        expect(cards?.[1]?.getAttribute('data-card-id')).toBe('item-a');
    });
});
