import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { CollectionCard } from '../CollectionCard';
import { COLLECTION_STYLES } from '../../../../domain/stores';
import { ToastProvider } from '../../toast/ToastProvider';

vi.mock('../../../../domain/api', async (importActual) => {
    const actual = await importActual<typeof import('../../../../domain/api')>();
    return {
        ...actual,
        imageUrl: (id: string, type: string) => `http://mock/${id}/${type}`
    };
});

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

beforeEach(() => {
    COLLECTION_STYLES._reset();
});

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('CollectionCard', () => {
    test('renderiza backdrop e imagen por defecto cuando no hay estilo personalizado', async () => {
        await mount(
            <CollectionCard
                id='col-1'
                title='Star Wars'
                backdrop='http://server/sw-backdrop.jpg'
                image='http://server/sw-poster.jpg'
                onClick={vi.fn()}
            />
        );

        const img = host?.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
        expect(img?.src).toBe('http://server/sw-backdrop.jpg');
    });

    test('prioriza customBackdrop de COLLECTION_STYLES sobre las props', async () => {
        COLLECTION_STYLES.setBackdrop('col-1', 'http://custom/sw-lego.jpg');

        await mount(
            <CollectionCard
                id='col-1'
                title='Star Wars'
                backdrop='http://server/sw-backdrop.jpg'
                image='http://server/sw-poster.jpg'
                onClick={vi.fn()}
            />
        );

        const img = host?.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
        expect(img?.src).toBe('http://custom/sw-lego.jpg');
    });

    test('prioriza customLogo de COLLECTION_STYLES sobre la prop logo', async () => {
        COLLECTION_STYLES.setLogo('col-1', 'http://custom/sw-logo.png');

        await mount(
            <CollectionCard
                id='col-1'
                title='Star Wars'
                logo='http://server/sw-default-logo.png'
                onClick={vi.fn()}
            />
        );

        const logoImg = host?.querySelector('img[alt="Star Wars"]') as HTMLImageElement | null;
        expect(logoImg?.src).toBe('http://custom/sw-logo.png');
    });

    test('reacciona dinámicamente al evento de COLLECTION_STYLES', async () => {
        await mount(
            <CollectionCard
                id='col-1'
                title='Star Wars'
                backdrop='http://server/sw-backdrop.jpg'
                onClick={vi.fn()}
            />
        );

        let img = host?.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
        expect(img?.src).toBe('http://server/sw-backdrop.jpg');

        await act(async () => {
            COLLECTION_STYLES.setPreview('col-1', 'Backdrop', 'blob:preview-sw');
        });

        img = host?.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
        expect(img?.src).toBe('blob:preview-sw');
    });
});
