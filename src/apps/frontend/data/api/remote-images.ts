// Image editing: upload from URL / File, delete, and browse alternatives from
// remote providers (TMDB/TVDB).

import { loadSession } from '../session/session';
import { invalidateShow } from './cache';
import { apiFetch, apiSend, authHeader, trimSlash } from './http';
import type { ImageType } from './images';

export type JFRemoteImage = {
    Url: string;
    ThumbnailUrl?: string;
    Height?: number;
    Width?: number;
    Language?: string;
    CommunityRating?: number;
    VoteCount?: number;
    ProviderName?: string;
    Type?: string;
};

export async function setImageByUrl(itemId: string, type: ImageType, url: string): Promise<void> {
    await apiSend(
        `/Items/${itemId}/RemoteImages/Download?Type=${type}&ImageUrl=${encodeURIComponent(url)}`,
        'POST'
    );
    invalidateShow(itemId);
}

export async function deleteImage(itemId: string, type: ImageType, index = 0): Promise<void> {
    await apiSend(`/Items/${itemId}/Images/${type}/${index}`, 'DELETE');
    invalidateShow(itemId);
}

// Jellyfin expects the body as base64 with the image Content-Type. Format is
// auto-detected from the payload header.
export async function uploadImageFile(itemId: string, type: ImageType, file: File): Promise<void> {
    const session = loadSession();
    if (!session?.accessToken) throw new Error('Sin sesión');
    const MAX_BYTES = 30 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
        throw new Error(`La imagen supera 30 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    }
    const buf = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const res = await fetch(`${trimSlash(session.serverUrl)}/Items/${itemId}/Images/${type}`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader(session.accessToken),
            'X-Emby-Authorization': authHeader(session.accessToken),
            'Content-Type': mime
        },
        body: base64
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload falló: HTTP ${res.status} ${text}`);
    }
    invalidateShow(itemId);
}

export async function getRemoteImages(
    itemId: string,
    type: ImageType,
    opts: { includeAllLanguages?: boolean; limit?: number } = {}
): Promise<{ images: JFRemoteImage[]; providers: string[] }> {
    const q = new URLSearchParams({
        type,
        startIndex: '0',
        limit: String(opts.limit ?? 60),
        includeAllLanguages: String(opts.includeAllLanguages ?? true)
    });
    const data = await apiFetch<{ Images: JFRemoteImage[]; Providers: string[] }>(
        `/Items/${itemId}/RemoteImages?${q.toString()}`
    );
    return { images: data.Images ?? [], providers: data.Providers ?? [] };
}

// Base64 without spread-fromCharCode: it blows the stack on large arrays.
function arrayBufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let bin = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
    }
    return btoa(bin);
}
