// Un servidor conectado: lo que se sabe de él (id, nombre, direcciones, token)
// y el `Api` del SDK con el que se le habla.
//
// Es la última pieza de D2. Sustituye al `ApiClient` del paquete
// `jellyfin-apiclient`, que era el único import que quedaba de él. Aquella clase
// tenía ~2000 líneas y un método por endpoint; cuando las fases anteriores
// sacaron de ahí todas las llamadas de negocio, lo que quedó en uso fue esto:
// unos cuantos getters y tres peticiones.
//
// Cuatro cosas del original que NO se heredan, y por qué:
//
//   1. **La codificación doble.** El original guardaba `appName` y compañía ya
//      URL-encoded, porque los metía tal cual en su cabecera de autorización; y
//      luego `toApi` los decodificaba otra vez para dárselos al SDK. Aquí se
//      guardan en crudo: la cabecera la construye el SDK, que ya encoda.
//   2. **La caché del usuario actual**, en memoria y en localStorage. La leía
//      solo él mismo, y hoy quien cachea respuestas es react-query.
//   3. **El WebSocket.** Ya es del SDK: todo el repo se suscribe con
//      `api.subscribe(...)`. Además `Api.update()` reconecta solo cuando cambian
//      la dirección o el token, que es justo lo que hacía falta reimplementar.
//   4. **La detección de bitrate**, que está upstream en `utils/bitrateTest`.
//
// Lo que sí se hereda al pie de la letra es cuándo se considera que hay sesión:
// solo tras un `setAuthenticationInfo()` con token Y usuario. Derivarlo de los
// datos guardados daría por autenticado a un servidor con token caducado, y
// `logout()` intentaría cerrar sesiones que no existen.

import { Api, Jellyfin } from '@jellyfin/sdk';
import type { ClientCapabilitiesDto, SystemInfo, UserDto } from '@jellyfin/sdk/lib/generated-client';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';

import Events from 'utils/events';
import { safeDecodeURIComponent } from 'utils/url';

import type { ServerCredentials } from './credentials';

/** Cómo se identifica esta app ante el servidor. */
export interface AppInfo {
    appName: string;
    appVersion: string;
    deviceName: string;
    deviceId: string;
}

/** Lo que se cuenta en un evento `requestfail`. */
export interface RequestFailure {
    url?: string;
    status: number;
    errorCode: string | null;
}

export default class ServerHandle {
    private address: string;
    private info: ServerCredentials = {};
    private version?: string;
    private loggedIn = false;
    private readonly app: AppInfo;

    /**
     * Servidor fijo: no se sondean direcciones alternativas. Lo pone la app web
     * servida por el propio Jellyfin, que solo puede hablar con el suyo.
     */
    manualAddressOnly = false;

    /**
     * El `Api` del SDK de este servidor. Se crea con el handle y se mantiene en
     * sintonía con la dirección y el token: nadie de fuera tiene que acordarse
     * de actualizarlo.
     */
    readonly api: Api;

    constructor(serverAddress: string, app: AppInfo) {
        if (!serverAddress) {
            throw new Error('[ServerHandle] hace falta una dirección de servidor');
        }

        // Los valores pueden llegar ya codificados (una webview que los pasa por
        // la URL, por ejemplo). Se normalizan a crudo una sola vez, aquí.
        this.app = {
            appName: safeDecodeURIComponent(app.appName),
            appVersion: safeDecodeURIComponent(app.appVersion),
            deviceName: safeDecodeURIComponent(app.deviceName),
            deviceId: safeDecodeURIComponent(app.deviceId)
        };

        this.address = serverAddress;
        this.api = new Jellyfin({
            clientInfo: { name: this.app.appName, version: this.app.appVersion },
            deviceInfo: { name: this.app.deviceName, id: this.app.deviceId }
        }).createApi(serverAddress);

        this.watchForRequestFailures();
    }

    /**
     * Reemite los fallos HTTP del servidor como un evento `requestfail`.
     *
     * Lo hacía el cliente legacy, y `index.jsx` sigue escuchándolo para sacar al
     * usuario de una página restringida por control parental (403 +
     * `X-Application-Error-Code: ParentalControl`). Pero cuando las llamadas de
     * negocio pasaron al SDK, el evento dejó de dispararse **sin que nadie lo
     * notara**: el handler estaba enganchado a un cliente que ya no pedía nada.
     * Colgarlo del axios del SDK es lo que devuelve el aviso a la vida.
     */
    private watchForRequestFailures(): void {
        this.api.axiosInstance.interceptors.response.use(undefined, (error: unknown) => {
            const response = (error as { response?: { status?: number; config?: { url?: string }; headers?: Record<string, string> } })?.response;

            if (typeof response?.status === 'number') {
                const failure: RequestFailure = {
                    url: response.config?.url,
                    status: response.status,
                    // Axios normaliza los nombres de cabecera a minúsculas.
                    errorCode: response.headers?.['x-application-error-code'] ?? null
                };
                Events.trigger(this, 'requestfail', [failure]);
            }

            return Promise.reject(error);
        });
    }

    // ------------------------------------------------------------- identidad

    appName(): string {
        return this.app.appName;
    }

    appVersion(): string {
        return this.app.appVersion;
    }

    deviceName(): string {
        return this.app.deviceName;
    }

    deviceId(): string {
        return this.app.deviceId;
    }

    // --------------------------------------------------------------- servidor

    serverAddress(): string {
        return this.address;
    }

    serverId(): string | undefined {
        return this.info.Id;
    }

    serverInfo(): ServerCredentials {
        return this.info;
    }

    setServerInfo(info: ServerCredentials): void {
        this.info = info;
    }

    /** La versión que dijo el servidor al conectar, si se llegó a preguntar. */
    serverVersion(): string | undefined {
        return this.version;
    }

    setSystemInfo(systemInfo: SystemInfo): void {
        this.version = systemInfo.Version ?? undefined;
    }

    /**
     * Apunta el handle a un servidor y a una dirección concretos.
     * @param info Los datos guardados del servidor.
     * @param serverAddress La dirección por la que respondió.
     */
    updateServerInfo(info: ServerCredentials, serverAddress: string): void {
        if (!info) {
            throw new Error('[ServerHandle] server cannot be null');
        }
        if (!serverAddress?.toLowerCase().startsWith('http')) {
            // El original también lo comprobaba: una dirección sin esquema no
            // falla al guardarse, falla mucho más tarde y en otro sitio.
            throw new Error(`[ServerHandle] dirección inválida: ${serverAddress}`);
        }

        this.info = info;
        this.address = serverAddress;
        this.api.update({ basePath: serverAddress });
    }

    // -------------------------------------------------------------- sesión

    accessToken(): string | null | undefined {
        return this.loggedIn ? this.info.AccessToken : undefined;
    }

    getCurrentUserId(): string | null | undefined {
        return this.loggedIn ? this.info.UserId : undefined;
    }

    /**
     * Guarda (o invalida, con `null`) la sesión, y deja el `Api` del SDK usando
     * ese token. Al limpiarlo, el SDK cierra además el WebSocket.
     *
     * Lo que llega se guarda tal cual, sin normalizar `null` a `undefined`:
     * estos campos acaban en el almacenamiento, y ahí la diferencia se nota
     * (ver `ServerCredentials`).
     */
    setAuthenticationInfo(accessToken?: string | null, userId?: string | null): void {
        this.loggedIn = Boolean(accessToken) && Boolean(userId);
        this.info.AccessToken = accessToken;
        this.info.UserId = userId;
        this.api.update({ accessToken: accessToken ?? '' });
    }

    // ------------------------------------------------------------ peticiones

    /** El usuario con la sesión abierta en este servidor. */
    async getCurrentUser(): Promise<UserDto> {
        const { data } = await getUserApi(this.api).getCurrentUser();
        return data;
    }

    /** Le dice al servidor qué sabe hacer este cliente (control remoto, etc.). */
    async reportCapabilities(capabilities: ClientCapabilitiesDto): Promise<void> {
        await getSessionApi(this.api).postFullCapabilities({ clientCapabilitiesDto: capabilities });
    }

    /**
     * Cierra la sesión en el servidor y la olvida aquí.
     *
     * Sin token no se llama a nada: el servidor rechazaría la petición y el
     * efecto local es el mismo.
     */
    async logout(): Promise<void> {
        if (this.accessToken()) {
            try {
                await getSessionApi(this.api).reportSessionEnded();
            } catch (err) {
                // Que el servidor no conteste no puede dejar la sesión abierta
                // en el cliente: quien pulsa "cerrar sesión" espera salir.
                console.warn('[ServerHandle] el servidor no aceptó el cierre de sesión', err);
            }
        }
        this.setAuthenticationInfo(null, null);
    }
}
