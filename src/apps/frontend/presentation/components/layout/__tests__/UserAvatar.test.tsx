// El avatar de la barra superior enseña la misma foto que Ajustes. Sin foto
// —o si no carga— cae a la inicial del nombre.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserAvatar } from '../UserAvatar';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const state: { displayName: string; avatarTag?: string } = { displayName: 'Ruben' };

vi.mock('../../../../domain/bridge/useSession', () => ({
    useSession: () => ({
        session: {
            serverUrl: 'http://srv',
            userId: 'u1',
            accessToken: 'tok',
            displayName: state.displayName,
            avatarTag: state.avatarTag
        },
        logout: () => undefined
    })
}));

vi.mock('../../../../domain/api', () => ({
    avatarUrl: (tag?: string) => `http://srv/Users/u1/Images/Primary?tag=${tag}`
}));

// useResponsive cuelga del provider del tema, cuyo sync remoto arrastra la
// cadena legacy (jellyfin-apiclient, playbackmanager) con efectos de módulo.
vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

vi.mock('../../toast/ToastProvider', () => ({ useToast: () => () => undefined }));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root?.render(<UserAvatar navigate={() => undefined} />); });
}

describe('UserAvatar', () => {
    beforeEach(() => {
        state.displayName = 'Ruben';
        state.avatarTag = undefined;
        document.documentElement.className = 'layout-mobile';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
    });

    it('con foto de perfil la pinta', () => {
        state.avatarTag = 'abc';
        render();
        const img = host?.querySelector('img');
        expect(img?.getAttribute('src')).toContain('tag=abc');
    });

    it('sin foto se queda en la inicial del nombre', () => {
        render();
        expect(host?.querySelector('img')).toBeNull();
        expect(host?.querySelector('button')?.textContent).toBe('R');
    });

    it('si la foto no carga vuelve a la inicial', () => {
        // El tag puede apuntar a una imagen borrada desde otra sesión: sin esto
        // quedaba el icono roto del navegador.
        state.avatarTag = 'abc';
        render();
        const img = host?.querySelector('img') as HTMLImageElement;
        act(() => { img.dispatchEvent(new Event('error')); });

        expect(host?.querySelector('img')).toBeNull();
        expect(host?.querySelector('button')?.textContent).toBe('R');
    });

    it('con el nombre aún vacío no se queda en blanco', () => {
        // La sesión restaurada llega sin nombre hasta que el ViewModel lo baja.
        state.displayName = '';
        render();
        expect(host?.querySelector('button')?.textContent).toBe('?');
    });
});
