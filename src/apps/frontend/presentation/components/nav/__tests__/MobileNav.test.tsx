// MobileNav: bottom bar en móvil, rail en tablet, nada en desktop.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchVM } from '../../../../domain/viewModels/SearchViewModel';
import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { MobileNav } from '../MobileNav';
import { NAV_BOTTOM_VAR, NAV_LEFT_VAR } from '../navMetrics';

const navVar = (name: string) => document.documentElement.style.getPropertyValue(name);

/** matchMedia de mentira: solo casa la query que se le diga. */
function stubMedia({ landscape }: { landscape: boolean }) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: landscape && query.includes('landscape'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    }));
}

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Sesión siempre iniciada (la visibilidad por sesión se prueba aparte).
const sessionState: { token: string | null } = { token: 'tok' };
vi.mock('../../../../domain/bridge/useSession', () => ({
    useSession: () => ({
        session: sessionState.token ? { accessToken: sessionState.token } : null,
        logout: () => undefined
    })
}));

// El sync remoto del tema arrastra la cadena legacy al entorno de test.
vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

// El VM de búsqueda de verdad pide resultados al servidor al abrirse; aquí solo
// interesa que el segmento central abra la capa y se marque mientras está.
vi.mock('../../../../domain/viewModels/SearchViewModel', async () => {
    const { signal } = await import('@preact/signals-core');
    const overlayOpen = signal(false);
    return {
        searchVM: {
            overlayOpen,
            openOverlay: vi.fn(() => { overlayOpen.value = true; }),
            closeOverlay: vi.fn(() => { overlayOpen.value = false; })
        }
    };
});

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(initialPath = '/') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MemoryRouter initialEntries={[initialPath]}>
                <MobileThemeProvider>
                    <MobileNav />
                </MobileThemeProvider>
            </MemoryRouter>
        );
    });
}

describe('MobileNav', () => {
    beforeEach(() => {
        sessionState.token = 'tok';
        searchVM.overlayOpen.value = false;
        vi.mocked(searchVM.openOverlay).mockClear();
        vi.mocked(searchVM.closeOverlay).mockClear();
        localStorage.clear();
        document.documentElement.className = '';
        document.documentElement.removeAttribute('style');
        document.body.className = '';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        vi.unstubAllGlobals();
        document.documentElement.className = '';
        document.documentElement.removeAttribute('style');
        document.body.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('móvil: bottom bar con portada, búsqueda y listas, y hueco en el body', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');

        const nav = host?.querySelector('nav[data-variant="bar"]');
        expect(nav).not.toBeNull();
        const buttons = [...(nav?.querySelectorAll('button') ?? [])];
        expect(buttons).toHaveLength(3);
        expect(document.body.classList.contains('jfp-has-nav')).toBe(true);
        // Los tres se nombran siempre, aunque en reposo solo se vea el icono.
        expect(buttons.map((b) => b.getAttribute('aria-label')))
            .toEqual(['Home', 'Search', 'Lists']);
    });

    it('solo el destino activo enseña su nombre', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');
        expect(host?.textContent).toBe('Home');
    });

    it('Ajustes NO es un destino de la píldora', () => {
        // Vive dentro del menú del avatar, como en escritorio: no es un sitio
        // donde uno esté.
        document.documentElement.classList.add('layout-mobile');
        render('/');
        expect(host?.textContent).not.toContain('Settings');
    });

    it('el segmento central abre la capa de búsqueda, no navega', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');

        const search = [...(host?.querySelectorAll('button') ?? [])]
            .find((b) => b.getAttribute('aria-label') === 'Search');
        act(() => { search?.click(); });

        expect(vi.mocked(searchVM.openOverlay)).toHaveBeenCalledTimes(1);
        // Se anuncia como capa que se abre y no como la página donde se está.
        expect(search?.getAttribute('aria-current')).toBeNull();
        expect(search?.getAttribute('aria-expanded')).toBe('true');
    });

    it('con la capa abierta manda la búsqueda, no la página de debajo', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');
        expect(host?.textContent).toBe('Home');

        act(() => { searchVM.overlayOpen.value = true; });
        expect(host?.textContent).toBe('Search');
        // Marcar dos a la vez (la capa y la portada de debajo) sería mentir.
        expect(host?.querySelector('[aria-current="page"]')).toBeNull();
    });

    // Salir de la búsqueda no debe obligar a ir a por la X de arriba.
    it('pulsar otro segmento cierra la búsqueda y navega', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');
        act(() => { searchVM.overlayOpen.value = true; });

        const listas = [...(host?.querySelectorAll('button') ?? [])]
            .find((b) => b.getAttribute('aria-label') === 'Lists');
        act(() => { listas?.click(); });

        expect(searchVM.overlayOpen.value).toBe(false);
        expect(listas?.getAttribute('aria-current')).toBe('page');
    });

    it('cierra la búsqueda aunque ya estuvieras en ese destino', () => {
        // Aquí la URL no cambia, así que cerrar «al navegar» no bastaría.
        document.documentElement.classList.add('layout-mobile');
        render('/');
        act(() => { searchVM.overlayOpen.value = true; });

        const inicio = [...(host?.querySelectorAll('button') ?? [])]
            .find((b) => b.getAttribute('aria-label') === 'Home');
        act(() => { inicio?.click(); });

        expect(searchVM.overlayOpen.value).toBe(false);
    });

    it('el propio segmento de búsqueda abre y cierra', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');

        const search = [...(host?.querySelectorAll('button') ?? [])]
            .find((b) => b.getAttribute('aria-label') === 'Search');
        act(() => { search?.click(); });
        expect(searchVM.overlayOpen.value).toBe(true);

        act(() => { search?.click(); });
        expect(searchVM.overlayOpen.value).toBe(false);
        expect(vi.mocked(searchVM.openOverlay)).toHaveBeenCalledTimes(1);
    });

    it('la ficha de una lista sigue contando como Listas', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/list/playlist/abc123');
        expect(host?.textContent).toBe('Lists');
    });

    it('en Ajustes no queda ningún destino marcado', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/settings');
        expect(host?.querySelector('[aria-current="page"]')).toBeNull();
    });

    it('tablet: variante rail', () => {
        document.documentElement.classList.add('layout-mobile', 'layout-tablet');
        render('/');
        expect(host?.querySelector('nav[data-variant="rail"]')).not.toBeNull();
    });

    it('móvil: publica el hueco de la píldora en la franja inferior', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');
        // Los segmentos flotan: el hueco es su alto (48) más los dos márgenes.
        expect(navVar(NAV_BOTTOM_VAR)).toContain('72px');
        // Por el lado no reserva nada: solo respeta el safe-area.
        expect(navVar(NAV_LEFT_VAR)).toBe('env(safe-area-inset-left, 0px)');
    });

    it('tablet: el hueco se pasa a la franja izquierda', () => {
        document.documentElement.classList.add('layout-mobile', 'layout-tablet');
        render('/');
        expect(navVar(NAV_LEFT_VAR)).toContain('72px');
        expect(navVar(NAV_BOTTOM_VAR)).toBe('env(safe-area-inset-bottom, 0px)');
    });

    it('en horizontal la píldora sigue abajo, aunque el ancho sea de tablet', () => {
        // Girar el móvil pasa el ancho de 390 a 844 y, por ancho, tocaría
        // rail: la navegación no debe cambiar de sitio al girar.
        stubMedia({ landscape: true });
        document.documentElement.classList.add('layout-mobile', 'layout-tablet');
        render('/');

        expect(host?.querySelector('nav[data-variant="bar"]')).not.toBeNull();
        expect(host?.querySelector('nav[data-variant="rail"]')).toBeNull();
        expect(navVar(NAV_BOTTOM_VAR)).toContain('72px');
        expect(navVar(NAV_LEFT_VAR)).toBe('env(safe-area-inset-left, 0px)');
    });

    it('marca el destino activo y navega al pulsar otro', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');

        const buttons = [...(host?.querySelectorAll('button') ?? [])];
        const inicio = buttons.find((b) => b.getAttribute('aria-label') === 'Home');
        const listas = buttons.find((b) => b.getAttribute('aria-label') === 'Lists');
        expect(inicio?.getAttribute('aria-current')).toBe('page');
        expect(listas?.getAttribute('aria-current')).toBeNull();

        act(() => { listas?.click(); });
        expect(listas?.getAttribute('aria-current')).toBe('page');
        expect(inicio?.getAttribute('aria-current')).toBeNull();
    });

    it('en una página de detalle ningún destino queda activo', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/show/abc123');
        const current = host?.querySelector('[aria-current="page"]');
        expect(current).toBeNull();
    });

    it('desktop: no renderiza nada ni toca el body', () => {
        document.documentElement.classList.add('layout-desktop');
        render('/');
        expect(host?.querySelector('nav')).toBeNull();
        expect(document.body.classList.contains('jfp-has-nav')).toBe(false);
        expect(navVar(NAV_BOTTOM_VAR)).toBe('');
        expect(navVar(NAV_LEFT_VAR)).toBe('');
    });

    it('sin sesión (login): oculta la navegación', () => {
        document.documentElement.classList.add('layout-mobile');
        sessionState.token = null;
        render('/');
        expect(host?.querySelector('nav')).toBeNull();
        expect(document.body.classList.contains('jfp-has-nav')).toBe(false);
        expect(navVar(NAV_BOTTOM_VAR)).toBe('');
    });

    it('al desmontarse devuelve el layout como estaba', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');
        act(() => { root?.unmount(); });
        expect(document.body.classList.contains('jfp-has-nav')).toBe(false);
        expect(navVar(NAV_BOTTOM_VAR)).toBe('');
        expect(navVar(NAV_LEFT_VAR)).toBe('');
    });
});
