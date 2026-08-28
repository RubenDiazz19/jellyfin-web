// Búsqueda remota (OpenSubtitles, etc.), descarga, subida manual y gestión
// de subtítulos.

import { loadSession } from '../session/session';
import { clearShowCache } from './cache';
import { apiFetch, apiSend, noSessionError } from './http';
import { emitItemMutated } from './mutations';
import { mapMediaStream, type MediaStreamInfo } from './playback';
import type { JFMediaStream } from './types';

export type RemoteSubtitle = {
    Id: string;
    Name: string;
    Format?: string;
    Language?: string;
    ProviderName?: string;
    Comment?: string;
    DownloadCount?: number;
    CommunityRating?: number;
    IsForced?: boolean;
    IsHearingImpaired?: boolean;
    Forced?: boolean;
    HearingImpaired?: boolean;
    ThreeLetterISOLanguageName?: string;
};

export type UploadSubtitleOptions = {
    /** Código de idioma de 3 letras (ISO 639-2, ej. "spa", "eng", "fre") */
    language: string;
    /** Formato o extensión sin punto (ej. "srt", "vtt", "ass", "sub") */
    format: string;
    isForced?: boolean;
    isHearingImpaired?: boolean;
    /** Contenido del archivo codificado en Base64 */
    data: string;
};

/**
 * Busca subtítulos en los proveedores remotos configurados en el servidor Jellyfin.
 *
 * El endpoint de búsqueda en Jellyfin es GET /Items/{itemId}/RemoteSearch/Subtitles/{language}.
 */
export async function searchSubtitles(
    itemId: string,
    language: string,
    isPerfectMatch?: boolean
): Promise<RemoteSubtitle[]> {
    const params = new URLSearchParams();
    if (isPerfectMatch !== undefined) {
        params.set('isPerfectMatch', String(isPerfectMatch));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<RemoteSubtitle[]>(`/Items/${itemId}/RemoteSearch/Subtitles/${encodeURIComponent(language)}${query}`);
}

/**
 * Descarga un subtítulo remoto en el servidor y lo asigna al elemento.
 */
export async function downloadSubtitle(itemId: string, subtitleId: string): Promise<void> {
    await apiSend(
        `/Items/${itemId}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`,
        'POST'
    );
    clearShowCache();
    emitItemMutated(itemId);
}

/**
 * Sube un archivo de subtítulo manual al servidor codificado en Base64.
 */
export async function uploadSubtitle(itemId: string, options: UploadSubtitleOptions): Promise<void> {
    await apiSend(
        `/Videos/${itemId}/Subtitles`,
        'POST',
        {
            Language: options.language,
            Format: options.format,
            IsForced: !!options.isForced,
            IsHearingImpaired: !!options.isHearingImpaired,
            Data: options.data
        }
    );
    clearShowCache();
    emitItemMutated(itemId);
}

/**
 * Elimina un subtítulo externo asignado al elemento.
 */
export async function deleteSubtitle(itemId: string, streamIndex: number): Promise<void> {
    await apiSend(`/Videos/${itemId}/Subtitles/${streamIndex}`, 'DELETE');
    clearShowCache();
    emitItemMutated(itemId);
}

/**
 * Obtiene la lista de subtítulos actuales de un elemento.
 */
export async function getItemSubtitles(itemId: string): Promise<MediaStreamInfo[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const item = await apiFetch<{
        MediaSources?: { MediaStreams?: JFMediaStream[] }[];
        MediaStreams?: JFMediaStream[];
    }>(`/Users/${session.userId}/Items/${itemId}?Fields=MediaSources`);
    const source = (item.MediaSources ?? [])[0];
    const streams = source?.MediaStreams ?? item.MediaStreams ?? [];
    return streams.filter((s) => s.Type === 'Subtitle').map(mapMediaStream);
}

/**
 * Convierte un File del navegador a una cadena Base64 pura.
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                const parts = result.split(',');
                resolve(parts.length > 1 ? parts[1] : parts[0]);
            } else {
                reject(new Error('Formato de lectura no soportado'));
            }
        };
        reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo'));
        reader.readAsDataURL(file);
    });
}
