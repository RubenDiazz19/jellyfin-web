// Low-level HTTP helpers shared by every domain-specific API module.
// The MediaBrowser Authorization header inherits clientName/deviceId from the
// SDK Api (ServerConnections) so the server sees a coherent session.

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { loadSession } from '../session/session';

export function authHeader(accessToken?: string): string {
    const api = ServerConnections.getApi();
    const parts = [
        `MediaBrowser Client="${api?.clientInfo?.name ?? 'jellyfin-web'}"`,
        `Device="${api?.deviceInfo?.name ?? 'Web'}"`,
        `DeviceId="${api?.deviceInfo?.id ?? ''}"`,
        `Version="${api?.clientInfo?.version ?? '1.0.0'}"`
    ];
    if (accessToken) parts.push(`Token="${accessToken}"`);
    return parts.join(', ');
}

export function trimSlash(u: string): string {
    return u.replace(/\/$/, '');
}

export function normalizeServerUrl(u: string): string {
    const trimmed = u.trim().replace(/\/$/, '');
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export async function apiFetch<T>(path: string): Promise<T> {
    const session = loadSession();
    if (!session?.accessToken || !session.userId) {
        throw new Error('Sin sesión activa');
    }
    const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
        headers: {
            'Authorization': authHeader(session.accessToken),
            'X-Emby-Authorization': authHeader(session.accessToken)
        }
    });
    if (!res.ok) throw new Error(`API ${path} → HTTP ${res.status}`);
    return res.json();
}

export async function apiSend(
    path: string,
    method: 'POST' | 'DELETE' | 'PUT',
    body?: unknown
): Promise<Response> {
    const session = loadSession();
    if (!session?.accessToken) throw new Error('Sin sesión');
    const headers: Record<string, string> = {
        'Authorization': authHeader(session.accessToken),
        'X-Emby-Authorization': authHeader(session.accessToken)
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}`);
    return res;
}
