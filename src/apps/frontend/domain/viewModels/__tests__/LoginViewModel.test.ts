// Quick Connect en el login: pedir código, esperar la aprobación y cancelar.
//
// Lo delicado es la cancelación. La espera dura minutos y se puede abandonar de
// dos formas (el botón, o irse del login), así que lo que no puede pasar es que
// una aprobación tardía inicie una sesión que el usuario ya no quería.

import { beforeEach, describe, expect, test, vi } from 'vitest';

// El VM importa ApiService, que llega a ServerConnections y con él al
// bootstrap legacy (router raíz + playbackmanager) con efectos a nivel de
// módulo. Se corta en la misma frontera que el resto de tests de VM.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { LoginViewModel } from '../LoginViewModel';
import type { ApiService } from '../../../data/api/ApiService';

type AuthStubs = {
    isQuickConnectEnabled?: () => Promise<boolean>;
    startQuickConnect?: () => Promise<{ code: string; secret: string }>;
    waitForQuickConnect?: (url: string, secret: string, signal: AbortSignal) => Promise<boolean>;
    authenticateWithQuickConnect?: () => Promise<{ displayName: string }>;
};

function makeVm(stubs: AuthStubs = {}) {
    const notifyChanged = vi.fn();
    const auth = {
        normalizeServerUrl: (u: string) => u,
        authenticate: vi.fn(),
        isQuickConnectEnabled: vi.fn(stubs.isQuickConnectEnabled ?? (() => Promise.resolve(true))),
        startQuickConnect: vi.fn(
            stubs.startQuickConnect ?? (() => Promise.resolve({ code: '123456', secret: 's3cr3t' }))
        ),
        waitForQuickConnect: vi.fn(stubs.waitForQuickConnect ?? (() => Promise.resolve(true))),
        authenticateWithQuickConnect: vi.fn(
            stubs.authenticateWithQuickConnect ?? (() => Promise.resolve({ displayName: 'Rubén' }))
        )
    };
    const api = { auth, session: { notifyChanged } } as unknown as ApiService;
    const vm = new LoginViewModel(api);
    vm.serverUrl.value = 'http://servidor:8096';
    vm.step.value = 'login';
    return { vm, auth, notifyChanged };
}

beforeEach(() => {
    localStorage.clear();
});

describe('disponibilidad de Quick Connect', () => {
    test('se pregunta una sola vez por servidor', async () => {
        const { vm, auth } = makeVm();
        await vm.checkQuickConnect();
        await vm.checkQuickConnect();
        expect(auth.isQuickConnectEnabled).toHaveBeenCalledTimes(1);
        expect(vm.quickConnectAvailable.value).toBe(true);
    });

    test('un servidor sin Quick Connect no lo ofrece', async () => {
        const { vm } = makeVm({ isQuickConnectEnabled: () => Promise.resolve(false) });
        await vm.checkQuickConnect();
        expect(vm.quickConnectAvailable.value).toBe(false);
    });

    test('cambiar de servidor obliga a volver a preguntar', async () => {
        const { vm, auth } = makeVm();
        await vm.checkQuickConnect();
        vm.backToServer();
        expect(vm.quickConnectAvailable.value).toBe(false);
        vm.serverUrl.value = 'http://otro:8096';
        await vm.checkQuickConnect();
        expect(auth.isQuickConnectEnabled).toHaveBeenCalledTimes(2);
    });
});

describe('startQuickConnect', () => {
    test('enseña el código y, al aprobarlo, abre sesión', async () => {
        const { vm, auth, notifyChanged } = makeVm();
        const result = await vm.startQuickConnect();

        expect(auth.startQuickConnect).toHaveBeenCalledWith('http://servidor:8096');
        expect(auth.authenticateWithQuickConnect).toHaveBeenCalledWith('http://servidor:8096', 's3cr3t');
        expect(notifyChanged).toHaveBeenCalled();
        expect(result?.ok).toBe(true);
        expect(result?.message).toContain('Rubén');
    });

    test('el código se publica mientras se espera, no al final', async () => {
        let seen: string | null = null;
        const { vm } = makeVm({
            waitForQuickConnect: () => {
                seen = vm.quickConnectCode.value;
                return Promise.resolve(true);
            }
        });
        await vm.startQuickConnect();
        expect(seen).toBe('123456');
    });

    test('si caduca vuelve al formulario y lo dice', async () => {
        const { vm, auth, notifyChanged } = makeVm({
            waitForQuickConnect: () => Promise.resolve(false)
        });
        const result = await vm.startQuickConnect();

        expect(result?.ok).toBe(false);
        expect(vm.quickConnectCode.value).toBeNull();
        expect(vm.busy.value).toBe(false);
        expect(auth.authenticateWithQuickConnect).not.toHaveBeenCalled();
        expect(notifyChanged).not.toHaveBeenCalled();
    });

    test('un fallo al pedir el código deja el login utilizable', async () => {
        const { vm } = makeVm({
            startQuickConnect: () => Promise.reject(new Error('HTTP 500'))
        });
        const result = await vm.startQuickConnect();

        expect(result).toEqual({ ok: false, message: 'HTTP 500' });
        expect(vm.quickConnectCode.value).toBeNull();
        expect(vm.busy.value).toBe(false);
    });
});

describe('cancelar la espera', () => {
    /** Un `waitForQuickConnect` que solo termina cuando lo decide el test. */
    function controllableWait() {
        let approve: (value: boolean) => void = () => {};
        const wait = (_url: string, _secret: string, signal: AbortSignal) =>
            new Promise<boolean>((resolve) => {
                approve = resolve;
                signal.addEventListener('abort', () => { resolve(false); });
            });
        return { wait, approve: (v: boolean) => { approve(v); } };
    }

    test('cancelar limpia el código y no abre sesión', async () => {
        const { wait } = controllableWait();
        const { vm, notifyChanged } = makeVm({ waitForQuickConnect: wait });

        const pending = vm.startQuickConnect();
        await Promise.resolve();
        expect(vm.quickConnectCode.value).toBe('123456');

        vm.cancelQuickConnect();
        expect(await pending).toBeNull();
        expect(vm.quickConnectCode.value).toBeNull();
        expect(vm.busy.value).toBe(false);
        expect(notifyChanged).not.toHaveBeenCalled();
    });

    test('una aprobación que llega después de cancelar no entra', async () => {
        const { wait, approve } = controllableWait();
        const { vm, auth, notifyChanged } = makeVm({ waitForQuickConnect: wait });

        const pending = vm.startQuickConnect();
        await Promise.resolve();
        vm.cancelQuickConnect();
        // El usuario aprueba desde el móvil justo después de darle a cancelar.
        approve(true);

        expect(await pending).toBeNull();
        expect(auth.authenticateWithQuickConnect).not.toHaveBeenCalled();
        expect(notifyChanged).not.toHaveBeenCalled();
    });

    test('volver al paso del servidor cancela la espera', async () => {
        const { wait } = controllableWait();
        const { vm } = makeVm({ waitForQuickConnect: wait });

        const pending = vm.startQuickConnect();
        await Promise.resolve();
        vm.backToServer();

        expect(await pending).toBeNull();
        expect(vm.step.value).toBe('server');
        expect(vm.quickConnectCode.value).toBeNull();
    });

    test('pedir un código nuevo abandona el anterior', async () => {
        const { wait } = controllableWait();
        const { vm, auth } = makeVm({ waitForQuickConnect: wait });

        const first = vm.startQuickConnect();
        await Promise.resolve();

        auth.waitForQuickConnect = vi.fn(() => Promise.resolve(true));
        const second = vm.startQuickConnect();

        expect(await first).toBeNull();
        expect((await second)?.ok).toBe(true);
    });
});
