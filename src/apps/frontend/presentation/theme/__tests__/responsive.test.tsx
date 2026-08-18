import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../MobileThemeProvider';
import { useResponsive, useTallTablet, type Responsive } from '../responsive';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let seen: Responsive | null = null;

function Probe() {
    seen = useResponsive();
    return null;
}

let tall: boolean | null = null;

function TallProbe() {
    tall = useTallTablet();
    return null;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(<MobileThemeProvider><Probe /></MobileThemeProvider>);
    });
}

describe('useResponsive', () => {
    beforeEach(() => {
        seen = null;
        document.documentElement.className = '';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('mobile: 12px de margen, tarjetas de 156', () => {
        document.documentElement.classList.add('layout-mobile');
        render();
        expect(seen).toMatchObject({ touch: true, mobile: true, tablet: false, pagePad: 12, cardW: 156 });
    });

    it('tablet: 16px de margen, tarjetas de 200', () => {
        document.documentElement.classList.add('layout-mobile', 'layout-tablet');
        render();
        expect(seen).toMatchObject({ touch: true, mobile: false, tablet: true, pagePad: 16, cardW: 200 });
    });

    it('desktop: touch false (los componentes usan sus literales actuales)', () => {
        document.documentElement.classList.add('layout-desktop');
        render();
        expect(seen).toMatchObject({ touch: false, layout: null });
    });
});

describe('useTallTablet', () => {
    /** matchMedia de mentira: casa la query de aspecto y nada más. */
    function stubRatio(matches: boolean) {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query.includes('aspect-ratio') ? matches : false,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false
        }));
    }

    beforeEach(() => {
        tall = null;
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        vi.unstubAllGlobals();
    });

    it('false en una tabla casi cuadrada (943×992 → ratio ~1.05)', () => {
        stubRatio(false);
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        act(() => {
            root?.render(<MobileThemeProvider><TallProbe /></MobileThemeProvider>);
        });
        expect(tall).toBe(false);
    });

    it('true cuando el alto manda con claridad (820×1180 → ratio ~1.44)', () => {
        stubRatio(true);
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        act(() => {
            root?.render(<MobileThemeProvider><TallProbe /></MobileThemeProvider>);
        });
        expect(tall).toBe(true);
    });
});
