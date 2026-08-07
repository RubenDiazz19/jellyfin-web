// La capa de búsqueda se abre encima de una página. Si esa página cambia por
// debajo —el logo, el botón de atrás del navegador— la capa deja de estar
// encima de lo que el usuario miraba, y quedarse puesta obliga a ir a por la X.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchVM } from '../../../../domain/viewModels/SearchViewModel';
import { SearchOverlay } from '../SearchOverlay';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// El VM real pide resultados al servidor y arrastra la cadena legacy; aquí solo
// interesa cuándo se cierra la capa.
vi.mock('../../../../domain/viewModels/SearchViewModel', async () => {
    const { signal } = await import('@preact/signals-core');
    const overlayOpen = signal(false);
    return {
        searchVM: {
            overlayOpen,
            results: signal([]),
            start: () => () => undefined,
            openOverlay: () => { overlayOpen.value = true; },
            closeOverlay: vi.fn(() => { overlayOpen.value = false; })
        }
    };
});

// useResponsive cuelga del provider del tema, cuyo sync remoto arrastra la
// cadena legacy (jellyfin-apiclient, playbackmanager) con efectos de módulo.
vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

// Las tripas de la capa (caja, filtros, resultados, barra de selección) tienen
// sus propios tests y traen media aplicación con ellas.
vi.mock('../SearchInput', () => ({ SearchInput: () => null }));
vi.mock('../SearchFilters', () => ({ SearchFilters: () => null }));
vi.mock('../SearchResults', () => ({ SearchResults: () => null }));
vi.mock('../../controls/SelectionBar', () => ({ SelectionBar: () => null }));
vi.mock('../../../../domain/viewModels/SelectionViewModel', () => ({
    selectionVM: { stop: () => undefined }
}));

let root: Root | null = null;
let host: HTMLElement | null = null;
let go: ((path: string) => void) | null = null;

/** Expone el navigate de react-router para mover la página de debajo. */
function Harness() {
    const navigate = useNavigate();
    go = (path: string) => navigate(path);
    return <SearchOverlay navigate={() => undefined} />;
}

function render(initialPath = '/') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MemoryRouter initialEntries={[initialPath]}>
                <Harness />
            </MemoryRouter>
        );
    });
}

const isOpen = () => !!host?.querySelector('[role="dialog"]');

describe('SearchOverlay', () => {
    beforeEach(() => {
        searchVM.overlayOpen.value = false;
        vi.mocked(searchVM.closeOverlay).mockClear();
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        go = null;
        document.body.style.overflow = '';
    });

    it('cerrada no pinta nada', () => {
        render();
        expect(isOpen()).toBe(false);
    });

    it('se cierra sola cuando la página de debajo cambia', () => {
        render('/');
        act(() => { searchVM.overlayOpen.value = true; });
        expect(isOpen()).toBe(true);

        act(() => { go?.('/lists'); });
        expect(searchVM.closeOverlay).toHaveBeenCalled();
        expect(isOpen()).toBe(false);
    });

    it('abrirla estando en otra página no la cierra al momento', () => {
        // El primer render con la capa abierta ya trae una ruta: eso no es un
        // cambio de página, es dónde se abrió.
        render('/lists');
        act(() => { searchVM.overlayOpen.value = true; });
        expect(isOpen()).toBe(true);
        expect(searchVM.closeOverlay).not.toHaveBeenCalled();
    });

    it('reabrirla después de navegar la deja abierta en la nueva página', () => {
        render('/');
        act(() => { searchVM.overlayOpen.value = true; });
        act(() => { go?.('/lists'); });
        expect(isOpen()).toBe(false);

        act(() => { searchVM.overlayOpen.value = true; });
        expect(isOpen()).toBe(true);
    });
});
