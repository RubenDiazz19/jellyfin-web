// Tests del handle que sustituye al `ApiClient` del paquete `jellyfin-apiclient`.
//
// Los de `connectionManager` falsean esta clase a propósito (allí se prueba la
// orquestación), así que lo que el manager da por hecho de ella hay que fijarlo
// aquí. En concreto tres contratos de los que depende que alguien conserve o
// pierda su sesión:
//
//   - `accessToken()` solo devuelve algo si hay token Y usuario, que es lo que
//     decide a quién se le manda un cierre de sesión.
//   - Un `null` guardado se guarda como `null`, no como campo ausente.
//   - El `Api` del SDK sigue siempre a la dirección y al token del handle: si se
//     queda atrás, las peticiones salen con el token viejo.

import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    reportSessionEnded: vi.fn(() => Promise.resolve()),
    postFullCapabilities: vi.fn(() => Promise.resolve()),
    getCurrentUser: vi.fn(() => Promise.resolve({ data: { Id: 'u1', Name: 'Ruben' } }))
}));

vi.mock('@jellyfin/sdk/lib/utils/api/session-api', () => ({
    getSessionApi: () => ({
        reportSessionEnded: mocks.reportSessionEnded,
        postFullCapabilities: mocks.postFullCapabilities
    })
}));

vi.mock('@jellyfin/sdk/lib/utils/api/user-api', () => ({
    getUserApi: () => ({ getCurrentUser: mocks.getCurrentUser })
}));

import Events from 'utils/events';

import ServerHandle from '../serverHandle';

const APP = {
    appName: 'Jellyfin Web',
    appVersion: '10.0.0',
    deviceName: 'Portátil de Rubén',
    deviceId: 'device-1'
};

// eslint-disable-next-line sonarjs/no-clear-text-protocols -- una dirección local sin TLS es lo normal aquí
const URL_CASA = 'http://casa:8096';

function makeHandle() {
    return new ServerHandle(URL_CASA, APP);
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ServerHandle', () => {
    describe('construcción', () => {
        it('sin dirección falla en el sitio, no más tarde y en otro lado', () => {
            expect(() => new ServerHandle('', APP)).toThrow();
        });

        it('deja el Api del SDK apuntando a la dirección dada', () => {
            expect(makeHandle().api.basePath).toBe(URL_CASA);
        });

        it('guarda la identidad de la app en crudo, sin codificar', () => {
            // El cliente legacy la guardaba URL-encoded porque la metía tal cual
            // en su cabecera; el SDK encoda por su cuenta, así que guardarla
            // codificada aquí saldría con la codificación aplicada dos veces.
            const handle = makeHandle();

            expect(handle.deviceName()).toBe('Portátil de Rubén');
            expect(handle.api.deviceInfo.name).toBe('Portátil de Rubén');
        });

        it('decodifica lo que ya venga codificado en vez de codificarlo otra vez', () => {
            // Caso real: una webview que pasa estos valores por la URL.
            const handle = new ServerHandle(URL_CASA, {
                ...APP,
                deviceName: 'Port%C3%A1til%20de%20Rub%C3%A9n'
            });

            expect(handle.deviceName()).toBe('Portátil de Rubén');
        });
    });

    describe('datos del servidor', () => {
        it('el id sale de la info guardada', () => {
            const handle = makeHandle();
            expect(handle.serverId()).toBeUndefined();

            handle.setServerInfo({ Id: 'srv1', Name: 'Casa' });

            expect(handle.serverId()).toBe('srv1');
            expect(handle.serverInfo().Name).toBe('Casa');
        });

        it('la versión se recuerda de lo que dijo el servidor al conectar', () => {
            const handle = makeHandle();
            expect(handle.serverVersion()).toBeUndefined();

            handle.setSystemInfo({ Version: '10.9.0' });

            expect(handle.serverVersion()).toBe('10.9.0');
        });

        it('mover el servidor de dirección arrastra al Api del SDK', () => {
            const handle = makeHandle();

            handle.updateServerInfo({ Id: 'srv1' }, 'https://fuera.example:8920');

            expect(handle.serverAddress()).toBe('https://fuera.example:8920');
            expect(handle.api.basePath).toBe('https://fuera.example:8920');
        });

        it('una dirección sin esquema se rechaza al guardarla', () => {
            // Guardarla sin más la haría fallar mucho después, en la primera
            // petición y sin pista de dónde vino.
            const handle = makeHandle();

            expect(() => handle.updateServerInfo({ Id: 'srv1' }, 'casa:8096')).toThrow();
            expect(handle.serverAddress()).toBe(URL_CASA);
        });
    });

    describe('sesión', () => {
        it('sin autenticar no hay token ni usuario, aunque la info los traiga', () => {
            // Los datos guardados pueden traer un token caducado: hasta que no
            // se valida, este servidor no cuenta como con sesión abierta.
            const handle = makeHandle();
            handle.setServerInfo({ Id: 'srv1', AccessToken: 'viejo', UserId: 'u1' });

            expect(handle.accessToken()).toBeUndefined();
            expect(handle.getCurrentUserId()).toBeUndefined();
        });

        it('un token sin usuario no cuenta como sesión', () => {
            const handle = makeHandle();

            handle.setAuthenticationInfo('tok', null);

            expect(handle.accessToken()).toBeUndefined();
        });

        it('token y usuario juntos abren la sesión y llegan al Api del SDK', () => {
            const handle = makeHandle();

            handle.setAuthenticationInfo('tok', 'u1');

            expect(handle.accessToken()).toBe('tok');
            expect(handle.getCurrentUserId()).toBe('u1');
            expect(handle.api.accessToken).toBe('tok');
        });

        it('invalidar la sesión guarda null, no borra el campo', () => {
            // La diferencia se ve al releer lo guardado: un `null` sobrevive al
            // JSON.stringify y un `undefined` desaparece del objeto.
            const handle = makeHandle();
            const info = { Id: 'srv1', AccessToken: 'tok', UserId: 'u1' };
            handle.setServerInfo(info);
            handle.setAuthenticationInfo('tok', 'u1');

            handle.setAuthenticationInfo(null, null);

            expect(info.AccessToken).toBeNull();
            expect(info.UserId).toBeNull();
            expect('AccessToken' in info).toBe(true);
            expect(handle.api.accessToken).toBe('');
        });
    });

    describe('peticiones', () => {
        it('anuncia las capacidades tal cual se las dan', async () => {
            const handle = makeHandle();
            const capabilities = { PlayableMediaTypes: [MediaType.Video] };

            await handle.reportCapabilities(capabilities);

            expect(mocks.postFullCapabilities).toHaveBeenCalledWith({
                clientCapabilitiesDto: capabilities
            });
        });

        it('devuelve el usuario con sesión abierta', async () => {
            await expect(makeHandle().getCurrentUser()).resolves.toMatchObject({ Name: 'Ruben' });
        });
    });

    describe('cierre de sesión', () => {
        it('sin token no molesta al servidor', async () => {
            await makeHandle().logout();

            expect(mocks.reportSessionEnded).not.toHaveBeenCalled();
        });

        it('con token avisa al servidor y olvida la sesión aquí', async () => {
            const handle = makeHandle();
            handle.setAuthenticationInfo('tok', 'u1');

            await handle.logout();

            expect(mocks.reportSessionEnded).toHaveBeenCalledTimes(1);
            expect(handle.accessToken()).toBeUndefined();
        });

        it('si el servidor no contesta, la sesión se cierra igual', async () => {
            // Quien pulsa "cerrar sesión" espera salir; dejarlo dentro porque el
            // servidor está caído es lo peor de los dos resultados.
            mocks.reportSessionEnded.mockRejectedValueOnce(new Error('sin red'));
            const handle = makeHandle();
            handle.setAuthenticationInfo('tok', 'u1');

            await expect(handle.logout()).resolves.toBeUndefined();

            expect(handle.accessToken()).toBeUndefined();
        });
    });

    describe('evento requestfail', () => {
        // Es lo que usa `index.jsx` para sacar al usuario de una página que el
        // control parental le bloquea. Se disparaba desde el cliente legacy y se
        // quedó mudo al pasar las llamadas al SDK; ahora cuelga de su axios.
        // Un fallo con la forma de los de axios: un Error con la respuesta
        // colgada, que es de donde sale el código de la cabecera.
        function failWith(status: number, headers: Record<string, string> = {}) {
            const handle = makeHandle();
            handle.api.axiosInstance.defaults.adapter = () =>
                Promise.reject(Object.assign(new Error(`HTTP ${status}`), {
                    response: { status, headers, config: { url: '/Items' } }
                }));
            return handle;
        }

        it('reemite el código de error de la cabecera del servidor', async () => {
            const handle = failWith(403, { 'x-application-error-code': 'ParentalControl' });
            const onFail = vi.fn();
            Events.on(handle, 'requestfail', onFail);

            await expect(handle.api.axiosInstance.get('/Items')).rejects.toBeDefined();

            expect(onFail).toHaveBeenCalledTimes(1);
            expect(onFail.mock.calls[0][1]).toMatchObject({
                status: 403,
                errorCode: 'ParentalControl'
            });
        });

        it('sin cabecera de error el código va a null, no a undefined', async () => {
            const handle = failWith(500);
            const onFail = vi.fn();
            Events.on(handle, 'requestfail', onFail);

            await expect(handle.api.axiosInstance.get('/Items')).rejects.toBeDefined();

            expect(onFail.mock.calls[0][1]).toMatchObject({ status: 500, errorCode: null });
        });

        it('un fallo de red sin respuesta no dispara el evento', async () => {
            // Sin `response` no hay nada que contar, y el handler de arriba lee
            // `status` sin comprobarlo.
            const handle = makeHandle();
            handle.api.axiosInstance.defaults.adapter = () => Promise.reject(new Error('offline'));
            const onFail = vi.fn();
            Events.on(handle, 'requestfail', onFail);

            await expect(handle.api.axiosInstance.get('/Items')).rejects.toThrow('offline');

            expect(onFail).not.toHaveBeenCalled();
        });
    });
});
