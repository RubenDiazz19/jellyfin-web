/**
 * Tipo MIME a partir del contenedor del medio.
 *
 * Lo consume el `<video>`/`<audio>` para decidir si sabe reproducir algo. La
 * regla general es `tipo/contenedor`; esta tabla recoge los casos en que el
 * nombre del contenedor de Jellyfin no coincide con el subtipo MIME real.
 */

/** Contenedores cuyo nombre no es el subtipo MIME. */
const MIME_OVERRIDES: Record<string, Record<string, string>> = {
    audio: {
        opus: 'audio/ogg',
        webma: 'audio/webm',
        m4a: 'audio/mp4'
    },
    video: {
        mkv: 'video/x-matroska',
        m4v: 'video/mp4',
        mov: 'video/quicktime',
        mpg: 'video/mpeg',
        flv: 'video/x-flv'
    }
};

/**
 * Tipo MIME de un medio. `type` es 'audio' o 'video' en minúsculas.
 *
 * Un contenedor desconocido cae en `tipo/contenedor`, que es lo correcto para
 * la mayoría (mp3, mp4, webm…).
 */
export function getMimeType(type: string, container?: string | null): string {
    const normalized = (container || '').toLowerCase();

    return MIME_OVERRIDES[type]?.[normalized] ?? `${type}/${normalized}`;
}
