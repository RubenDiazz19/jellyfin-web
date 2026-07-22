import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { ScrollTopFab } from '../ScrollTopFab';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

function setScrollY(v: number) {
    Object.defineProperty(window, 'scrollY', { value: v, configurable: true });
}

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(<MobileThemeProvider><ScrollTopFab /></MobileThemeProvider>);
    });
}

describe('ScrollTopFab', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
        setScrollY(0);
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('móvil: aparece al bajar y sube la página al pulsar', () => {
        document.documentElement.classList.add('layout-mobile');
        const scrollTo = vi.fn();
        window.scrollTo = scrollTo as unknown as typeof window.scrollTo;

        render();
        expect(host?.querySelector('button')).toBeNull();

        setScrollY(800);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        expect(host?.querySelector('button')).not.toBeNull();

        act(() => { host?.querySelector('button')?.click(); });
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('desktop: no se renderiza aunque haya scroll', () => {
        document.documentElement.classList.add('layout-desktop');
        render();
        setScrollY(1200);
        act(() => { window.dispatchEvent(new Event('scroll')); });
        expect(host?.querySelector('button')).toBeNull();
    });
});
