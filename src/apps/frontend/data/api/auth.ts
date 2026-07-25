// Login via ConnectionManager: connectToAddress registers the ApiClient
// locally, then authenticateUserByName obtains the AccessToken.

import { ServerConnections, ConnectionState } from 'lib/jellyfin-apiclient';
import { setSessionDisplayName } from '../session/session';
import { normalizeServerUrl } from './http';

export type AuthResult = {
    accessToken: string;
    userId: string;
    serverId: string;
    displayName: string;
};

export async function authenticate(
    serverUrl: string,
    username: string,
    password: string
): Promise<AuthResult> {
    const base = normalizeServerUrl(serverUrl);
    let connection;
    try {
        connection = await ServerConnections.connectToAddress(base);
    } catch {
        throw new Error(
            `No se pudo alcanzar ${base}. Comprueba que el servidor está corriendo y la URL es correcta.`
        );
    }
    if (!connection || connection.State === ConnectionState.Unavailable) {
        throw new Error(`No se pudo alcanzar ${base}.`);
    }
    const apiClient = connection.ApiClient ?? ServerConnections.currentApiClient?.();
    if (!apiClient) throw new Error('No hay ApiClient disponible tras conectar.');

    let auth;
    try {
        auth = await apiClient.authenticateUserByName(username, password);
    } catch (err) {
        // El ApiClient legacy rechaza con un objeto suelto (a veces un
        // XHR, a veces un Error con `status`), no con algo tipado: se lee
        // el código con una comprobación en vez de con un cast.
        const status = err !== null && typeof err === 'object' && 'status' in err ?
            (err as { status?: unknown }).status :
            undefined;
        throw new Error(
            status === 401 ?
                'Usuario o contraseña incorrectos' :
                `Error del servidor (${typeof status === 'number' ? status : '?'})`
        );
    }
    const displayName = auth?.User?.Name ?? username;
    setSessionDisplayName(displayName);
    return {
        accessToken: auth.AccessToken,
        userId: auth.User.Id,
        serverId: auth.ServerId,
        displayName
    };
}
