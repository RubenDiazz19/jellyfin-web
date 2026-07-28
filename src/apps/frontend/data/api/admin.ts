// Admin endpoints: server info + library rescan + link back to the native
// admin dashboard.

import globalize from 'lib/globalize';

import { loadSession } from '../session/session';
import { apiFetch, authHeader, noSessionError, trimSlash } from './http';

export type SystemInfo = {
    serverName: string;
    version: string;
    operatingSystem: string;
    id: string;
};

/** Lo que /System/Info devuelve y aquí se usa (el resto se ignora). */
type JFSystemInfo = {
    ServerName?: string;
    Version?: string;
    OperatingSystem?: string;
    Id?: string;
};

export async function getSystemInfo(): Promise<SystemInfo> {
    const data = await apiFetch<JFSystemInfo>('/System/Info');
    return {
        serverName: data.ServerName ?? 'Jellyfin',
        version: data.Version ?? '',
        operatingSystem: data.OperatingSystem ?? '',
        id: data.Id ?? ''
    };
}

// Kicks off a full rescan across every library (native Dashboard → Library →
// Scan). POST without a body, returns 204.
export async function refreshLibrary(): Promise<void> {
    const session = loadSession();
    if (!session?.accessToken) throw noSessionError();
    const res = await fetch(`${trimSlash(session.serverUrl)}/Library/Refresh`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader(session.accessToken),
            'X-Emby-Authorization': authHeader(session.accessToken)
        }
    });
    if (!res.ok) throw new Error(globalize.translate('MessageRefreshFailed', res.status));
}

export function dashboardUrl(): string {
    const session = loadSession();
    if (!session?.serverUrl) return '';
    return `${trimSlash(session.serverUrl)}/web/#/dashboard`;
}
