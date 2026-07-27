// Integración de la navegación: URL → página montada → navigate() → URL.
// Los tests de router.test.ts cubren la serialización pura; aquí se comprueba
// el cableado real dentro de App: que cada ruta monta su página, que navegar
// desde dentro de una página cambia la URL y la vista, y que el porterío de
// sesión (hidratando / sin sesión / con sesión) decide qué se pinta.
//
// Las páginas se sustituyen por stubs a propósito: lo que se prueba es el
// enrutado, no el fetching de cada pantalla.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Navigate } from '../app/router';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Estado de sesión que devuelve el mock de useSession; cada test lo ajusta
// antes de renderizar.
const sessionState = {
    session: { accessToken: 'tok' } as { accessToken: string } | null,
    hydrating: false
};

vi.mock('../domain/bridge/useSession', () => ({
    useSession: () => sessionState
}));

// El tema toca la API de servidor, que arrastra ServerConnections y con él
// medio bootstrap legacy. Se corta aquí, igual que en desktopIntegrity.
vi.mock('../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

// Cada stub anuncia su nombre y los props de ruta que recibió, para poder
// afirmar que los parámetros de la URL llegan hasta la página.
function stub(name: string) {
    return function Stub(props: Record<string, unknown>) {
        const detail = ['showId', 'seasonN', 'epN', 'movieId', 'genre', 'name', 'kind', 'initial']
            .filter((k) => props[k] !== undefined)
            .map((k) => `${k}=${String(props[k])}`)
            .join(' ');
        const navigate = props.navigate as Navigate | undefined;
        return (
            <div data-testid='page'>
                <span>{`page:${name}${detail ? ' ' + detail : ''}`}</span>
                {navigate && (
                    <button type='button' onClick={() => navigate({ page: 'movies' })}>
                        ir a movies
                    </button>
                )}
            </div>
        );
    };
}

vi.mock('../presentation/pages/HomePage', () => ({ HomePage: stub('home') }));
vi.mock('../presentation/pages/LibraryPage', () => ({ LibraryPage: stub('library') }));
vi.mock('../presentation/pages/ShowPage', () => ({ ShowPage: stub('show') }));
vi.mock('../presentation/pages/SeasonPage', () => ({ SeasonPage: stub('season') }));
vi.mock('../presentation/pages/EpisodePage', () => ({ EpisodePage: stub('episode') }));
vi.mock('../presentation/pages/MoviePage', () => ({ MoviePage: stub('movie') }));
vi.mock('../presentation/pages/SearchPage', () => ({ SearchPage: stub('search') }));
vi.mock('../presentation/pages/LoginPage', () => ({ LoginPage: stub('login') }));
vi.mock('../presentation/pages/GenrePage', () => ({ GenrePage: stub('genre') }));
vi.mock('../presentation/pages/FavoritesPage', () => ({ FavoritesPage: stub('favorites') }));
vi.mock('../presentation/pages/PersonPage', () => ({ PersonPage: stub('person') }));
vi.mock('../presentation/pages/SettingsPage', () => ({ SettingsPage: stub('settings') }));

// El panel de tweaks pinta controles propios que ensuciarían el textContent.
vi.mock('../presentation/components/tweaks/TweaksPanel', () => ({
    useTweaks: (defaults: unknown) => [defaults, () => undefined],
    TweaksPanel: () => null,
    TweakSection: () => null,
    TweakRadio: () => null
}));

import App from '../app/App';

// Sonda de URL: MemoryRouter no toca window.location, así que la ruta activa
// se lee desde dentro del árbol.
function LocationProbe() {
    const location = useLocation();
    return <span data-testid='url'>{location.pathname + location.search}</span>;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

async function renderAt(path: string) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
        root?.render(
            <MemoryRouter initialEntries={[path]}>
                <App />
                <LocationProbe />
            </MemoryRouter>
        );
    });
    // Las rutas lazy (favoritos, género, persona, ajustes) resuelven su
    // import dinámico en un microtask posterior al primer render.
    await act(async () => {
        await Promise.resolve();
    });
}

function shown(): string {
    return host?.querySelector('[data-testid="page"]')?.textContent ?? '';
}

function url(): string {
    return host?.querySelector('[data-testid="url"]')?.textContent ?? '';
}

describe('navegación del frontend', () => {
    beforeEach(() => {
        sessionState.session = { accessToken: 'tok' };
        sessionState.hydrating = false;
        // App resetea el scroll en cada cambio de ruta; jsdom no implementa
        // scrollTo y ensuciaría la salida con un warning por test.
        vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        vi.restoreAllMocks();
    });

    describe('cada URL monta su página', () => {
        const cases: Array<[string, string]> = [
            ['/', 'page:home'],
            ['/series', 'page:library kind=series'],
            ['/movies', 'page:library kind=movies'],
            ['/search', 'page:search'],
            ['/show/s1', 'page:show showId=s1'],
            ['/show/s1/season/2', 'page:season showId=s1 seasonN=2'],
            ['/show/s1/season/2/episode/5', 'page:episode showId=s1 seasonN=2 epN=5'],
            ['/movie/m9', 'page:movie movieId=m9'],
            ['/favorites', 'page:favorites'],
            ['/genre/Terror', 'page:genre genre=Terror'],
            ['/person/Ana', 'page:person name=Ana'],
            // settings y profile comparten página con distinta sección inicial
            ['/settings', 'page:settings initial=reproduccion'],
            ['/profile', 'page:settings initial=perfil']
        ];

        it.each(cases)('%s monta %s', async (path, expected) => {
            await renderAt(path);
            expect(shown()).toContain(expected);
        });

        it('una URL desconocida cae a la home en vez de dejar la pantalla vacía', async () => {
            await renderAt('/ruta-que-no-existe');
            expect(shown()).toContain('page:home');
        });
    });

    describe('navegar desde dentro de una página', () => {
        it('cambia la vista y la URL', async () => {
            await renderAt('/show/s1');
            expect(shown()).toContain('page:show');
            expect(url()).toBe('/show/s1');

            const btn = host?.querySelector('button');
            await act(async () => {
                btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(shown()).toContain('page:library kind=movies');
            expect(url()).toBe('/movies');
        });
    });

    describe('portería de sesión', () => {
        it('sin sesión pinta el login, no la app', async () => {
            sessionState.session = null;
            await renderAt('/movies');
            expect(shown()).toContain('page:login');
            expect(shown()).not.toContain('page:library');
        });

        it('mientras hidrata no pinta el login (evita el flash en cada recarga)', async () => {
            sessionState.session = null;
            sessionState.hydrating = true;
            await renderAt('/');
            expect(host?.textContent).not.toContain('page:login');
            expect(host?.textContent).toContain('Cargando');
        });

        it('con sesión ignora el login aunque la URL sea la raíz', async () => {
            await renderAt('/');
            expect(shown()).toContain('page:home');
            expect(shown()).not.toContain('page:login');
        });
    });
});
