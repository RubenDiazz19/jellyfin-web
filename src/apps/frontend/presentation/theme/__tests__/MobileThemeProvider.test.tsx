// Regla cardinal del proyecto: en desktop el provider NO debe dejar rastro.
// Estos tests montan el provider real contra jsdom y comprueban que el
// <style> de tokens solo existe bajo layout-mobile/layout-tablet.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../MobileThemeProvider';

// El sync remoto del tema arrastra la cadena legacy (jellyfin-apiclient,
// playbackmanager) al entorno de test: se corta aquí.
vi.mock('../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const STYLE_ID = 'jfp-m3-tokens';

// matchMedia controlable: guarda los listeners de cada query para poder
// simular que el usuario cambia la preferencia con la app abierta.
type FakeMql = MediaQueryList & { _set: (matches: boolean) => void };

function installMatchMedia(initial: Record<string, boolean> = {}) {
    const mqls = new Map<string, FakeMql>();
    const real = window.matchMedia;

    window.matchMedia = ((query: string) => {
        const existing = mqls.get(query);
        if (existing) return existing;
        const listeners = new Set<() => void>();
        const state = { matches: initial[query] ?? false };
        const mql = {
            media: query,
            get matches() { return state.matches; },
            addEventListener: (_: string, fn: () => void) => { listeners.add(fn); },
            removeEventListener: (_: string, fn: () => void) => { listeners.delete(fn); },
            _set: (matches: boolean) => {
                state.matches = matches;
                listeners.forEach((fn) => { fn(); });
            }
        } as unknown as FakeMql;
        mqls.set(query, mql);
        return mql;
    }) as unknown as typeof window.matchMedia;

    return {
        get: (query: string) => mqls.get(query),
        restore: () => { window.matchMedia = real; }
    };
}

const tokensCss = () => document.getElementById(STYLE_ID)?.textContent ?? '';

function renderProvider(): { root: Root; host: HTMLElement } {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
        root.render(
            <MobileThemeProvider>
                <span>app</span>
            </MobileThemeProvider>
        );
    });
    return { root, host };
}

describe('MobileThemeProvider', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
    });

    afterEach(() => {
        document.documentElement.className = '';
        document.getElementById(STYLE_ID)?.remove();
    });

    it('desktop: no inyecta ningún <style> de tokens (cero cambios)', () => {
        document.documentElement.classList.add('layout-desktop');
        const { root, host } = renderProvider();
        expect(document.getElementById(STYLE_ID)).toBeNull();
        act(() => { root.unmount(); });
        host.remove();
    });

    it('mobile: inyecta los tokens M3 y los retira al desmontar', () => {
        document.documentElement.classList.add('layout-mobile');
        const { root, host } = renderProvider();

        const style = document.getElementById(STYLE_ID);
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('--md-sys-color-primary');
        expect(style?.textContent).toContain('html.layout-mobile, html.layout-tablet');
        expect(style?.textContent).not.toContain(':root');

        act(() => { root.unmount(); });
        expect(document.getElementById(STYLE_ID)).toBeNull();
        host.remove();
    });

    it('tablet: también activa los tokens', () => {
        document.documentElement.classList.add('layout-tablet');
        const { root, host } = renderProvider();
        expect(document.getElementById(STYLE_ID)).not.toBeNull();
        act(() => { root.unmount(); });
        host.remove();
    });
});

describe('MobileThemeProvider: prefers-contrast', () => {
    let mm: ReturnType<typeof installMatchMedia>;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
    });

    afterEach(() => {
        mm?.restore();
        document.documentElement.className = '';
        document.getElementById(STYLE_ID)?.remove();
    });

    it('sin preferencia usa el contraste estándar', () => {
        document.documentElement.classList.add('layout-mobile');
        mm = installMatchMedia();
        const { root, host } = renderProvider();

        expect(tokensCss()).toContain('--md-sys-contrast: 0;');

        act(() => { root.unmount(); });
        host.remove();
    });

    it('con prefers-contrast: more sube el contraste y cambia la paleta', () => {
        document.documentElement.classList.add('layout-mobile');
        mm = installMatchMedia();
        const { root: base, host: baseHost } = renderProvider();
        const standard = tokensCss();
        act(() => { base.unmount(); });
        baseHost.remove();
        document.getElementById(STYLE_ID)?.remove();

        mm.restore();
        mm = installMatchMedia({ '(prefers-contrast: more)': true });
        const { root, host } = renderProvider();

        const css = tokensCss();
        expect(css).toContain('--md-sys-contrast: 1;');
        // No basta con emitir el nivel: la paleta tiene que responder.
        expect(css).not.toBe(standard);

        act(() => { root.unmount(); });
        host.remove();
    });

    it('con prefers-contrast: less baja el contraste', () => {
        document.documentElement.classList.add('layout-mobile');
        mm = installMatchMedia({ '(prefers-contrast: less)': true });
        const { root, host } = renderProvider();

        expect(tokensCss()).toContain('--md-sys-contrast: -0.5;');

        act(() => { root.unmount(); });
        host.remove();
    });

    it('cambiar la preferencia con la app abierta repinta los tokens', () => {
        document.documentElement.classList.add('layout-mobile');
        mm = installMatchMedia();
        const { root, host } = renderProvider();
        expect(tokensCss()).toContain('--md-sys-contrast: 0;');

        act(() => { mm.get('(prefers-contrast: more)')?._set(true); });
        expect(tokensCss()).toContain('--md-sys-contrast: 1;');

        act(() => { mm.get('(prefers-contrast: more)')?._set(false); });
        expect(tokensCss()).toContain('--md-sys-contrast: 0;');

        act(() => { root.unmount(); });
        host.remove();
    });

    it('desktop: prefers-contrast no deja rastro (regla cardinal)', () => {
        document.documentElement.classList.add('layout-desktop');
        mm = installMatchMedia({ '(prefers-contrast: more)': true });
        const { root, host } = renderProvider();

        expect(document.getElementById(STYLE_ID)).toBeNull();
        // Ni siquiera se suscribe a la query.
        expect(mm.get('(prefers-contrast: more)')).toBeUndefined();

        act(() => { root.unmount(); });
        host.remove();
    });
});
