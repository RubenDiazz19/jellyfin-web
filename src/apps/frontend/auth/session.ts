// Shim sobre ServerConnections del jellyfin-web oficial. La API pública se
// conserva (loadSession/saveSession/clearSession + SESSION_EVENT) para no
// tocar el resto de la app; los datos se derivan del ApiClient activo.

import { ServerConnections } from 'lib/jellyfin-apiclient';
import events from 'utils/events';

export const SESSION_EVENT = 'jfp-session-change';

export type Session = {
    serverUrl: string;
    username: string;
    displayName: string;
    createdAt: number;
    accessToken?: string;
    userId?: string;
    serverId?: string;
};

let cachedDisplayName = '';

function readFromServerConnections(): Session | null {
    const apiClient = ServerConnections.currentApiClient?.();
    if (!apiClient) return null;
    const accessToken = apiClient.accessToken?.();
    const userId = apiClient.getCurrentUserId?.();
    const serverUrl = apiClient.serverAddress?.() ?? '';
    const serverId = apiClient.serverId?.() ?? undefined;
    if (!accessToken || !userId) return null;
    return {
        serverUrl,
        username: cachedDisplayName,
        displayName: cachedDisplayName,
        createdAt: 0,
        accessToken,
        userId,
        serverId
    };
}

export function loadSession(): Session | null {
    // Sin cache: ServerConnections puede rotar tokens/usuarios sin previo aviso
    // (relogin, cambio de servidor). Un getter fresco evita servir credenciales
    // caducadas al resto de la app.
    return readFromServerConnections();
}

export function saveSession(_session: Session) {
    // No-op. La sesión la mantiene ServerConnections tras un login válido.
    window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
    const apiClient = ServerConnections.currentApiClient?.();
    if (apiClient?.accessToken?.()) {
        apiClient.logout?.();
    }
    window.dispatchEvent(new Event(SESSION_EVENT));
}

// Se llama desde el login/AppLayout al obtener el UserDto: guarda el nombre
// para mostrarlo en la UI (avatar, saludo). Los tokens no se tocan aquí.
export function setSessionDisplayName(name: string) {
    cachedDisplayName = name;
    window.dispatchEvent(new Event(SESSION_EVENT));
}

// Puente entre los eventos de ServerConnections y el evento local que escucha
// SessionProvider. Debe llamarse una única vez (lo hace AppLayout al montarse).
let wired = false;
export function wireServerConnectionsEvents() {
    if (wired) return;
    wired = true;
    const dispatch = () => window.dispatchEvent(new Event(SESSION_EVENT));
    events.on(ServerConnections, 'localusersignedin', dispatch);
    events.on(ServerConnections, 'localusersignedout', dispatch);
}
