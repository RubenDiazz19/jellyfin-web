// MobileNav: bottom bar en móvil, rail en tablet, nada en desktop.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { MobileNav } from '../MobileNav';

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
        localStorage.clear();
        document.documentElement.className = '';
        document.body.className = '';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.body.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('móvil: bottom bar con 5 destinos y hueco en el body', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');

        const nav = host?.querySelector('nav[data-variant="bar"]');
        expect(nav).not.toBeNull();
        expect(nav?.querySelectorAll('button')).toHaveLength(5);
        expect(document.body.classList.contains('jfp-has-nav')).toBe(true);
        expect(host?.textContent).toContain('Inicio');
        expect(host?.textContent).toContain('Ajustes');
    });

    it('tablet: variante rail', () => {
        document.documentElement.classList.add('layout-mobile', 'layout-tablet');
        render('/');
        expect(host?.querySelector('nav[data-variant="rail"]')).not.toBeNull();
    });

    it('marca el destino activo y navega al pulsar otro', () => {
        document.documentElement.classList.add('layout-mobile');
        render('/');

        const buttons = [...(host?.querySelectorAll('button') ?? [])];
        const inicio = buttons.find((b) => b.textContent?.includes('Inicio'));
        const series = buttons.find((b) => b.textContent?.includes('Series'));
        expect(inicio?.getAttribute('aria-current')).toBe('page');
        expect(series?.getAttribute('aria-current')).toBeNull();

        act(() => { series?.click(); });
        expect(series?.getAttribute('aria-current')).toBe('page');
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
    });

    it('sin sesión (login): oculta la navegación', () => {
        document.documentElement.classList.add('layout-mobile');
        sessionState.token = null;
        render('/');
        expect(host?.querySelector('nav')).toBeNull();
        expect(document.body.classList.contains('jfp-has-nav')).toBe(false);
    });
});
