// Lo que la barra superior enseña del usuario —su nombre y su foto— no
// sobrevivía a una recarga: el nombre solo lo guardaba el login, en memoria, y
// la foto no la guardaba nadie. La sesión se restaura del ApiClient (token y
// userId siguen ahí) pero las dos volvían vacías.

import { describe, expect, test, vi } from 'vitest';
import { SessionViewModel } from '../SessionViewModel';
import type { ApiService, Session } from '../../../data/api/ApiService';

// El singleton apiService arrastra ServerConnections; los tests construyen
// sus propios VMs con mocks, así que el módulo real se sustituye entero.
vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

function session(over: Partial<Session> = {}): Session {
    return {
        serverUrl: 'http://srv',
        username: '',
        displayName: '',
        createdAt: 0,
        accessToken: 'tok',
        userId: 'u1',
        ...over
    };
}

function mockApi(over: {
    load?: () => Session | null;
    getCurrentUser?: () => Promise<unknown>;
} = {}) {
    const setUser = vi.fn();
    const getCurrentUser = vi.fn(
        over.getCurrentUser
        ?? (() => Promise.resolve({ id: 'u1', name: 'Ruben', avatarTag: 'abc' }))
    );
    const api = {
        session: {
            load: over.load ?? (() => session()),
            restore: () => Promise.resolve(session()),
            clear: vi.fn(),
            setUser,
            wireServerConnectionsEvents: vi.fn(),
            changeEvent: 'jfp-session-change'
        },
        users: { getCurrentUser },
        items: { hydrateFavorites: () => Promise.resolve() },
        catalog: { clearShowCache: vi.fn(), invalidateLists: vi.fn() }
    } as unknown as ApiService;
    return { api, setUser, getCurrentUser };
}

describe('SessionViewModel: perfil del usuario', () => {
    test('una sesión restaurada baja nombre y foto del servidor', async () => {
        const { api, setUser } = mockApi();
        const vm = new SessionViewModel(api);

        vm.refresh();
        await Promise.resolve();

        expect(setUser).toHaveBeenCalledWith('Ruben', 'abc');
    });

    test('con el nombre ya puesto pregunta igual, que la foto falta', async () => {
        // Es el camino del login: deja el nombre pero no el tag de la foto. Con
        // un guard sobre el nombre, el avatar no llegaba nunca.
        const { api, setUser } = mockApi({
            load: () => session({ displayName: 'Ruben' })
        });
        const vm = new SessionViewModel(api);

        vm.refresh();
        await Promise.resolve();

        expect(setUser).toHaveBeenCalledWith('Ruben', 'abc');
    });

    test('sin foto en el servidor se queda sin tag, no revienta', async () => {
        const { api, setUser } = mockApi({
            getCurrentUser: () => Promise.resolve({ id: 'u1', name: 'Ruben' })
        });
        const vm = new SessionViewModel(api);

        vm.refresh();
        await Promise.resolve();

        expect(setUser).toHaveBeenCalledWith('Ruben', undefined);
    });

    test('una sola petición por usuario', async () => {
        // setUser dispara otro evento de sesión, que vuelve a pasar por aquí:
        // sin el guardado sería una petición por evento.
        const { api, getCurrentUser } = mockApi();
        const vm = new SessionViewModel(api);

        vm.refresh();
        await Promise.resolve();
        vm.refresh();
        vm.refresh();
        await Promise.resolve();

        expect(getCurrentUser).toHaveBeenCalledTimes(1);
    });

    test('si el servidor falla se reintenta en el siguiente evento', async () => {
        const { api, getCurrentUser } = mockApi({
            getCurrentUser: () => Promise.reject(new Error('503'))
        });
        const vm = new SessionViewModel(api);

        vm.refresh();
        await Promise.resolve();
        await Promise.resolve();
        vm.refresh();
        await Promise.resolve();

        expect(getCurrentUser).toHaveBeenCalledTimes(2);
    });

    test('sin sesión no pregunta nada', async () => {
        const { api, getCurrentUser } = mockApi({ load: () => null });
        const vm = new SessionViewModel(api);

        vm.refresh();
        await Promise.resolve();

        expect(getCurrentUser).not.toHaveBeenCalled();
    });
});
