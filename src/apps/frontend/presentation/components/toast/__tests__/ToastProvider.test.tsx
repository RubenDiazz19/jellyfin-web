// El toast se presenta como snackbar M3 (role=status) en táctil y como
// píldora en desktop.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { ToastProvider, useToast } from '../ToastProvider';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let fire: (msg: string) => void = (msg: string) => { void msg; };

function Trigger() {
    fire = useToast();
    return null;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MobileThemeProvider>
                <ToastProvider><Trigger /></ToastProvider>
            </MobileThemeProvider>
        );
    });
}

describe('ToastProvider', () => {
    beforeEach(() => {
        localStorage.clear();
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

    it('táctil: snackbar M3 con role status', () => {
        document.documentElement.classList.add('layout-mobile');
        render();
        act(() => { fire('Guardado'); });
        const status = host?.querySelector('[role="status"]');
        expect(status).not.toBeNull();
        expect(status?.textContent).toBe('Guardado');
    });

    it('desktop: píldora sin role status', () => {
        document.documentElement.classList.add('layout-desktop');
        render();
        act(() => { fire('Guardado'); });
        expect(host?.querySelector('[role="status"]')).toBeNull();
        expect(host?.textContent).toContain('Guardado');
    });
});
