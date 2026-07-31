// Low-level HTTP helpers shared by every domain-specific API module.
// The MediaBrowser Authorization header inherits clientName/deviceId from the
// SDK Api (ServerConnections) so the server sees a coherent session.

import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { loadSession } from '../session/session';

/**
 * Guard used by every call that needs a signed-in user. The message reaches
 * the user through the toast that wraps these calls, so it is translated.
 */
export function noSessionError(): Error {
    return new Error(globalize.translate('MessageNoSession'));
}

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

/**
 * Error de una respuesta no-2xx. Lleva el `status` como propiedad para que el
 * llamante pueda componer su propio mensaje traducido sin re-parsear el texto
 * del Error (que es lo que obligaba a hacer `fetch` a mano en cada módulo).
 */
export class HttpError extends Error {
    constructor(readonly status: number, message: string, readonly body = '') {
        super(message);
        this.name = 'HttpError';
    }
}

export function trimSlash(u: string): string {
    return u.replace(/\/$/, '');
}

/** Cabeceras de autenticación comunes a toda petición al servidor. */
function authHeaders(accessToken: string): Record<string, string> {
    return {
        'Authorization': authHeader(accessToken),
        'X-Emby-Authorization': authHeader(accessToken)
    };
}

export function normalizeServerUrl(u: string): string {
    const trimmed = u.trim().replace(/\/$/, '');
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export async function apiFetch<T>(path: string): Promise<T> {
    const session = loadSession();
    if (!session?.accessToken || !session.userId) {
        throw noSessionError();
    }
    const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
        headers: authHeaders(session.accessToken)
    });
    if (!res.ok) throw new HttpError(res.status, `API ${path} → HTTP ${res.status}`);
    return res.json();
}

export async function apiSend(
    path: string,
    method: 'POST' | 'DELETE' | 'PUT',
    body?: unknown
): Promise<Response> {
    const session = loadSession();
    if (!session?.accessToken) throw noSessionError();
    const headers = authHeaders(session.accessToken);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new HttpError(res.status, `${method} ${path} → HTTP ${res.status}`);
    return res;
}

/** Tope del servidor para una subida de imagen. */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

// base64 sin `fromCharCode(...spread)`: revienta la pila con arrays grandes.
function arrayBufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let bin = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
    }
    return btoa(bin);
}

/**
 * Sube una imagen a `path`. El endpoint de imágenes de Jellyfin no acepta
 * JSON ni multipart: quiere el binario en base64 con el Content-Type real de
 * la imagen, y por eso no puede ir por `apiSend`. Lo usan tanto el avatar del
 * usuario como las carátulas de items, que hacían esto mismo por separado.
 */
export async function uploadImage(path: string, file: File): Promise<void> {
    const session = loadSession();
    if (!session?.accessToken) throw noSessionError();
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(`La imagen supera 30 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    }
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const res = await fetch(`${trimSlash(session.serverUrl)}${path}`, {
        method: 'POST',
        headers: { ...authHeaders(session.accessToken), 'Content-Type': mime },
        body: base64
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new HttpError(
            res.status,
            globalize.translate('MessageUploadFailed', `${res.status} ${text}`.trim()),
            text
        );
    }
}
