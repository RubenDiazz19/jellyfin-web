// Image editing: upload from URL / File, delete, and browse alternatives from
// remote providers (TMDB/TVDB).

import { clearShowCache } from './cache';
import { fetchFanartLogosForItem } from './fanart';
import { apiFetch, apiSend, uploadImage } from './http';
import type { ImageType } from './images';
import { getItemRaw } from './metadata';
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

export type JFImageInfo = {
    ImageType: ImageType;
    ImageIndex?: number;
    ImageTag?: string;
};

export async function getItemImageInfos(itemId: string): Promise<JFImageInfo[]> {
    return apiFetch<JFImageInfo[]>(`/Items/${itemId}/Images`);
}

export async function setImageByUrl(itemId: string, type: ImageType, url: string): Promise<void> {
    try {
        await apiSend(
            `/Items/${itemId}/RemoteImages/Download?Type=${type}&ImageUrl=${encodeURIComponent(url)}`,
            'POST'
        );
    } catch (err) {
        // Fallback: si el servidor Jellyfin no tiene acceso a internet exterior (ej. contenedor aislado),
        // descargamos la imagen en el cliente y la subimos directamente.
        try {
            const res = await fetch(url);
            if (res.ok) {
                const blob = await res.blob();
                const file = new File([blob], 'image.png', { type: blob.type || 'image/png' });
                await uploadImageFile(itemId, type, file);
                return;
            }
        } catch {
            // Ignorar y relanzar el error original
        }
        throw err;
    }
    // El servidor descarga la imagen asíncronamente tras responder 200.
    // Sin este margen el refetch llega antes de que se actualicen los tags
    // y vuelve a construir URLs idénticas → la caché del navegador sirve
    // la imagen vieja.
    await new Promise((r) => setTimeout(r, 600));
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

    const serverPromise = apiFetch<{ Images: JFRemoteImage[]; Providers: string[] }>(
        `/Items/${itemId}/RemoteImages?${q.toString()}`
    ).catch(() => ({ Images: [], Providers: [] }));

    // Para logos, consultar en paralelo Fanart.tv utilizando la clave configurada
    const fanartPromise = type === 'Logo' ?
        getItemRaw(itemId).then((raw) => fetchFanartLogosForItem(raw)).catch(() => [] as JFRemoteImage[]) :
        Promise.resolve([] as JFRemoteImage[]);

    const [serverData, fanartLogos] = await Promise.all([serverPromise, fanartPromise]);

    const serverImages = serverData.Images ?? [];
    const providers = [...(serverData.Providers ?? [])];

    if (fanartLogos.length > 0 && !providers.includes('Fanart.tv')) {
        providers.push('Fanart.tv');
    }

    const seenUrls = new Set<string>();
    const combined: JFRemoteImage[] = [];

    // Priorizar logos de Fanart.tv sobre los de otros proveedores
    for (const img of [...fanartLogos, ...serverImages]) {
        if (!img.Url || seenUrls.has(img.Url)) continue;
        seenUrls.add(img.Url);
        combined.push(img);
    }

    return { images: combined, providers };
}

