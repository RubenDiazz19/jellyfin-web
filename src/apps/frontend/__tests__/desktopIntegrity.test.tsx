// Regla cardinal del proyecto (Fase 8.1): en desktop NADA de la maquinaria
// móvil (tokens M3, nav, PWA, ripple, tema) deja rastro. Esta suite activa
// todas las piezas a la vez bajo layout-desktop — incluso con un viewport
// ancho y display-mode standalone simulados — y verifica cero efectos.
// También cubre la transición en caliente mobile ↔ desktop (spec 8.2) y el
// theme switching solo-mobile (spec 8.1).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { themeVM } from '../domain/viewModels/ThemeViewModel';
import { MobileNav } from '../presentation/components/nav/MobileNav';
import { InstallBanner } from '../presentation/components/pwa/InstallBanner';
import { OfflineIndicator } from '../presentation/components/pwa/OfflineIndicator';
import { MobileThemeProvider } from '../presentation/theme/MobileThemeProvider';
import { initAdaptiveLayout } from '../shared/adaptiveLayout';
import { initPwa, registerServiceWorker, resetPwaForTests, watchStandalone } from '../shared/pwa';
import { initRipple } from '../shared/ripple';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

vi.mock('../domain/bridge/useSession', () => ({
    useSession: () => ({ session: { accessToken: 'tok' }, logout: () => undefined })
}));

const STYLE_ID = 'jfp-m3-tokens';

// matchMedia por query: viewport ancho, standalone y dark — el peor caso
// para un desktop que no debe reaccionar a nada de esto.
function installMatchMedia() {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    } as unknown as MediaQueryList));
}

function fireInstallPrompt() {
    const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' }>;
    };
    ev.prompt = () => Promise.resolve();
    ev.userChoice = Promise.resolve({ outcome: 'accepted' as const });
    act(() => { window.dispatchEvent(ev); });
    return ev;
}

async function flushMutations() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

let root: Root | null = null;
let host: HTMLElement | null = null;
let meta: HTMLMetaElement;
const cleanups: Array<() => void> = [];

function renderShell() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MemoryRouter>
                <MobileThemeProvider>
                    <MobileNav />
                    <OfflineIndicator />
                    <InstallBanner />
                </MobileThemeProvider>
            </MemoryRouter>
        );
    });
}

describe('integridad desktop (regla cardinal)', () => {
    beforeEach(() => {
        resetPwaForTests();
        localStorage.clear();
        themeVM.setMode('dark');
        themeVM.setSeed(null);
        document.documentElement.className = '';
        document.body.className = '';
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#202020';
        document.head.appendChild(meta);
        installMatchMedia();
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        cleanups.forEach((fn) => { fn(); });
        cleanups.length = 0;
        meta.remove();
        themeVM.setMode('dark');
        themeVM.setSeed(null);
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
        document.documentElement.className = '';
        document.body.className = '';
        document.getElementById(STYLE_ID)?.remove();
    });

    it('desktop: toda la maquinaria móvil activada a la vez no deja rastro', async () => {
        document.documentElement.classList.add('layout-desktop');
        const register = vi.fn(() => Promise.resolve({}));
        Object.defineProperty(navigator, 'serviceWorker', {
            value: { register }, configurable: true
        });
        localStorage.setItem('jfp-sw-dev', '1');

        // Toda la infraestructura que AppLayout monta.
        initPwa();
        cleanups.push(initAdaptiveLayout());
        cleanups.push(watchStandalone());
        cleanups.push(initRipple());
        const swRegistered = await registerServiceWorker();
        renderShell();

        // 1. Sin tokens M3 ni clases de layout extra.
        expect(document.getElementById(STYLE_ID)).toBeNull();
        expect(document.documentElement.classList.contains('layout-tablet')).toBe(false);
        expect(document.documentElement.classList.contains('jfp-standalone')).toBe(false);

        // 2. Sin navegación ni hueco de contenido.
        expect(host?.querySelector('nav')).toBeNull();
        expect(document.body.classList.contains('jfp-has-nav')).toBe(false);

        // 3. Sin service worker.
        expect(swRegistered).toBe(false);
        expect(register).not.toHaveBeenCalled();

        // 4. El prompt de instalación no se intercepta ni sale banner.
        const ev = fireInstallPrompt();
        expect(ev.defaultPrevented).toBe(false);
        expect(host?.textContent).not.toContain('Instalar');

        // 5. Sin indicador offline aunque se pierda la red.
        act(() => { window.dispatchEvent(new Event('offline')); });
        expect(host?.textContent).not.toContain('Sin conexión');

        // 6. Sin ripple aunque el elemento lo pida.
        const btn = document.createElement('button');
        btn.setAttribute('data-ripple', '');
        document.body.appendChild(btn);
        const down = new Event('pointerdown', { bubbles: true });
        Object.defineProperty(down, 'target', { value: btn });
        document.dispatchEvent(down);
        expect(btn.querySelector('.jfp-ripple-ink')).toBeNull();
        btn.remove();

        // 7. theme-color intacto, incluso cambiando el modo de tema.
        act(() => { themeVM.setMode('light'); });
        await flushMutations();
        expect(meta.content).toBe('#202020');
        expect(document.getElementById(STYLE_ID)).toBeNull();
    });

    it('transición en caliente: mobile → desktop limpia todo; volver lo restaura', async () => {
        document.documentElement.classList.add('layout-mobile');
        renderShell();

        // Estado móvil: tokens + nav + hueco + theme-color dinámico.
        expect(document.getElementById(STYLE_ID)).not.toBeNull();
        expect(host?.querySelector('nav')).not.toBeNull();
        expect(document.body.classList.contains('jfp-has-nav')).toBe(true);
        expect(meta.content).not.toBe('#202020');

        // layoutManager cambia a desktop (reescribe las clases de <html>).
        act(() => {
            document.documentElement.classList.remove('layout-mobile', 'layout-tablet');
            document.documentElement.classList.add('layout-desktop');
        });
        await flushMutations();

        expect(document.getElementById(STYLE_ID)).toBeNull();
        expect(host?.querySelector('nav')).toBeNull();
        expect(document.body.classList.contains('jfp-has-nav')).toBe(false);
        expect(meta.content).toBe('#202020');

        // Y de vuelta a móvil, la maquinaria reaparece.
        act(() => {
            document.documentElement.classList.remove('layout-desktop');
            document.documentElement.classList.add('layout-mobile');
        });
        await flushMutations();

        expect(document.getElementById(STYLE_ID)).not.toBeNull();
        expect(host?.querySelector('nav')).not.toBeNull();
    });

    it('theme switching (solo mobile): el style tag y theme-color siguen al modo', async () => {
        document.documentElement.classList.add('layout-mobile');
        renderShell();

        const styleTag = () => document.getElementById(STYLE_ID)?.textContent ?? '';
        expect(styleTag()).toContain('--md-sys-color-scheme: dark;');
        const darkMeta = meta.content;

        act(() => { themeVM.setMode('light'); });
        await flushMutations();
        expect(styleTag()).toContain('--md-sys-color-scheme: light;');
        expect(meta.content).not.toBe(darkMeta);

        act(() => { themeVM.setMode('dark'); });
        await flushMutations();
        expect(styleTag()).toContain('--md-sys-color-scheme: dark;');
        expect(meta.content).toBe(darkMeta);
    });
});
