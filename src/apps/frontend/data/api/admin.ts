// Admin endpoints: server info + library rescan + link back to the native
// admin dashboard.

import globalize from 'lib/globalize';

import { apiFetch, apiSend, HttpError } from './http';

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
    try {
        await apiSend('/Library/Refresh', 'POST');
    } catch (e) {
        // El mensaje llega al usuario por un toast, así que se traduce; el
        // de `apiSend` es para la consola.
        if (e instanceof HttpError) {
            throw new Error(globalize.translate('MessageRefreshFailed', e.status));
        }
        throw e;
    }
}
