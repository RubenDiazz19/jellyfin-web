// Arranque de una fuente HLS con hls.js.
//
// Safari reproduce HLS de forma nativa; el resto necesita MSE, y hls.js se
// carga bajo demanda para no meter la librería en el bundle de quien nunca
// abre un transcode.

import type Hls from 'hls.js';
import type { LoadPolicy } from 'hls.js';

/** El navegador entiende una playlist HLS sin ayuda (Safari). */
export function playsHlsNatively(video: HTMLVideoElement): boolean {
    return !!video.canPlayType('application/vnd.apple.mpegurl');
}

/**
 * Cuánto se espera una carga y cuántas veces se reintenta.
 *
 * En los reintentos por TIMEOUT no se espera nada entre uno y otro (ya se ha
 * esperado bastante); en los de ERROR sí, con la escalada que trae hls.js de
 * serie, porque un 5xx del servidor suele necesitar un respiro.
 */
function patience(
    maxTimeToFirstByteMs: number, maxLoadTimeMs: number, maxNumRetry: number
): LoadPolicy {
    return {
        default: {
            maxTimeToFirstByteMs,
            maxLoadTimeMs,
            timeoutRetry: { maxNumRetry, retryDelayMs: 0, maxRetryDelayMs: 0 },
            errorRetry: { maxNumRetry, retryDelayMs: 1000, maxRetryDelayMs: 8000 }
        }
    };
}

/**
 * Ajustes de hls.js para lo que servimos: la playlist de un transcode de
 * Jellyfin que se está generando sobre la marcha, no un VOD ya empaquetado en
 * un CDN —que es para lo que están pensados los valores por defecto—.
 */
const HLS_CONFIG = {
    // No pedir una calidad que no cabe en la ventana: en una playlist con
    // varias variantes, un portátil a media pantalla no necesita el 4K, y
    // pedirlo es transcode y ancho de banda tirados.
    capLevelToPlayerSize: true,
    // Búfer acotado por los dos lados. `backBufferLength` por defecto es
    // infinito: en una película larga eso son cientos de MB retenidos en el
    // SourceBuffer que nadie va a volver a ver.
    backBufferLength: 60,
    maxBufferLength: 30,
    maxMaxBufferLength: 120,
    // Paciencia con el arranque en frío. La que más importa es la de la
    // playlist de variante: es la petición con la que el servidor levanta
    // ffmpeg, así que puede tardar segundos en contestar y con los tiempos de
    // serie se abortaba el arranque en servidores modestos.
    manifestLoadPolicy: patience(30_000, 30_000, 4),
    playlistLoadPolicy: patience(30_000, 30_000, 4),
    // Y un fragmento del principio se hace esperar por lo mismo. Generoso en
    // reintentos: una playlist de transcode pierde segmentos con normalidad y
    // hls.js sabe recomponerse.
    fragLoadPolicy: patience(20_000, 40_000, 6)
};

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

    const hls = new HlsMod(HLS_CONFIG);
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
