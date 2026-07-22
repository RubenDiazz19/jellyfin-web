import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    hasInstallPrompt,
    initPwa,
    isStandalone,
    promptInstall,
    registerServiceWorker,
    resetPwaForTests,
    watchStandalone
} from '../pwa';

type InstallEvent = Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): InstallEvent {
    const ev = new Event('beforeinstallprompt', { cancelable: true }) as InstallEvent;
    ev.prompt = vi.fn(() => Promise.resolve());
    ev.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(ev);
    return ev;
}

function mockServiceWorker() {
    const register = vi.fn(() => Promise.resolve({}));
    Object.defineProperty(navigator, 'serviceWorker', {
        value: { register },
        configurable: true
    });
    return register;
}

describe('pwa', () => {
    beforeEach(() => {
        resetPwaForTests();
        localStorage.clear();
        document.documentElement.className = '';
    });

    afterEach(() => {
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
        document.documentElement.className = '';
    });

    describe('registerServiceWorker', () => {
        it('desktop: NUNCA registra el service worker', async () => {
            document.documentElement.classList.add('layout-desktop');
            const register = mockServiceWorker();
            localStorage.setItem('jfp-sw-dev', '1'); // ni con el opt-in de dev

            expect(await registerServiceWorker()).toBe(false);
            expect(register).not.toHaveBeenCalled();
        });

        it('mobile: registra /serviceworker.js', async () => {
            document.documentElement.classList.add('layout-mobile');
            const register = mockServiceWorker();
            localStorage.setItem('jfp-sw-dev', '1');

            expect(await registerServiceWorker()).toBe(true);
            expect(register).toHaveBeenCalledWith('/serviceworker.js');
        });

        it('mobile en dev sin opt-in: no registra (protege el HMR)', async () => {
            document.documentElement.classList.add('layout-mobile');
            const register = mockServiceWorker();

            expect(await registerServiceWorker()).toBe(false);
            expect(register).not.toHaveBeenCalled();
        });
    });

    describe('install prompt', () => {
        it('mobile: captura beforeinstallprompt (preventDefault) y lo expone', async () => {
            document.documentElement.classList.add('layout-mobile');
            initPwa();
            const ev = fireBeforeInstallPrompt();

            expect(ev.defaultPrevented).toBe(true);
            expect(hasInstallPrompt()).toBe(true);

            expect(await promptInstall()).toBe('accepted');
            expect(ev.prompt).toHaveBeenCalled();
            expect(hasInstallPrompt()).toBe(false);
        });

        it('desktop: no intercepta el prompt (Chrome conserva su UI nativa)', () => {
            document.documentElement.classList.add('layout-desktop');
            initPwa();
            const ev = fireBeforeInstallPrompt();

            expect(ev.defaultPrevented).toBe(false);
            expect(hasInstallPrompt()).toBe(false);
        });

        it('si el usuario rechaza, el prompt sigue disponible para más tarde', async () => {
            document.documentElement.classList.add('layout-mobile');
            initPwa();
            fireBeforeInstallPrompt('dismissed');

            expect(await promptInstall()).toBe('dismissed');
            expect(hasInstallPrompt()).toBe(true);
        });
    });

    describe('standalone', () => {
        function mockDisplayMode(matches: boolean) {
            const mql = {
                matches,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            };
            vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
        }

        it('mobile instalada: pone jfp-standalone en <html> y el cleanup la quita', () => {
            document.documentElement.classList.add('layout-mobile');
            mockDisplayMode(true);

            expect(isStandalone()).toBe(true);
            const stop = watchStandalone();
            expect(document.documentElement.classList.contains('jfp-standalone')).toBe(true);
            stop();
            expect(document.documentElement.classList.contains('jfp-standalone')).toBe(false);
        });

        it('desktop: aunque sea standalone, no añade la clase', () => {
            document.documentElement.classList.add('layout-desktop');
            mockDisplayMode(true);

            const stop = watchStandalone();
            expect(document.documentElement.classList.contains('jfp-standalone')).toBe(false);
            stop();
        });
    });
});
