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

export type DiscoveredServer = {
    id?: string;
    name: string;
    url: string;
    version?: string;
    online?: boolean;
    lastUsed?: number;
};

export type PublicUser = {
    id: string;
    name: string;
    hasPassword: boolean;
    primaryImageTag?: string | null;
};

const SAVED_SERVERS_KEY = 'jfp-saved-servers';
const SERVER_URL_KEY = 'jfp-server-url';

/**
 * Lee los servidores guardados del almacenamiento local y de ConnectionManager.
 * Si no hay ninguno, añade el servidor activo guardado o la URL por defecto.
 */
export function getSavedServers(): DiscoveredServer[] {
    const list: DiscoveredServer[] = [];
    const seen = new Set<string>();

    const addServer = (url: string, name?: string, id?: string, lastUsed?: number) => {
        const norm = normalizeServerUrl(url);
        if (!norm || seen.has(norm)) return;
        seen.add(norm);
        list.push({
            id,
            name: name || norm,
            url: norm,
            lastUsed
        });
    };

    // 1. Servidores en el storage de nuestro frontend
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(SAVED_SERVERS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as DiscoveredServer[];
                if (Array.isArray(parsed)) {
                    for (const s of parsed) {
                        if (s?.url) addServer(s.url, s.name, s.id, s.lastUsed);
                    }
                }
            }
        }
    } catch {
        // Ignorar fallos de parseo de storage
    }

    // 2. Servidores guardados en ConnectionManager de Jellyfin
    try {
        const jfServers = ServerConnections.getSavedServers();
        if (Array.isArray(jfServers)) {
            for (const s of jfServers) {
                const addr = s.ManualAddress || s.LocalAddress || s.Address;
                if (addr) addServer(addr, s.Name, s.Id, s.DateLastAccessed);
            }
        }
    } catch {
        // En tests o si ServerConnections no está disponible
    }

    // 3. Servidor configurado actualmente como fallback
    try {
        if (typeof localStorage !== 'undefined') {
            const current = localStorage.getItem(SERVER_URL_KEY);
            if (current) addServer(current);
        }
    } catch {
        // Ignorar
    }

    // 4. Si la lista sigue vacía, añadimos el origen actual si estamos en navegador
    if (list.length === 0 && typeof window !== 'undefined' && window.location?.origin) {
        // Si el frontend se sirve desde :8080 en dev o desde Jellyfin directo
        const origin = window.location.origin;
        if (origin.startsWith('http')) {
            addServer(origin, 'Servidor actual');
        }
    }

    return list;
}

/** Guarda o actualiza un servidor en la lista persistente. */
export function saveServer(server: DiscoveredServer): void {
    const norm = normalizeServerUrl(server.url);
    if (!norm) return;
    const current = getSavedServers().filter((s) => normalizeServerUrl(s.url) !== norm);
    current.unshift({
        id: server.id,
        name: server.name || norm,
        url: norm,
        version: server.version,
        lastUsed: Date.now()
    });

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SAVED_SERVERS_KEY, JSON.stringify(current));
            localStorage.setItem(SERVER_URL_KEY, norm);
        }
    } catch {
        // Fallo de storage
    }
}

/** Elimina un servidor de la lista persistente. */
export function removeSavedServer(url: string): void {
    const norm = normalizeServerUrl(url);
    const updated = getSavedServers().filter((s) => normalizeServerUrl(s.url) !== norm);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SAVED_SERVERS_KEY, JSON.stringify(updated));
            const current = localStorage.getItem(SERVER_URL_KEY);
            if (current && normalizeServerUrl(current) === norm) {
                localStorage.removeItem(SERVER_URL_KEY);
            }
        }
    } catch {
        // Fallo de storage
    }
}

/**
 * Valida si un servidor está disponible consultando su endpoint público de
 * información de sistema sin requerir autenticación previa.
 */
export async function validateServer(serverUrl: string): Promise<{
    ok: boolean;
    id?: string;
    name?: string;
    version?: string;
    error?: string;
}> {
    const base = normalizeServerUrl(serverUrl);
    if (!base) {
        return { ok: false, error: globalize.translate('MessageInvalidServer') };
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); }, 3500);
        const res = await fetch(`${base}/System/Info/Public`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        clearTimeout(timer);

        if (!res.ok) {
            return { ok: false, error: `HTTP ${res.status}` };
        }

        const data = await res.json() as {
            Id?: string;
            ServerName?: string;
            Version?: string;
        };

        return {
            ok: true,
            id: data.Id,
            name: data.ServerName || 'Jellyfin',
            version: data.Version
        };
    } catch (err) {
        return {
            ok: false,
            error: (err as Error).message || globalize.translate('MessageInvalidServer')
        };
    }
}

/**
 * Obtiene la lista de usuarios públicos que el servidor permite mostrar en
 * la pantalla de bienvenida / login.
 */
export async function getPublicUsers(serverUrl: string): Promise<PublicUser[]> {
    const base = normalizeServerUrl(serverUrl);
    if (!base) return [];

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); }, 7000);
        const res = await fetch(`${base}/Users/Public`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        clearTimeout(timer);

        if (!res.ok) return [];

        const data = await res.json() as Array<{
            Id: string;
            Name: string;
            PrimaryImageTag?: string | null;
            HasPassword?: boolean | null;
            HasConfiguredPassword?: boolean | null;
        }>;

        if (!Array.isArray(data)) return [];

        return data.map((u) => ({
            id: u.Id,
            name: u.Name,
            hasPassword: !!(u.HasPassword ?? u.HasConfiguredPassword),
            primaryImageTag: u.PrimaryImageTag ?? null
        }));
    } catch {
        return [];
    }
}

/**
 * Genera la URL pública del avatar de un usuario del servidor sin necesidad de sesión.
 */
export function avatarUrlForUser(serverUrl: string, userId: string, tag?: string | null): string {
    const base = normalizeServerUrl(serverUrl);
    if (!base || !userId) return '';
    const q = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return `${base}/Users/${userId}/Images/Primary${q}`;
}
