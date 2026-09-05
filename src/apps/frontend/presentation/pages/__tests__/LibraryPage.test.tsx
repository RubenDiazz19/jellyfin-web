// Pruebas de LibraryPage: cabecera con título contenido, contador con singular/plural
// y nombre de entidad («series» / «películas»), ausencia del botón Seleccionar,
// y píldora minimalista de ordenación con desplegable interactivo.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/toast/ToastProvider';
import { libraryVM } from '../../../domain/viewModels/LibraryViewModel';
import { LibraryPage } from '../LibraryPage';
import type { Movie, Show } from '../../../domain/models';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

// Mock de Nav y ScrollTopFab para aislar la vista de biblioteca
vi.mock('../../components/layout/Nav', () => ({
    Nav: () => <nav data-testid='mock-nav' />
}));

vi.mock('../../components/m3/ScrollTopFab', () => ({
    ScrollTopFab: () => null
}));

// Mock de API y sesión para evitar efectos colaterales de red
vi.mock('../../../domain/bridge/useSession', () => ({
    useSession: () => ({ session: null, logout: () => undefined })
}));

vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(kind: 'series' | 'movies') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <ToastProvider>
                <LibraryPage kind={kind} navigate={() => undefined} />
            </ToastProvider>
        );
    });
}

function cleanup() {
    if (root && host) {
        act(() => {
            root?.unmount();
        });
        host.remove();
        root = null;
        host = null;
    }
}

describe('LibraryPage', () => {
    beforeEach(() => {
        vi.spyOn(libraryVM, 'load').mockImplementation(() => Promise.resolve());
        libraryVM.loading.value = false;
        libraryVM.error.value = null;
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('renderiza la cabecera de Series con título limpio «2 Series» y sin botón Seleccionar', () => {
        libraryVM.kind.value = 'series';
        libraryVM.shows.value = [
            { id: '1', title: 'Serie A', year: 2024 } as Show,
            { id: '2', title: 'Serie B', year: 2023 } as Show
        ];

        render('series');

        // Título limpio de la página: X Series (sin duplicidad de Series 2 series)
        const heading = host?.querySelector('h1');
        expect(heading).not.toBeNull();
        expect(heading?.textContent).toMatch(/2 (Series|Shows)/i);

        // No debe haber un span separado redundante al lado
        const extraSpan = host?.querySelector('div > span');
        expect(extraSpan).toBeNull();

        // No debe existir el botón de Seleccionar
        const allButtons = Array.from(host?.querySelectorAll('button') ?? []);
        const selectBtn = allButtons.find((b) => /seleccionar|select/i.test(b.textContent ?? ''));
        expect(selectBtn).toBeUndefined();

        // Debe existir la píldora de ordenación «Ordenar por»
        const sortPill = allButtons.find((b) => /ordenar por|sort by/i.test(b.textContent ?? ''));
        expect(sortPill).toBeDefined();
    });

    it('renderiza singular correctamente para 1 serie y para 1 película', () => {
        libraryVM.kind.value = 'series';
        libraryVM.shows.value = [{ id: '1', title: 'Serie única', year: 2024 } as Show];

        render('series');

        const seriesHeading = host?.querySelector('h1');
        expect(seriesHeading?.textContent).toMatch(/1 (Serie|Show)/i);

        cleanup();

        libraryVM.kind.value = 'movies';
        libraryVM.movies.value = [{ id: 'm1', title: 'Peli única', year: 2024 } as Movie];

        render('movies');

        const movieHeading = host?.querySelector('h1');
        expect(movieHeading?.textContent).toMatch(/1 (Película|Movie)/i);
    });

    it('abre el menú desplegable al pulsar la píldora de ordenación y permite cambiar el criterio', () => {
        libraryVM.kind.value = 'series';
        libraryVM.shows.value = [
            { id: '1', title: 'Serie A', year: 2024 } as Show,
            { id: '2', title: 'Serie B', year: 2023 } as Show
        ];

        const setSortSpy = vi.spyOn(libraryVM, 'setSort');

        render('series');

        const allButtons = Array.from(host?.querySelectorAll('button') ?? []);
        const sortPill = allButtons.find((b) => /ordenar por|sort by/i.test(b.textContent ?? ''));
        expect(sortPill).toBeDefined();

        // Pulsar la píldora abre el menú
        act(() => {
            sortPill?.click();
        });

        // En desktop se monta un PopupPanel con data-jfp-popup
        const popup = document.body.querySelector('[data-jfp-popup]');
        expect(popup).not.toBeNull();

        // Verificar que contiene las opciones de ordenación
        const options = Array.from(popup?.querySelectorAll('button') ?? []);
        expect(options.length).toBe(5);

        // Seleccionar una opción diferente (ej: Año)
        const yearOption = options.find((opt) => /año|year/i.test(opt.textContent ?? ''));
        expect(yearOption).toBeDefined();

        act(() => {
            yearOption?.click();
        });

        expect(setSortSpy).toHaveBeenCalledWith('year');

        // El menú debe haberse cerrado tras la selección
        const closedPopup = document.body.querySelector('[data-jfp-popup]');
        expect(closedPopup).toBeNull();
    });
});
