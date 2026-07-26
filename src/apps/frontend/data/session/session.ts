// Session façade over the official ServerConnections singleton. All state is
// derived from the active SDK Api; we only cache the display name locally.

import { ServerConnections } from 'lib/jellyfin-apiclient';
import events from 'utils/events';

export const SESSION_EVENT = 'jfp-session-change';

// Restaura las credenciales guardadas (localStorage) llamando al connect() del
// ConnectionManager: valida el AccessToken contra /System/Info y, si es válido,
// hace setAuthenticationInfo en el cliente. Sin esto, initApiClient() del
// bootstrap crea un cliente sin token → api.accessToken = undefined y
// el usuario acaba en LoginPage aunque su sesión siga viva en storage.
export async function restoreSession(): Promise<Session | null> {
    try {
        await ServerConnections.connect();
    } catch {
        // Sin red / servidor caído: seguimos con lo que haya (posiblemente
        // nada). La propia conexión volverá a intentarlo cuando el usuario
        // haga una acción, y mientras tanto la UI puede seguir mostrando el
        // login sin pantalla en blanco.
    }
    return readFromServerConnections();
}

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
    const api = ServerConnections.getApi();
    if (!api) return null;
    const accessToken = api.accessToken;
    const userId = ServerConnections.getCurrentUserId();
    const serverUrl = api.basePath ?? '';
    const serverId = ServerConnections.getCurrentServerId();
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

// No local cache: ServerConnections can rotate tokens/users at any time
// (relogin, server switch). Reading fresh avoids serving stale credentials.
export function loadSession(): Session | null {
    return readFromServerConnections();
}

// Called after a successful login. ServerConnections already persists the
// tokens; we just fan-out our local event so listeners can react.
export function notifySessionChanged() {
    window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
    if (ServerConnections.getApi()?.accessToken) {
        void ServerConnections.logout();
    }
    window.dispatchEvent(new Event(SESSION_EVENT));
}

// Called from login / AppLayout with the UserDto so the UI can display the
// name in the avatar / greeting. Tokens are untouched.
export function setSessionDisplayName(name: string) {
    cachedDisplayName = name;
    window.dispatchEvent(new Event(SESSION_EVENT));
}

// Bridge between ServerConnections events and our SESSION_EVENT that
// SessionProvider listens to. Must be called exactly once (AppLayout mount).
let wired = false;
export function wireServerConnectionsEvents() {
    if (wired) return;
    wired = true;
    const dispatch = () => window.dispatchEvent(new Event(SESSION_EVENT));
    events.on(ServerConnections, 'localusersignedin', dispatch);
    events.on(ServerConnections, 'localusersignedout', dispatch);
}
