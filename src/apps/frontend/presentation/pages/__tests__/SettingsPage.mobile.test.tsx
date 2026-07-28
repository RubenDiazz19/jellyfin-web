// Drill-down móvil de Ajustes (spec 4.5) + selector de tema M3.
// Desktop conserva el layout de dos columnas sin sección Apariencia.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { themeVM } from '../../../domain/viewModels/ThemeViewModel';
import { ToastProvider } from '../../components/toast/ToastProvider';
import { MobileThemeProvider } from '../../theme/MobileThemeProvider';
import { SettingsPage } from '../SettingsPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Sin sesión: la lista de secciones se pinta igualmente y Apariencia
// funciona sin tocar la API. Evita, además, la carga async de usuario.
vi.mock('../../../domain/bridge/useSession', () => ({
    useSession: () => ({ session: null, logout: () => undefined })
}));

// domain/api arrastra la cadena legacy (http → jellyfin-apiclient) con
// efectos a nivel de módulo; se stubbean los nombres que importa la página
// y sus hijos (LibraryCardMenu).
vi.mock('../../../domain/api', () => ({
    getCurrentUser: () => Promise.resolve(null),
    updateUserConfig: () => Promise.resolve({}),
    changePassword: () => Promise.resolve(),
    avatarUrl: () => '',
    uploadAvatar: () => Promise.resolve(),
    deleteAvatar: () => Promise.resolve(),
    getUserViews: () => Promise.resolve([]),
    getUsers: () => Promise.resolve([]),
    getSystemInfo: () => Promise.resolve({}),
    refreshLibrary: () => Promise.resolve(),
    refreshItemMetadata: () => Promise.resolve(),
    getMaxStreamingBitrate: () => 20_000_000,
    setMaxStreamingBitrate: () => undefined
}));

vi.mock('../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

// Nav → ShowNavWatchedButton → showVM → ApiService: mismo corte que en los
// tests del reproductor.
vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MemoryRouter>
                <ToastProvider>
                    <MobileThemeProvider>
                        <SettingsPage navigate={() => undefined} initial='reproduccion' />
                    </MobileThemeProvider>
                </ToastProvider>
            </MemoryRouter>
        );
    });
}

function clickByText(text: string) {
    const btn = [...(host?.querySelectorAll('button') ?? []), ...document.querySelectorAll('button')]
        .find((b) => b.textContent?.includes(text));
    expect(btn, `botón «${text}»`).toBeDefined();
    act(() => { (btn as HTMLButtonElement).click(); });
}

describe('SettingsPage móvil', () => {
    beforeEach(() => {
        localStorage.clear();
        themeVM.setMode('dark');
        document.documentElement.className = '';
        document.documentElement.classList.add('layout-mobile');
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        themeVM.setMode('dark');
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('muestra la lista de secciones con Apariencia primero', () => {
        render();
        expect(host?.textContent).toContain('Appearance');
        expect(host?.textContent).toContain('Profile');
        expect(host?.textContent).toContain('Playback');
        // El sidebar desktop no existe: no hay grid de dos columnas.
        expect(host?.textContent).not.toContain('Sign in to a Jellyfin server');
    });

    it('drill-down: entrar en Apariencia, elegir Claro y volver', () => {
        render();
        clickByText('Appearance');
        expect(host?.textContent).toContain('Follow the system');

        clickByText('Light');
        expect(themeVM.mode.value).toBe('light');

        clickByText('‹ Settings');
        expect(host?.textContent).toContain('Playback');
    });

    it('desktop: dos columnas clásicas, sin sección Apariencia', () => {
        document.documentElement.className = 'layout-desktop';
        render();
        expect(host?.textContent).not.toContain('Appearance');
        expect(host?.textContent).toContain('Profile');
        // Estado sin sesión visible en el panel derecho.
        expect(host?.textContent).toContain('Sign in to a Jellyfin server');
    });
});
