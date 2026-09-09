import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const getItemRaw = vi.fn();
const remoteSearch = vi.fn();
const applyRemoteSearchResult = vi.fn();

vi.mock('../../../../../domain/api', async (importActual) => {
    const actual = await importActual<typeof import('../../../../../domain/api')>();
    return {
        ...actual,
        getItemRaw: (...args: unknown[]) => getItemRaw(...args),
        remoteSearch: (...args: unknown[]) => remoteSearch(...args),
        applyRemoteSearchResult: (...args: unknown[]) => applyRemoteSearchResult(...args)
    };
});

import { IdentifyTab } from '../IdentifyTab';
import { ToastProvider } from '../../../toast/ToastProvider';

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
    vi.clearAllMocks();
    getItemRaw.mockResolvedValue({
        Id: 'col-1',
        Name: 'Star Wars Colección',
        ProductionYear: 1977
    });
    remoteSearch.mockResolvedValue([
        {
            Name: 'Star Wars Colección',
            ProductionYear: 1977,
            Overview: 'La saga completa de Star Wars',
            ImageUrl: 'http://image/sw.jpg',
            SearchProviderName: 'TheMovieDb'
        }
    ]);
    applyRemoteSearchResult.mockResolvedValue(undefined);
});

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('IdentifyTab', () => {
    test('usa BoxSet como tipo de búsqueda para colecciones y auto-busca al abrir', async () => {
        await mount(<IdentifyTab itemId='col-1' kind='collection' onClose={vi.fn()} />);

        expect(getItemRaw).toHaveBeenCalledWith('col-1');
        expect(remoteSearch).toHaveBeenCalledWith('col-1', 'BoxSet', {
            name: 'Star Wars Colección',
            year: 1977
        });

        const title = host?.textContent;
        expect(title).toContain('Star Wars Colección');
        expect(title).toContain('TheMovieDb');
    });

    test('permite buscar manualmente sin año y actualiza resultados', async () => {
        await mount(<IdentifyTab itemId='col-1' kind='collection' onClose={vi.fn()} />);

        // Limpiar mocks de la llamada automática al montar
        remoteSearch.mockClear();
        remoteSearch.mockResolvedValue([
            {
                Name: 'Star Wars: A New Hope',
                ProductionYear: 1977,
                SearchProviderName: 'TheMovieDb'
            },
            {
                Name: 'Star Wars: The Empire Strikes Back',
                ProductionYear: 1980,
                SearchProviderName: 'TheMovieDb'
            }
        ]);

        const inputs = host?.querySelectorAll('input');
        expect(inputs?.length).toBeGreaterThanOrEqual(2);
        const nameInput = inputs?.[0] as HTMLInputElement;
        const yearInput = inputs?.[1] as HTMLInputElement;

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        )?.set;

        await act(async () => {
            // Cambiar nombre a 'Star Wars' y vaciar año
            nativeInputValueSetter?.call(nameInput, 'Star Wars');
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nativeInputValueSetter?.call(yearInput, '');
            yearInput.dispatchEvent(new Event('input', { bubbles: true }));
        });

        const searchBtn = Array.from(host?.querySelectorAll('button') ?? [])
            .find((b) => b.textContent?.includes('Buscar') || b.textContent?.includes('Search'));
        expect(searchBtn).toBeDefined();

        await act(async () => {
            searchBtn?.click();
        });

        expect(remoteSearch).toHaveBeenCalledWith('col-1', 'BoxSet', {
            name: 'Star Wars',
            year: undefined,
            providerIds: undefined
        });

        expect(host?.textContent).toContain('Star Wars: A New Hope');
        expect(host?.textContent).toContain('Star Wars: The Empire Strikes Back');
    });

    test('utiliza it.Type de getItemRaw para Series cuando la API lo reporta como Serie', async () => {
        getItemRaw.mockResolvedValueOnce({
            Id: 'show-1',
            Name: 'Star Wars: The Clone Wars',
            Type: 'Series',
            ProductionYear: 2008
        });

        await mount(<IdentifyTab itemId='show-1' kind='movie' onClose={vi.fn()} />);

        // Aunque kind sea 'movie', it.Type='Series' resuelve que se busque como Series
        expect(remoteSearch).toHaveBeenCalledWith('show-1', 'Series', {
            name: 'Star Wars: The Clone Wars',
            year: 2008,
            providerIds: undefined
        });
    });

    test('permite aplicar el resultado de identificación', async () => {
        const onClose = vi.fn();
        await mount(<IdentifyTab itemId='col-1' kind='collection' onClose={onClose} />);

        // Botón de aplicar resultado
        const applyBtn = Array.from(host?.querySelectorAll('button') ?? [])
            .find((b) => b.textContent?.includes('Aplicar') || b.textContent?.includes('Apply'));
        expect(applyBtn).toBeDefined();

        await act(async () => {
            applyBtn?.click();
        });

        expect(applyRemoteSearchResult).toHaveBeenCalledWith('col-1', expect.objectContaining({
            Name: 'Star Wars Colección'
        }));
        expect(onClose).toHaveBeenCalled();
    });
});

