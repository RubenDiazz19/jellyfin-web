// Login via ConnectionManager: connectToAddress registra el servidor y
// authenticateUserByName — ya sobre el SDK — obtiene el AccessToken y deja
// las credenciales persistidas.

import globalize from 'lib/globalize';

import { ServerConnections, ConnectionState, type ServerHandle } from 'lib/jellyfin-apiclient';
import { setSessionDisplayName } from '../session/session';
import { normalizeServerUrl } from './http';

export type AuthResult = {
    accessToken: string;
    userId: string;
    serverId: string;
    displayName: string;
};

/**
 * Registra el servidor y devuelve su cliente, listo para hablar con él aunque
 * todavía no haya sesión. Lo comparten el login por contraseña y el de Quick
 * Connect: los dos necesitan lo mismo antes de poder pedir nada.
 */
export async function connectTo(serverUrl: string): Promise<ServerHandle> {
    const base = normalizeServerUrl(serverUrl);
    let connection;
    try {
        connection = await ServerConnections.connectToAddress(base);
    } catch {
        throw new Error(
            globalize.translate('MessageServerUnreachable', base)
        );
    }
    if (!connection || connection.State === ConnectionState.Unavailable) {
        throw new Error(`No se pudo alcanzar ${base}.`);
    }
    const apiClient = connection.ApiClient ?? ServerConnections.currentApiClient?.();
    if (!apiClient) throw new Error('No hay servidor disponible tras conectar.');
    return apiClient;
}

export async function authenticate(
    serverUrl: string,
    username: string,
    password: string
): Promise<AuthResult> {
    const apiClient = await connectTo(serverUrl);

    let auth;
    try {
        auth = await ServerConnections.authenticateUserByName(apiClient, username, password);
    } catch (err) {
        // El SDK usa axios: el código HTTP viene en err.response.status. Se
        // lee con comprobaciones en vez de con un cast porque un fallo de red
        // rechaza sin `response` ninguna.
        const response = err !== null && typeof err === 'object' && 'response' in err ?
            (err as { response?: { status?: unknown } }).response :
            undefined;
        const status = response?.status;
        throw new Error(
            status === 401 ?
                globalize.translate('MessageInvalidCredentials') :
                `Error del servidor (${typeof status === 'number' ? status : '?'})`
        );
    }
    // El SDK tipa estos campos como opcionales (el cliente legacy los daba
    // como `any`). Si faltan, el login "ha ido bien" pero no hay sesión: mejor
    // fallar aquí que dejar a la app con un token undefined.
    const { AccessToken: accessToken, User: user, ServerId: serverId } = auth;
    if (!accessToken || !user?.Id) {
        throw new Error(globalize.translate('MessageNoSessionReturned'));
    }

    const displayName = user.Name ?? username;
    setSessionDisplayName(displayName);
    return {
        accessToken,
        userId: user.Id,
        serverId: serverId ?? '',
        displayName
    };
}
