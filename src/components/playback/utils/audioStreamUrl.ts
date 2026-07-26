import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { DirectPlayProfile } from '@jellyfin/sdk/lib/generated-client/models/direct-play-profile';
import type { TranscodingProfile } from '@jellyfin/sdk/lib/generated-client/models/transcoding-profile';

import { appHost } from 'components/apphost';
import itemHelper from 'components/itemHelper';
import { AppFeature } from 'constants/appFeature';

/**
 * URLs de reproducción de audio.
 *
 * El audio no pasa por `/PlaybackInfo`: el endpoint `Audio/{id}/universal`
 * decide en el servidor si transcodifica, y el cliente solo tiene que decirle
 * qué contenedores acepta y hasta dónde llega. Se ahorra un viaje por pista,
 * que en un álbum entero se nota.
 */

/** ApiClient legacy, del que aquí solo se usa la construcción de URLs. */
export interface UrlApiClient {
    getUrl: (path: string, params: Record<string, unknown>) => string;
    getCurrentUserId: () => string;
    deviceId: () => string;
    accessToken: () => string;
}

/** Techos de audio que impone el perfil del dispositivo. */
export interface AudioMaxValues {
    maxAudioSampleRate: number | null;
    maxAudioBitDepth: number | null;
    maxAudioBitrate: number | null;
    /** Techo general de la sesión; solo se usa si no hay uno de audio. */
    maxBitrate?: number | null;
}

/**
 * Extrae los techos de audio del perfil del dispositivo.
 *
 * Solo mira condiciones `LessThanEqual`, que son las que expresan un máximo.
 * El perfil puede declarar límites distintos por códec, pero aquí se colapsan
 * en uno solo: el que gane el último recorrido.
 */
export function getAudioMaxValues(deviceProfile: DeviceProfile): AudioMaxValues {
    let maxAudioSampleRate: number | null = null;
    let maxAudioBitDepth: number | null = null;
    let maxAudioBitrate: number | null = null;

    deviceProfile.CodecProfiles?.forEach((codecProfile) => {
        if (codecProfile.Type !== 'Audio') return;

        codecProfile.Conditions?.forEach((condition) => {
            if (condition.Condition !== 'LessThanEqual') return;

            const value = condition.Value != null ? Number(condition.Value) : null;
            if (condition.Property === 'AudioBitDepth') maxAudioBitDepth = value;
            else if (condition.Property === 'AudioSampleRate') maxAudioSampleRate = value;
            else if (condition.Property === 'AudioBitrate') maxAudioBitrate = value;
        });
    });

    return { maxAudioSampleRate, maxAudioBitDepth, maxAudioBitrate };
}

/**
 * Identificador de sesión de reproducción.
 *
 * Es un contador que arranca en la hora de carga de la página: basta con que
 * sea distinto en cada reproducción para que el servidor no mezcle sesiones.
 */
let startingPlaySession = Date.now();

/** URL de `Audio/{id}/universal` con los límites y contenedores negociados. */
export function getAudioStreamUrl(
    item: BaseItemDto,
    transcodingProfile: TranscodingProfile | undefined,
    directPlayContainers: string,
    apiClient: UrlApiClient,
    startPosition: number | undefined,
    maxValues: AudioMaxValues
): string {
    startingPlaySession++;

    return apiClient.getUrl(`Audio/${item.Id}/universal`, {
        UserId: apiClient.getCurrentUserId(),
        DeviceId: apiClient.deviceId(),
        MaxStreamingBitrate: maxValues.maxAudioBitrate || maxValues.maxBitrate,
        Container: directPlayContainers,
        TranscodingContainer: transcodingProfile?.Container || null,
        TranscodingProtocol: transcodingProfile?.Protocol || null,
        AudioCodec: transcodingProfile?.AudioCodec,
        MaxAudioSampleRate: maxValues.maxAudioSampleRate,
        MaxAudioBitDepth: maxValues.maxAudioBitDepth,
        ApiKey: apiClient.accessToken(),
        PlaySessionId: startingPlaySession,
        StartTimeTicks: startPosition || 0,
        EnableRedirection: true,
        EnableRemoteMedia: appHost.supports(AppFeature.RemoteAudio),
        EnableAudioVbrEncoding: transcodingProfile?.EnableAudioVbrEncoding
    });
}

/** Perfil de transcodificación de audio en streaming, si el perfil lo trae. */
function findAudioTranscodingProfile(
    deviceProfile: DeviceProfile
): TranscodingProfile | undefined {
    return deviceProfile.TranscodingProfiles?.find(
        (p) => p.Type === 'Audio' && p.Context === 'Streaming'
    );
}

/**
 * Contenedores de audio que el dispositivo reproduce directamente, en el
 * formato que espera el servidor: `mp3,flac|vorbis` — coma entre contenedores
 * y `|` para acotar el códec dentro de uno.
 */
function buildDirectPlayContainers(deviceProfile: DeviceProfile): string {
    const audioProfiles = (deviceProfile.DirectPlayProfiles ?? [])
        .filter((p: DirectPlayProfile) => p.Type === 'Audio');

    return audioProfiles
        .map((p) => (p.AudioCodec ? `${p.Container}|${p.AudioCodec}` : p.Container))
        .join(',');
}

/** URL de audio para un item, negociada contra el perfil del dispositivo. */
export function getAudioStreamUrlFromDeviceProfile(
    item: BaseItemDto,
    deviceProfile: DeviceProfile,
    maxBitrate: number | undefined,
    apiClient: UrlApiClient,
    startPosition?: number
): string {
    return getAudioStreamUrl(
        item,
        findAudioTranscodingProfile(deviceProfile),
        buildDirectPlayContainers(deviceProfile),
        apiClient,
        startPosition,
        { maxBitrate, ...getAudioMaxValues(deviceProfile) }
    );
}

/**
 * URLs para una tanda de items, en el mismo orden.
 *
 * Los que no son audio del servidor quedan como cadena vacía: el hueco se
 * conserva para que el índice siga coincidiendo con el del item.
 * `startPosition` solo se aplica al primero — los siguientes empiezan de cero.
 */
export function getStreamUrls(
    items: BaseItemDto[],
    deviceProfile: DeviceProfile,
    maxBitrate: number | undefined,
    apiClient: UrlApiClient,
    startPosition?: number
): string[] {
    const transcodingProfile = findAudioTranscodingProfile(deviceProfile);
    const directPlayContainers = buildDirectPlayContainers(deviceProfile);
    const maxValues = getAudioMaxValues(deviceProfile);

    return items.map((item, index) => {
        const isStreamableAudio = item.MediaType === 'Audio' && !itemHelper.isLocalItem(item);
        if (!isStreamableAudio) return '';

        return getAudioStreamUrl(
            item,
            transcodingProfile,
            directPlayContainers,
            apiClient,
            index === 0 ? startPosition : 0,
            { maxBitrate, ...maxValues }
        );
    });
}

/**
 * Precalcula la fuente de cada item de la tanda.
 *
 * Deja `PresetMediaSource` puesto para que, al llegarle el turno a la pista,
 * `getPlaybackInfo` la use tal cual en vez de volver a preguntar al servidor.
 */
export function setStreamUrls(
    items: BaseItemDto[],
    deviceProfile: DeviceProfile,
    maxBitrate: number | undefined,
    apiClient: UrlApiClient,
    startPosition?: number
): void {
    const streamUrls = getStreamUrls(items, deviceProfile, maxBitrate, apiClient, startPosition);

    items.forEach((item, index) => {
        const streamUrl = streamUrls[index];
        if (!streamUrl) return;

        (item as BaseItemDto & { PresetMediaSource?: unknown }).PresetMediaSource = {
            StreamUrl: streamUrl,
            Id: item.Id,
            MediaStreams: [],
            RunTimeTicks: item.RunTimeTicks
        };
    });
}
