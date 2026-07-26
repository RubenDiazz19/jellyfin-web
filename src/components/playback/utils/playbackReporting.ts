import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { TICKS_PER_MILLISECOND } from 'constants/time';
import Events from 'utils/events';

import type { PlaybackManagerLike, Player, QueueItem } from '../types/player';
import { enableLocalPlaylistManagement } from './playerCapabilities';

/**
 * Informes de reproducción al servidor.
 *
 * El servidor necesita saber qué se está reproduciendo y por dónde va para
 * mantener el progreso, la lista de "seguir viendo" y las sesiones remotas.
 * Aquí se arma ese informe y se envía; cuándo enviarlo lo decide el manager.
 */

/** Entrada de la cola tal como viaja en el informe. */
interface ReportedQueueItem {
    Id?: string;
    PlaylistItemId?: string;
    /** Solo se manda si el item vive en otro servidor que el de la sesión. */
    ServerId?: string;
}

/** Informe que espera el servidor (PlayState más los añadidos del cliente). */
export interface PlaybackReport {
    ItemId?: string;
    EventName?: string;
    NowPlayingQueue?: ReportedQueueItem[];
    [field: string]: unknown;
}

/** Estado que el manager pasa al construir el informe. */
export interface ReportableState {
    NowPlayingItem?: BaseItemDto;
    PlayState?: Record<string, unknown>;
}

/** Métodos del ApiClient que aceptan un informe de reproducción. */
export type ReportMethod =
    | 'reportPlaybackStart'
    | 'reportPlaybackProgress'
    | 'reportPlaybackStopped';

/**
 * Cola actual: la del player si la gestiona él, y si no, la del manager.
 *
 * Es síncrona a propósito — se llama desde el camino del informe, que no
 * puede esperar a una promesa sin desincronizar el progreso.
 */
export function getPlaylistSync(
    instance: PlaybackManagerLike,
    player?: Player | null
): QueueItem[] {
    const target = player || instance._currentPlayer;
    if (target && !enableLocalPlaylistManagement(target)) {
        return target.getPlaylistSync?.() ?? [];
    }

    return instance._playQueueManager.getPlaylist();
}

/**
 * Añade la cola al informe para que el servidor pueda pintarla en las
 * sesiones remotas ("a continuación" en otro dispositivo).
 */
export function addPlaylistToPlaybackReport(
    instance: PlaybackManagerLike,
    info: PlaybackReport,
    player: Player | null | undefined,
    serverId: string
): void {
    info.NowPlayingQueue = getPlaylistSync(instance, player).map((item) => {
        const itemInfo: ReportedQueueItem = {
            Id: item.Id,
            PlaylistItemId: item.PlaylistItemId
        };

        // Solo cuando difiere: en el caso normal el servidor ya lo sabe.
        if (item.ServerId !== serverId) {
            itemInfo.ServerId = item.ServerId ?? undefined;
        }

        return itemInfo;
    });
}

/**
 * Envía un informe de reproducción al servidor.
 *
 * Emite `reportplayback` en los dos desenlaces: con `false` si el item no es
 * del servidor (reproducción local, nada que informar) y con `true` cuando el
 * envío ha ido bien. Hay quien escucha ese evento para saber que el servidor
 * está al día.
 */
export function reportPlayback(
    instance: PlaybackManagerLike,
    state: ReportableState,
    player: Player | null | undefined,
    reportPlaylist: boolean,
    serverId: string | null | undefined,
    method: ReportMethod,
    progressEventName?: string
): void {
    if (!serverId) {
        // No es un item del servidor. Se podría ampliar más adelante para
        // informar también de estos.
        Events.trigger(instance, 'reportplayback', [false]);
        return;
    }

    const info: PlaybackReport = { ...state.PlayState };
    info.ItemId = state.NowPlayingItem?.Id;

    if (progressEventName) {
        info.EventName = progressEventName;
    }

    if (reportPlaylist) {
        addPlaylistToPlaybackReport(instance, info, player, serverId);
    }

    const apiClient = ServerConnections.getApiClient(serverId);
    if (!apiClient) {
        // Anomalía: hay serverId pero no hay cliente para ese servidor (sesión
        // cerrada a media reproducción). No se puede informar, así que se
        // avisa igual que en el caso de item no-servidor.
        console.warn('[playbackReporting] sin ApiClient para el servidor', serverId);
        Events.trigger(instance, 'reportplayback', [false]);
        return;
    }

    void apiClient[method](info).then(() => {
        Events.trigger(instance, 'reportplayback', [true]);
    });
}

/**
 * Item "en reproducción" tal como se informa.
 *
 * Se copia el item y se le superponen los datos de la fuente elegida: la
 * duración y las pistas dependen de la versión concreta que se reproduce, no
 * del item en abstracto. `MediaSources` se descarta porque el servidor no la
 * necesita y abulta el informe.
 */
export function getNowPlayingItemForReporting(
    player: Player,
    item: BaseItemDto,
    mediaSource?: MediaSourceInfo | null
): BaseItemDto {
    const nowPlayingItem: BaseItemDto = { ...item };

    if (mediaSource) {
        nowPlayingItem.RunTimeTicks = mediaSource.RunTimeTicks;
        nowPlayingItem.MediaStreams = mediaSource.MediaStreams;
        nowPlayingItem.MediaSources = null;
    }

    // Último recurso: el player sí sabe la duración real aunque el item no la
    // traiga (ficheros sin metadatos). `duration()` va en milisegundos; el
    // original multiplicaba por un 10000 suelto.
    nowPlayingItem.RunTimeTicks = nowPlayingItem.RunTimeTicks
        || (player.duration?.() ?? 0) * TICKS_PER_MILLISECOND;

    return nowPlayingItem;
}
