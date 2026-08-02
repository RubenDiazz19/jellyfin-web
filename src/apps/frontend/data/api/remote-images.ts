// Image editing: upload from URL / File, delete, and browse alternatives from
// remote providers (TMDB/TVDB).

import { clearShowCache } from './cache';
import { apiFetch, apiSend, uploadImage } from './http';
import type { ImageType } from './images';
import { emitItemMutated } from './mutations';

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
    clearShowCache();
    emitItemMutated(itemId);
}

export async function deleteImage(itemId: string, type: ImageType, index = 0): Promise<void> {
    await apiSend(`/Items/${itemId}/Images/${type}/${index}`, 'DELETE');
    clearShowCache();
    emitItemMutated(itemId);
}

/**
 * Cambia una imagen de posición dentro de su tipo.
 *
 * Solo tiene sentido para los fondos, que son los únicos de los que puede haber
 * varios. El orden importa porque es el que sigue el hero de la ficha al
 * rotarlos: el primero es el que se ve al abrirla.
 */
export async function moveImage(
    itemId: string, type: ImageType, from: number, to: number
): Promise<void> {
    await apiSend(`/Items/${itemId}/Images/${type}/${from}/Index?newIndex=${to}`, 'POST');
    clearShowCache();
    emitItemMutated(itemId);
}

// Jellyfin expects the body as base64 with the image Content-Type. Format is
// auto-detected from the payload header.
export async function uploadImageFile(itemId: string, type: ImageType, file: File): Promise<void> {
    await uploadImage(`/Items/${itemId}/Images/${type}`, file);
    clearShowCache();
    emitItemMutated(itemId);
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

