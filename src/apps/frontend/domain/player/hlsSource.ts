// Arranque de una fuente HLS con hls.js.
//
// Safari reproduce HLS de forma nativa; el resto necesita MSE, y hls.js se
// carga bajo demanda para no meter la librería en el bundle de quien nunca
// abre un transcode.

import type Hls from 'hls.js';

/** El navegador entiende una playlist HLS sin ayuda (Safari). */
export function playsHlsNatively(video: HTMLVideoElement): boolean {
    return !!video.canPlayType('application/vnd.apple.mpegurl');
}

export type HlsAttachResult =
    /** Enganchado: el caller debe destruir esta instancia al cerrar. */
    | { status: 'attached'; hls: Hls }
    /** Ni nativo ni MSE: no hay forma de reproducir esto aquí. */
    | { status: 'unsupported' }
    /** El reproductor se cerró mientras se cargaba la librería. */
    | { status: 'aborted' };

/**
 * Carga hls.js y engancha la playlist al <video>.
 *
 * Los fallos recuperables se reintentan aquí dentro —una playlist de transcode
 * pierde segmentos con normalidad y hls.js sabe recomponerse—; solo los que no
 * tienen arreglo suben a `onUnrecoverable`.
 */
export async function attachHlsSource(
    video: HTMLVideoElement,
    url: string,
    opts: { isClosed: () => boolean; onUnrecoverable: () => void }
): Promise<HlsAttachResult> {
    const HlsMod = (await import('hls.js')).default;
    if (opts.isClosed()) return { status: 'aborted' };
    if (!HlsMod.isSupported()) return { status: 'unsupported' };

    const hls = new HlsMod();
    hls.on(HlsMod.Events.ERROR, (_ev, data) => {
        console.warn('[player] hls.js', data.type, data.details, { fatal: data.fatal });
        if (!data.fatal || opts.isClosed()) return;
        if (data.type === 'networkError') hls.startLoad();
        else if (data.type === 'mediaError') hls.recoverMediaError();
        else opts.onUnrecoverable();
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    return { status: 'attached', hls };
}
