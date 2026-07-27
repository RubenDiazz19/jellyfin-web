// Red de seguridad de la capa de conexión, escrita ANTES de reescribirla.
//
// Esta capa es la que guarda las credenciales, prueba direcciones y decide si
// el usuario entra o se queda fuera. No tenía ni un test, y equivocarse aquí
// deja a alguien sin acceso a su servidor o le borra los servidores guardados.
// Lo que se fija aquí es la ORQUESTACIÓN — qué se persiste, en qué orden se
// prueban las direcciones, cuándo se invalida un token — con el HTTP y la
// construcción del cliente mockeados. Si la reescritura al SDK mantiene estos
// contratos, el usuario no nota nada.
//
// Las direcciones http:// son deliberadas: uno de los contratos que se fija
// es justamente que se prueba https antes que http, y que un esquema
// explícito se respeta. Sin http en los fixtures no se puede comprobar.
/* eslint-disable sonarjs/no-clear-text-protocols */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------- mocks HTTP

type AjaxHandler = (request: { url: string; type?: string; headers?: unknown }) => Promise<unknown>;

let ajaxHandler: AjaxHandler = (request) => Promise.reject(new Error(`sin handler para ${request.url}`));

vi.mock('utils/fetch', () => ({
    ajax: (request: { url: string }) => ajaxHandler(request),
    getFetchPromise: () => Promise.reject(new Error('no usado'))
}));

// El cliente legacy se falsea: aquí no se prueba el cliente, se prueba quién
// decide qué credenciales se guardan y a qué dirección se conecta.
function makeFakeClient(url: string) {
    let info: Record<string, unknown> = {};
    let token: string | undefined;
    let userId: string | undefined;
    const client = {
        _sdk: undefined as unknown,
        enableAutomaticBitrateDetection: true,
        onAuthenticated: undefined as unknown,
        capabilitiesReported: 0,
        systemInfo: undefined as unknown,
        serverAddress: () => url,
        serverId: () => info.Id as string | undefined,
        serverInfo: (next?: Record<string, unknown>) => {
            if (next !== undefined) info = next;
            return info;
        },
        accessToken: () => token,
        getCurrentUserId: () => userId,
        setAuthenticationInfo: (t: string, u: string) => {
            token = t;
            userId = u;
        },
        updateServerInfo: () => undefined,
        setSystemInfo: (i: unknown) => { client.systemInfo = i; },
        getCurrentUser: () => Promise.resolve({ Id: 'u1', Name: 'Ruben', ServerId: info.Id }),
        reportCapabilities: () => { client.capabilitiesReported++; },
        logout: () => Promise.resolve(),
        appName: () => 'test',
        appVersion: () => '1.0.0',
        deviceName: () => 'dev',
        deviceId: () => 'devid'
    };
    return client;
}

vi.mock('utils/jellyfin-apiclient/createApiClient', () => ({
    createApiClient: (url: string) => makeFakeClient(url)
}));

vi.mock('utils/jellyfin-apiclient/compat', () => ({
    toApi: () => ({ update: () => undefined, subscribe: () => undefined })
}));

// La autenticación pasa por el SDK; lo que importa aquí es qué se hace con
// el resultado, no la llamada HTTP en sí.
let authResponder: () => Promise<{ data: unknown }> = () =>
    Promise.reject(new Error('sin responder de auth'));

vi.mock('@jellyfin/sdk/lib/utils/api/authentication-api', () => ({
    getAuthenticationApi: () => ({
        authenticateUserByName: () => authResponder()
    })
}));

import events from 'utils/events';

import ConnectionManager from '../connectionManager';
import { ConnectionState } from '../connectionState';
import { ConnectionMode } from '../connectionMode';

// ------------------------------------------------- proveedor de credenciales

type ServerRecord = Record<string, unknown>;
type CredentialStore = { Servers: ServerRecord[] };

// Misma interfaz mínima que usa connectionManager: leer, escribir y fusionar.
function makeCredentialProvider(initial: ServerRecord[] = []) {
    let store: CredentialStore = { Servers: initial };
    return {
        credentials: (next?: CredentialStore) => {
            if (next !== undefined) store = next;
            return store;
        },
        addOrUpdateServer: (list: ServerRecord[], server: ServerRecord) => {
            const i = list.findIndex((s) => s.Id && s.Id === server.Id);
            if (i === -1) {
                list.push(server);
            } else {
                list[i] = server;
            }
            return server;
        },
        // Acceso directo para las aserciones.
        _dump: (): CredentialStore => store
    };
}

function makeManager(servers: ServerRecord[] = []) {
    const provider = makeCredentialProvider(servers);
    const manager = new ConnectionManager(
        provider, 'test', '1.0.0', 'dev', 'devid', { PlayableMediaTypes: [] }
    );
    return { manager, provider };
}

const SYSTEM_INFO = { Id: 'srv1', ServerName: 'Casa', Version: '99.0.0', LocalAddress: 'http://local:8096' };

beforeEach(() => {
    ajaxHandler = (request) => Promise.reject(new Error(`sin handler para ${request.url}`));
    authResponder = () => Promise.reject(new Error('sin responder de auth'));
    // La capa de conexión es muy verbosa por consola; sin esto la salida de
    // la suite queda inservible.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('capa de conexión', () => {
    describe('connectToAddress: cómo se prueba una dirección escrita a mano', () => {
        it('sin esquema prueba https antes que http', async () => {
            const tried: string[] = [];
            ajaxHandler = ({ url }) => {
                tried.push(url);
                return url.startsWith('https:') ?
                    Promise.reject(new Error('no https')) :
                    Promise.resolve(SYSTEM_INFO);
            };

            const { manager } = makeManager();
            const result = await manager.connectToAddress('casa:8096');

            expect(tried[0]).toContain('https://casa:8096');
            expect(tried.some((u) => u.startsWith('http://casa:8096'))).toBe(true);
            expect(result.State).not.toBe(ConnectionState.Unavailable);
        });

        it('con esquema explícito respeta el que se le dio y no inventa otro', async () => {
            const tried: string[] = [];
            ajaxHandler = ({ url }) => {
                tried.push(url);
                return Promise.resolve(SYSTEM_INFO);
            };

            const { manager } = makeManager();
            await manager.connectToAddress('http://casa:8096');

            expect(tried.every((u) => u.startsWith('http://'))).toBe(true);
            expect(tried.some((u) => u.startsWith('https://'))).toBe(false);
        });

        it('una dirección vacía se rechaza sin tocar la red', async () => {
            let called = false;
            ajaxHandler = () => {
                called = true;
                return Promise.resolve(SYSTEM_INFO);
            };

            const { manager } = makeManager();
            await expect(manager.connectToAddress('')).rejects.toBeUndefined();
            expect(called).toBe(false);
        });

        it('si ninguna dirección responde, el estado es Unavailable', async () => {
            ajaxHandler = (request) => Promise.reject(new Error(`sin red: ${request.url}`));

            const { manager } = makeManager();
            const result = await manager.connectToAddress('casa:8096');

            expect(result.State).toBe(ConnectionState.Unavailable);
        });
    });

    describe('connectToServer: comprobaciones antes de dar por buena la conexión', () => {
        it('un servidor por debajo de la versión mínima pide actualizar, no entra', async () => {
            ajaxHandler = () => Promise.resolve({ ...SYSTEM_INFO, Version: '1.0.0' });

            const { manager } = makeManager();
            const result = await manager.connectToServer({ ManualAddress: 'http://casa:8096' });

            expect(result.State).toBe(ConnectionState.ServerUpdateNeeded);
        });

        it('si responde otro servidor distinto del guardado, se avisa del desajuste', async () => {
            // Protege el caso de una IP reutilizada por otra máquina: no se
            // deben mezclar las credenciales de dos servidores.
            ajaxHandler = () => Promise.resolve({ ...SYSTEM_INFO, Id: 'otro' });

            const { manager } = makeManager();
            const result = await manager.connectToServer({
                Id: 'srv1', ManualAddress: 'http://casa:8096'
            });

            expect(result.State).toBe(ConnectionState.ServerMismatch);
        });

        it('sin token guardado pide iniciar sesión', async () => {
            ajaxHandler = () => Promise.resolve(SYSTEM_INFO);

            const { manager } = makeManager();
            const result = await manager.connectToServer({ ManualAddress: 'http://casa:8096' });

            expect(result.State).toBe(ConnectionState.ServerSignIn);
        });

        it('con token válido entra directo y persiste el servidor', async () => {
            ajaxHandler = () => Promise.resolve(SYSTEM_INFO);

            const { manager, provider } = makeManager();
            const result = await manager.connectToServer({
                Id: 'srv1', ManualAddress: 'http://casa:8096', AccessToken: 'tok', UserId: 'u1'
            });

            expect(result.State).toBe(ConnectionState.SignedIn);
            const saved = provider._dump().Servers.find((s) => s.Id === 'srv1');
            expect(saved).toBeDefined();
            expect(saved?.AccessToken).toBe('tok');
            // El modo de conexión que funcionó queda registrado para el próximo arranque.
            expect(saved?.LastConnectionMode).toBe(ConnectionMode.Manual);
            expect(saved?.DateLastAccessed).toBeGreaterThan(0);
        });

        it('enableAutoLogin false ignora el token guardado y pide login', async () => {
            ajaxHandler = () => Promise.resolve(SYSTEM_INFO);

            const { manager } = makeManager();
            const result = await manager.connectToServer(
                { Id: 'srv1', ManualAddress: 'http://casa:8096', AccessToken: 'tok', UserId: 'u1' },
                { enableAutoLogin: false }
            );

            expect(result.State).toBe(ConnectionState.ServerSignIn);
        });
    });

    describe('validación del token guardado', () => {
        it('un token rechazado por el servidor se limpia en vez de arrastrarse', async () => {
            // /System/Info/Public responde (el servidor existe) pero
            // /System/Info con el token falla: el token ya no vale.
            ajaxHandler = ({ url }) => {
                if (url.includes('/System/Info/Public')) return Promise.resolve(SYSTEM_INFO);
                return Promise.reject(new Error('401'));
            };

            const { manager, provider } = makeManager();
            const result = await manager.connectToServer({
                Id: 'srv1', ManualAddress: 'http://casa:8096', AccessToken: 'caducado', UserId: 'u1'
            });

            expect(result.State).toBe(ConnectionState.ServerSignIn);
            const saved = provider._dump().Servers.find((s) => s.Id === 'srv1');
            expect(saved?.AccessToken).toBeNull();
            expect(saved?.UserId).toBeNull();
        });

        it('un token aceptado sobrevive y actualiza los datos del servidor', async () => {
            ajaxHandler = () => Promise.resolve({ ...SYSTEM_INFO, ServerName: 'Renombrado' });

            const { manager, provider } = makeManager();
            await manager.connectToServer({
                Id: 'srv1', ManualAddress: 'http://casa:8096', AccessToken: 'tok', UserId: 'u1'
            });

            const saved = provider._dump().Servers.find((s) => s.Id === 'srv1');
            expect(saved?.AccessToken).toBe('tok');
            expect(saved?.Name).toBe('Renombrado');
        });
    });

    describe('servidores guardados', () => {
        it('se ordenan por último acceso, el más reciente primero', () => {
            const { manager } = makeManager([
                { Id: 'viejo', DateLastAccessed: 100 },
                { Id: 'nuevo', DateLastAccessed: 900 },
                { Id: 'medio', DateLastAccessed: 500 }
            ]);

            expect(manager.getSavedServers().map((s: ServerRecord) => s.Id))
                .toEqual(['nuevo', 'medio', 'viejo']);
            expect(manager.getLastUsedServer().Id).toBe('nuevo');
        });

        it('sin servidores guardados no hay último servidor', () => {
            const { manager } = makeManager();
            expect(manager.getLastUsedServer()).toBeNull();
        });

        it('borrar un servidor lo quita de las credenciales y respeta los demás', async () => {
            const { manager, provider } = makeManager([
                { Id: 'a', DateLastAccessed: 1 },
                { Id: 'b', DateLastAccessed: 2 }
            ]);

            await manager.deleteServer('a');

            expect(provider._dump().Servers.map((s) => s.Id)).toEqual(['b']);
        });

        it('borrar sin id es un error, no un borrado silencioso de todo', () => {
            const { manager } = makeManager([{ Id: 'a' }]);
            expect(() => manager.deleteServer(undefined)).toThrow();
        });

        it('clearData vacía la lista de servidores', () => {
            const { manager, provider } = makeManager([{ Id: 'a' }, { Id: 'b' }]);
            manager.clearData();
            expect(provider._dump().Servers).toEqual([]);
        });
    });

    describe('cierre de sesión', () => {
        it('borra token y usuario de los servidores guardados', async () => {
            ajaxHandler = () => Promise.resolve(SYSTEM_INFO);

            const { manager, provider } = makeManager();
            await manager.connectToServer({
                Id: 'srv1', ManualAddress: 'http://casa:8096', AccessToken: 'tok', UserId: 'u1'
            });

            await manager.logout();

            const saved = provider._dump().Servers.find((s) => s.Id === 'srv1');
            expect(saved?.AccessToken).toBeNull();
            expect(saved?.UserId).toBeNull();
            // El servidor sigue en la lista: cerrar sesión no es olvidarlo.
            expect(provider._dump().Servers).toHaveLength(1);
        });
    });

    describe('autenticación por SDK', () => {
        // Antes esto lo hacía apiClient.authenticateUserByName(). Al pasar la
        // llamada al SDK, lo que no puede perderse es la cadena de efectos:
        // si el token no se persiste, el usuario vuelve al login en cada
        // recarga aunque el login haya ido bien.
        async function connectedManager() {
            ajaxHandler = () => Promise.resolve(SYSTEM_INFO);
            const { manager, provider } = makeManager();
            const result = await manager.connectToServer({ ManualAddress: 'http://casa:8096' });
            return { manager, provider, apiClient: result.ApiClient };
        }

        it('un login correcto persiste token y usuario en las credenciales', async () => {
            const { manager, provider, apiClient } = await connectedManager();
            authResponder = () => Promise.resolve({
                data: { AccessToken: 'nuevo-token', ServerId: 'srv1', User: { Id: 'u1', Name: 'Ruben' } }
            });

            await manager.authenticateUserByName(apiClient, 'ruben', 'clave');

            const saved = provider._dump().Servers.find((s) => s.Id === 'srv1');
            expect(saved?.AccessToken).toBe('nuevo-token');
            expect(saved?.UserId).toBe('u1');
        });

        it('deja el cliente autenticado para las llamadas siguientes', async () => {
            const { manager, apiClient } = await connectedManager();
            authResponder = () => Promise.resolve({
                data: { AccessToken: 'nuevo-token', ServerId: 'srv1', User: { Id: 'u1', Name: 'Ruben' } }
            });

            await manager.authenticateUserByName(apiClient, 'ruben', 'clave');

            expect(apiClient.accessToken()).toBe('nuevo-token');
        });

        it('avisa a la app de que hay sesión iniciada', async () => {
            const { manager, apiClient } = await connectedManager();
            authResponder = () => Promise.resolve({
                data: { AccessToken: 'tok', ServerId: 'srv1', User: { Id: 'u1', Name: 'Ruben' } }
            });

            const signedIn = vi.fn();
            events.on(manager, 'localusersignedin', signedIn);

            await manager.authenticateUserByName(apiClient, 'ruben', 'clave');

            expect(signedIn).toHaveBeenCalled();
        });

        it('un login fallido propaga el error y no toca las credenciales', async () => {
            const { manager, provider, apiClient } = await connectedManager();
            const before = JSON.stringify(provider._dump());
            authResponder = () => Promise.reject(
                Object.assign(new Error('401'), { response: { status: 401 } })
            );

            await expect(manager.authenticateUserByName(apiClient, 'ruben', 'mal'))
                .rejects.toThrow();
            expect(JSON.stringify(provider._dump())).toBe(before);
        });

        it('sin cliente falla de forma explícita en vez de autenticar contra nada', async () => {
            const { manager } = makeManager();
            await expect(manager.authenticateUserByName(undefined, 'a', 'b')).rejects.toThrow();
        });
    });

    describe('getApi', () => {
        it('sin servidores devuelve undefined en vez de reventar', () => {
            const { manager } = makeManager();
            expect(manager.getApi()).toBeUndefined();
        });

        it('sin id usa el último servidor accedido', async () => {
            ajaxHandler = () => Promise.resolve(SYSTEM_INFO);

            const { manager } = makeManager();
            await manager.connectToServer({
                Id: 'srv1', ManualAddress: 'http://casa:8096', AccessToken: 'tok', UserId: 'u1'
            });

            expect(manager.getApi()).toBeDefined();
            expect(manager.getApi('srv1')).toBeDefined();
        });
    });
});

/* eslint-enable sonarjs/no-clear-text-protocols */
