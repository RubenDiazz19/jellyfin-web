// Overlays PWA (banner de instalación + indicador offline): visibles solo
// en mobile/tablet; en desktop no renderizan nada.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initPwa, resetPwaForTests } from '../../../../shared/pwa';
import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { InstallBanner } from '../InstallBanner';
import { OfflineIndicator } from '../OfflineIndicator';

// El sync remoto del tema arrastra la cadena legacy (jellyfin-apiclient,
// playbackmanager) al entorno de test: se corta aquí.
vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(<MobileThemeProvider>{ui}</MobileThemeProvider>);
    });
}

function fireInstallPrompt() {
    const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' }>;
    };
    ev.prompt = vi.fn(() => Promise.resolve());
    ev.userChoice = Promise.resolve({ outcome: 'accepted' as const });
    act(() => { window.dispatchEvent(ev); });
}

describe('overlays PWA', () => {
    beforeEach(() => {
        resetPwaForTests();
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

    describe('InstallBanner', () => {
        it('mobile: aparece con el prompt capturado y se instala al pulsar', () => {
            document.documentElement.classList.add('layout-mobile');
            initPwa();
            render(<InstallBanner />);
            expect(host?.textContent).not.toContain('Instalar Jellyfin');

            fireInstallPrompt();
            expect(host?.textContent).toContain('Instalar Jellyfin');
        });

        it('"Ahora no" lo oculta y persiste el rechazo', () => {
            document.documentElement.classList.add('layout-mobile');
            initPwa();
            render(<InstallBanner />);
            fireInstallPrompt();

            const dismissBtn = [...(host?.querySelectorAll('button') ?? [])]
                .find((b) => b.textContent === 'Ahora no');
            expect(dismissBtn).toBeDefined();
            act(() => { dismissBtn?.click(); });

            expect(host?.textContent).not.toContain('Instalar Jellyfin');
            expect(Number(localStorage.getItem('jfp-install-dismissed'))).toBeGreaterThan(0);
        });

        it('desktop: nunca renderiza', () => {
            document.documentElement.classList.add('layout-desktop');
            initPwa();
            render(<InstallBanner />);
            fireInstallPrompt();
            expect(host?.textContent).not.toContain('Instalar');
        });
    });

    describe('OfflineIndicator', () => {
        it('mobile: aparece al perder la red y desaparece al recuperarla', () => {
            document.documentElement.classList.add('layout-mobile');
            render(<OfflineIndicator />);
            expect(host?.textContent).not.toContain('Sin conexión');

            act(() => { window.dispatchEvent(new Event('offline')); });
            expect(host?.textContent).toContain('Sin conexión');

            act(() => { window.dispatchEvent(new Event('online')); });
            expect(host?.textContent).not.toContain('Sin conexión');
        });

        it('desktop: no renderiza ni estando offline', () => {
            document.documentElement.classList.add('layout-desktop');
            render(<OfflineIndicator />);
            act(() => { window.dispatchEvent(new Event('offline')); });
            expect(host?.textContent).not.toContain('Sin conexión');
        });
    });
});
