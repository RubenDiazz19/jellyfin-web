import { Api, Jellyfin } from '@jellyfin/sdk';

import { safeDecodeURIComponent } from 'utils/url';

/**
 * Lo que hace falta del cliente legacy para construir un Api del SDK: seis
 * getters, nada más. Se declara por forma en vez de importar la clase del
 * paquete para que este puente no obligue a arrastrarla — es justo la pieza
 * que sobra cuando se termine de sustituir el cliente.
 */
interface ApiClientParams {
    appName(): string;
    appVersion(): string;
    deviceName(): string;
    deviceId(): string;
    serverAddress(): string;
    accessToken(): string;
}

/**
 * Returns an SDK Api instance using the same parameters as the provided ApiClient.
 * @param {ApiClientParams} apiClient The (legacy) ApiClient.
 * @returns {Api} An equivalent SDK Api instance.
 */
export const toApi = (apiClient: ApiClientParams): Api => {
    return (new Jellyfin({
        // The SDK encodes these values when creating the authorization header,
        // so we need to decode them here to avoid double encoding.
        clientInfo: {
            name: safeDecodeURIComponent(apiClient.appName()),
            version: safeDecodeURIComponent(apiClient.appVersion())
        },
        deviceInfo: {
            name: safeDecodeURIComponent(apiClient.deviceName()),
            id: safeDecodeURIComponent(apiClient.deviceId())
        }
    })).createApi(
        apiClient.serverAddress(),
        apiClient.accessToken()
    );
};
