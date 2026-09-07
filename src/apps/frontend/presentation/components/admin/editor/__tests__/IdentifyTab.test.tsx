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
