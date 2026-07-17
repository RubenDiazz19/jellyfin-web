// Session façade over the official ServerConnections singleton. All state is
// derived from the active ApiClient; we only cache the display name locally.

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
    const apiClient = ServerConnections.currentApiClient?.();
    if (apiClient?.accessToken?.()) {
        apiClient.logout?.();
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
