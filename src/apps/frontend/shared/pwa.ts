// Infraestructura PWA del frontend — TODO scopeado a mobile/tablet.
// En desktop: no se registra el service worker, no se captura el prompt de
// instalación (Chrome conserva su UI nativa) y no se añade ninguna clase.

import { currentMobileLayout } from './layoutMode';

const SW_URL = '/serviceworker.js';

// En dev el SW cachearía los módulos de Vite y rompería el HMR; para
// probarlo en dev: localStorage.setItem('jfp-sw-dev', '1') y recargar.
const DEV_OPTIN_KEY = 'jfp-sw-dev';

export const STANDALONE_CLASS = 'jfp-standalone';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((fn) => { fn(); });
}

/**
 * Captura beforeinstallprompt para mostrar nuestro banner M3 en su lugar.
 * Idempotente; se llama una vez desde AppLayout.
 */
export function initPwa(): void {
    if (initialized) return;
    initialized = true;
    window.addEventListener('beforeinstallprompt', (e) => {
        // Solo secuestramos el prompt en mobile/tablet: en desktop el
        // preventDefault suprimiría el icono de instalación del navegador.
        if (!currentMobileLayout()) return;
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        notify();
    });
}

export function hasInstallPrompt(): boolean {
    return deferredPrompt !== null;
}

/** Suscripción a cambios de disponibilidad del prompt. Devuelve cleanup. */
export function onInstallPromptChange(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}

/** Lanza el diálogo nativo de instalación. null = no hay prompt capturado. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
    const ev = deferredPrompt;
    if (!ev) return null;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === 'accepted') {
        deferredPrompt = null;
        notify();
    }
    return outcome;
}

/** true si la app corre instalada (standalone / homescreen de iOS). */
export function isStandalone(): boolean {
    return window.matchMedia?.('(display-mode: standalone)').matches === true
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Mantiene la clase jfp-standalone en <html> mientras la app corre
 * instalada en mobile/tablet (ajustes de notch/chin via CSS). Cleanup
 * incluido para el desmontaje de AppLayout.
 */
export function watchStandalone(): () => void {
    const apply = () => {
        document.documentElement.classList.toggle(
            STANDALONE_CLASS,
            isStandalone() && currentMobileLayout() !== null
        );
    };
    apply();
    const mql = window.matchMedia?.('(display-mode: standalone)');
    mql?.addEventListener('change', apply);
    return () => {
        mql?.removeEventListener('change', apply);
        document.documentElement.classList.remove(STANDALONE_CLASS);
    };
}

/**
 * Registra el service worker. Solo mobile/tablet; en desktop devuelve
 * false sin efectos. En dev requiere el opt-in (ver DEV_OPTIN_KEY).
 */
export async function registerServiceWorker(): Promise<boolean> {
    if (currentMobileLayout() === null) return false;
    if (!('serviceWorker' in navigator)) return false;
    if (__WEBPACK_SERVE__ && localStorage.getItem(DEV_OPTIN_KEY) !== '1') return false;
    try {
        await navigator.serviceWorker.register(SW_URL);
        return true;
    } catch {
        // Origen no seguro o SW bloqueado: la app funciona igual, sin offline.
        return false;
    }
}

/** Solo para tests: resetea el estado del módulo. */
export function resetPwaForTests(): void {
    deferredPrompt = null;
    initialized = false;
    listeners.clear();
}
