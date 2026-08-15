import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';

import { includesAny } from 'utils/container';

/** Preguntas sobre una pista concreta de una fuente. */

/**
 * ¿Puede el dispositivo cambiar a esta pista de audio sin transcodificar?
 *
 * Hace falta que algún perfil de reproducción directa acepte a la vez el
 * contenedor de la fuente y el códec de la pista: cambiar de pista no cambia
 * el contenedor, así que los dos tienen que encajar.
 */
export function isAudioStreamSupported(
    mediaSource: MediaSourceInfo,
    index: number,
    deviceProfile: DeviceProfile
): boolean {
    const mediaStream = mediaSource.MediaStreams?.find(
        (s: MediaStream) => s.Type === 'Audio' && s.Index === index
    );
    if (!mediaStream) return false;

    const codec = (mediaStream.Codec || '').toLowerCase();
    if (!codec) return false;

    const container = (mediaSource.Container || '').toLowerCase();

    return (deviceProfile.DirectPlayProfiles ?? []).some((p) => (
        p.Type === 'Video'
        && includesAny((p.Container || '').toLowerCase(), container)
        && includesAny((p.AudioCodec || '').toLowerCase(), codec)
    ));
}

/**
 * Cómo llegan los subtítulos al reproductor: fichero aparte, incrustados en el
 * contenedor o quemados en la imagen.
 *
 * En los items locales el servidor no lo dice, así que se deduce: si el
 * subtítulo es externo viene como fichero, y si no, va dentro.
 */
export function getDeliveryMethod(subtitleStream: MediaStream): string {
    if (subtitleStream.DeliveryMethod) {
        return subtitleStream.DeliveryMethod;
    }

    return subtitleStream.IsExternal ? 'External' : 'Embed';
}

/**
 * Tras un error de reproducción, ¿tiene sentido reintentar transcodificando?
 *
 * Solo si el servidor puede transcodificar y aún queda algo que degradar: si
 * ya se están recodificando las dos pistas, el reintento daría exactamente el
 * mismo resultado.
 */
export function enablePlaybackRetryWithTranscoding(
    mediaSource: MediaSourceInfo | undefined,
    currentlyPreventsVideoStreamCopy: boolean,
    currentlyPreventsAudioStreamCopy: boolean
): boolean {
    return !!mediaSource?.SupportsTranscoding
        && (!currentlyPreventsVideoStreamCopy || !currentlyPreventsAudioStreamCopy);
}
