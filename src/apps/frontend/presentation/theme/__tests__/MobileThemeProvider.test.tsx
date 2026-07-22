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
