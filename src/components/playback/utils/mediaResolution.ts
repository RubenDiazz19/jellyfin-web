import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import type { PlaybackInfoResponse } from '@jellyfin/sdk/lib/generated-client/models/playback-info-response';
import { PlaybackErrorCode } from '@jellyfin/sdk/lib/generated-client/models/playback-error-code';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';

import alert from 'components/alert';
import { appHost } from 'components/apphost';
import itemHelper from 'components/itemHelper';
import { AppFeature } from 'constants/appFeature';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import appSettings from 'scripts/settings/appSettings';

import type { Player } from '../types/player';
import { getAudioStreamUrlFromDeviceProfile, type UrlApiClient } from './audioStreamUrl';

/**
 * Resolución de medios: de un item a una fuente concreta reproducible.
 *
 * El servidor decide en `/PlaybackInfo` qué versión del item puede reproducir
 * este dispositivo y cómo (directo, remux o transcodificación). Aquí se
 * prepara esa consulta, se elige la mejor fuente de las que devuelve y se
 * abren los live streams.
 */

/** ApiClient legacy: solo lo que necesita este módulo. */
interface MediaApiClient extends UrlApiClient {
    serverId: () => string;
    getEndpointInfo: () => Promise<{ IsInNetwork?: boolean; IsLocal?: boolean }>;
    ajax: (options: Record<string, unknown>) => Promise<unknown>;
}

/** Opciones de reproducción que afectan a la consulta de PlaybackInfo. */
export interface PlaybackInfoOptions {
    startPosition?: number;
    maxBitrate?: number;
    isPlayback?: boolean;
    audioStreamIndex?: number | null;
    subtitleStreamIndex?: number | null;
    secondarySubtitleStreamIndex?: number | null;
    enableDirectPlay?: boolean | null;
    enableDirectStream?: boolean | null;
    allowVideoStreamCopy?: boolean | null;
    allowAudioStreamCopy?: boolean | null;
}

/** Player en lo que respecta a la negociación con el servidor. */
interface NegotiatingPlayer extends Player {
    useServerPlaybackInfoForAudio?: boolean;
    enableMediaProbe?: (item: BaseItemDto) => boolean;
    supportsPlayMethod?: (method: string, item: BaseItemDto) => boolean;
    getDirectPlayProtocols?: () => string[];
}

/**
 * Tipos de vídeo que son un volcado de disco en carpeta. El motor que
 * construye los streams todavía no los soporta, así que la única vía es el
 * acceso directo.
 */
const FOLDER_RIP_VIDEO_TYPES = ['BluRay', 'Dvd', 'HdDvd'];

/**
 * Fuente tal como la maneja la app. El SDK no declara `StreamUrl` —el servidor
 * no la devuelve en /PlaybackInfo— porque la pone el cliente al resolver el
 * audio por la URL universal.
 */
export type AppMediaSource = MediaSourceInfo & { StreamUrl?: string };

/** Item con la fuente ya resuelta por `setStreamUrls`. */
type ItemWithPresetSource = BaseItemDto & { PresetMediaSource?: AppMediaSource };

/**
 * Consulta al servidor cómo reproducir un item.
 *
 * Hay dos atajos que evitan el viaje: el audio del servidor se resuelve con la
 * URL universal (ver `audioStreamUrl`), y un item que ya trae
 * `PresetMediaSource` viene precalculado de una tanda anterior.
 */
export async function getPlaybackInfo(
    player: NegotiatingPlayer,
    apiClient: MediaApiClient,
    item: ItemWithPresetSource,
    deviceProfile: DeviceProfile,
    mediaSourceId: string | null | undefined,
    liveStreamId: string | null | undefined,
    options: PlaybackInfoOptions
): Promise<PlaybackInfoResponse> {
    const isStreamableAudio = !itemHelper.isLocalItem(item)
        && item.MediaType === 'Audio'
        && !player.useServerPlaybackInfoForAudio;

    if (isStreamableAudio) {
        const source: AppMediaSource = {
            StreamUrl: getAudioStreamUrlFromDeviceProfile(
                item, deviceProfile, options.maxBitrate, apiClient, options.startPosition
            ),
            Id: item.Id,
            MediaStreams: [],
            RunTimeTicks: item.RunTimeTicks
        };

        return { MediaSources: [source] };
    }

    if (item.PresetMediaSource) {
        return { MediaSources: [item.PresetMediaSource] };
    }

    const query = buildPlaybackInfoQuery(player, apiClient, item, deviceProfile,
        mediaSourceId, liveStreamId, options);

    const api = ServerConnections.getApi(apiClient.serverId());
    if (!api) {
        throw new Error(`Sin conexión al servidor ${apiClient.serverId()}`);
    }

    const res = await getMediaInfoApi(api).getPostedPlaybackInfo({
        itemId: item.Id as string,
        playbackInfoDto: query
    });
    return res.data;
}

/** Arma el cuerpo de la consulta, omitiendo lo que no se ha especificado. */
function buildPlaybackInfoQuery(
    player: NegotiatingPlayer,
    apiClient: MediaApiClient,
    item: BaseItemDto,
    deviceProfile: DeviceProfile,
    mediaSourceId: string | null | undefined,
    liveStreamId: string | null | undefined,
    options: PlaybackInfoOptions
): Record<string, unknown> {
    const query: Record<string, unknown> = {
        UserId: apiClient.getCurrentUserId(),
        StartTimeTicks: options.startPosition || 0,
        // `IsPlayback` distingue reproducir de solo inspeccionar: solo en el
        // primer caso el servidor abre el live stream y cuenta la sesión.
        IsPlayback: !!options.isPlayback,
        AutoOpenLiveStream: !!options.isPlayback
    };

    // Preferencias explícitas: viajan si se han fijado, incluidas las que son
    // `false` o `0` (la pista 0 es una pista válida). Omitir una significa
    // "decide tú", que no es lo mismo que pedirla desactivada.
    const explicit: Array<[string, unknown]> = [
        ['AudioStreamIndex', options.audioStreamIndex],
        ['SubtitleStreamIndex', options.subtitleStreamIndex],
        ['SecondarySubtitleStreamIndex', options.secondarySubtitleStreamIndex],
        ['EnableDirectPlay', options.enableDirectPlay],
        ['EnableDirectStream', options.enableDirectStream],
        ['AllowVideoStreamCopy', options.allowVideoStreamCopy],
        ['AllowAudioStreamCopy', options.allowAudioStreamCopy]
    ];
    for (const [key, value] of explicit) {
        if (value != null) query[key] = value;
    }

    // Identificadores y límites: aquí un valor vacío o 0 no significa nada,
    // así que basta con mirar si tienen valor.
    if (mediaSourceId) query.MediaSourceId = mediaSourceId;
    if (liveStreamId) query.LiveStreamId = liveStreamId;
    if (options.maxBitrate) query.MaxStreamingBitrate = options.maxBitrate;

    if (player.enableMediaProbe && !player.enableMediaProbe(item)) {
        query.EnableMediaProbe = false;
    }

    // Lo último: el player puede vetar lo que el servidor ofrecería.
    if (query.EnableDirectStream !== false
        && player.supportsPlayMethod && !player.supportsPlayMethod('DirectStream', item)
    ) {
        query.EnableDirectStream = false;
    }

    if (player.getDirectPlayProtocols) {
        query.DirectPlayProtocols = player.getDirectPlayProtocols();
    }

    // El ajuste usa el mismo método para leer y escribir; sin argumento, lee.
    query.AlwaysBurnInSubtitleWhenTranscoding =
        appSettings.alwaysBurnInSubtitleWhenTranscoding();
    query.DeviceProfile = deviceProfile;

    return query;
}

/**
 * Elige la mejor versión del item entre las que ofrece el servidor.
 *
 * Por orden de preferencia: la que se puede reproducir tal cual, la que se
 * puede remuxar y la que hay que transcodificar. Si ninguna encaja, la
 * primera — que fallará, pero con un error del player en vez de un silencio.
 */
export async function getOptimalMediaSource(
    apiClient: MediaApiClient,
    item: BaseItemDto,
    versions: MediaSourceInfo[]
): Promise<MediaSourceInfo> {
    if (!versions.length) {
        return Promise.reject(new Error('El item no tiene ninguna fuente reproducible'));
    }

    const directPlayResults = await Promise.all(
        versions.map((v) => supportsDirectPlay(apiClient, item, v))
    );

    // El flag se anota en la fuente: el resto del sistema lo consulta después.
    versions.forEach((version, index) => {
        (version as MediaSourceInfo & { enableDirectPlay?: boolean }).enableDirectPlay =
            directPlayResults[index] || false;
    });

    return versions.find((_, i) => directPlayResults[i])
        ?? versions.find((v) => v.SupportsDirectStream)
        ?? versions.find((v) => v.SupportsTranscoding)
        ?? versions[0];
}

/** Abre un live stream (TV en directo, grabaciones en curso) en el servidor. */
export function getLiveStream(
    player: NegotiatingPlayer,
    apiClient: MediaApiClient,
    item: BaseItemDto,
    playSessionId: string,
    deviceProfile: DeviceProfile,
    mediaSource: MediaSourceInfo,
    options: PlaybackInfoOptions
): Promise<unknown> {
    const query: Record<string, unknown> = {
        UserId: apiClient.getCurrentUserId(),
        StartTimeTicks: options.startPosition || 0,
        ItemId: item.Id,
        PlaySessionId: playSessionId
    };

    if (options.maxBitrate) query.MaxStreamingBitrate = options.maxBitrate;
    if (options.audioStreamIndex != null) query.AudioStreamIndex = options.audioStreamIndex;
    if (options.subtitleStreamIndex != null) query.SubtitleStreamIndex = options.subtitleStreamIndex;

    // Igual que en PlaybackInfo: el veto del player va el último. El original
    // comprobaba antes `query.EnableDirectStream !== false`, pero aquí nunca
    // se ha fijado, así que la condición siempre se cumplía.
    if (player.supportsPlayMethod && !player.supportsPlayMethod('DirectStream', item)) {
        query.EnableDirectStream = false;
    }

    return apiClient.ajax({
        url: apiClient.getUrl('LiveStreams/Open', query),
        type: 'POST',
        data: JSON.stringify({
            DeviceProfile: deviceProfile,
            OpenToken: mediaSource.OpenToken
        }),
        contentType: 'application/json',
        dataType: 'json'
    });
}

/**
 * ¿Se puede abrir la ruta de la fuente desde donde está el cliente?
 *
 * Una fuente de la red local no es accesible desde fuera, y una ruta con
 * localhost solo funciona si la app corre en la misma máquina que el servidor.
 */
export async function isHostReachable(
    mediaSource: MediaSourceInfo,
    apiClient: MediaApiClient
): Promise<boolean> {
    if (mediaSource.IsRemote) {
        return true;
    }

    const endpointInfo = await apiClient.getEndpointInfo();
    if (!endpointInfo.IsInNetwork) {
        // La fuente está en la red local y la conexión viene de fuera.
        return false;
    }

    if (!endpointInfo.IsLocal) {
        const path = (mediaSource.Path || '').toLowerCase();
        if (path.includes('localhost') || path.includes('127.0.0.1')) {
            return false;
        }
    }

    return true;
}

/**
 * ¿Puede el cliente leer esta fuente directamente, sin pasar por el servidor?
 *
 * Los rips de carpeta (BluRay/DVD/HD DVD) se cuelan aunque el servidor no los
 * marque: el motor que construye los streams todavía no los soporta, así que
 * la única vía es el acceso directo.
 */
export async function supportsDirectPlay(
    apiClient: MediaApiClient,
    item: BaseItemDto,
    mediaSource: MediaSourceInfo
): Promise<boolean> {
    // 'HdDvd' ya no existe en el enum del SDK, pero un servidor antiguo aún
    // puede mandarlo, así que se compara como cadena.
    const isFolderRip = FOLDER_RIP_VIDEO_TYPES.includes(mediaSource.VideoType as string);

    if (!mediaSource.SupportsDirectPlay && !isFolderRip) {
        return false;
    }

    if (mediaSource.IsRemote && !appHost.supports(AppFeature.RemoteVideo)) {
        return false;
    }

    // El navegador no puede añadir cabeceras a la petición de un <video>, así
    // que una fuente que las exija no se puede leer directamente.
    //
    // El código original comprobaba `RequiredHttpHeaders.length`, pero el
    // campo es un diccionario, no un array: `.length` era siempre undefined y
    // la condición se cumplía SIEMPRE. Es decir, las fuentes con cabeceras
    // obligatorias se daban por reproducibles en directo y fallaban al
    // cargarlas. Ahora se cuentan las claves.
    const isPlainHttp = mediaSource.Protocol === 'Http'
        && Object.keys(mediaSource.RequiredHttpHeaders ?? {}).length === 0;
    if (!isPlainHttp) {
        return false;
    }

    // Si es la única forma de reproducirlo, se intenta aunque la ruta pueda no
    // ser alcanzable: mejor intentarlo que negarse.
    if (!mediaSource.SupportsDirectStream && !mediaSource.SupportsTranscoding) {
        return true;
    }

    return isHostReachable(mediaSource, apiClient);
}

/** Muestra el error de reproducción que ha devuelto el servidor. */
export function showPlaybackInfoErrorMessage(errorCode: string): void {
    void alert({
        text: globalize.translate(errorCode),
        title: globalize.translate('HeaderPlaybackError')
    });
}

/**
 * ¿La respuesta del servidor es utilizable? Si no, avisa al usuario.
 *
 * La clave de "NoCompatibleStream" se mantiene con su nombre histórico para no
 * tener que retraducir el mensaje en todos los idiomas.
 */
export function validatePlaybackInfoResult(result: PlaybackInfoResponse): boolean {
    if (!result.ErrorCode) {
        return true;
    }

    const errMessage = result.ErrorCode === PlaybackErrorCode.NoCompatibleStream ?
        'PlaybackErrorNoCompatibleStream' :
        `PlaybackError.${result.ErrorCode}`;
    showPlaybackInfoErrorMessage(errMessage);
    return false;
}
