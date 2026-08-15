import type { Api } from '@jellyfin/sdk';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { LocationType } from '@jellyfin/sdk/lib/generated-client/models/location-type';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import * as userSettings from 'scripts/settings/userSettings';
import { getItems } from 'utils/sdk/getItems';

/**
 * Consultas al servidor para armar la cola de reproducción.
 *
 * Cuando el usuario pulsa "reproducir" sobre una serie, una lista o un género,
 * hay que traducir eso a la lista concreta de items que se van a reproducir.
 * Aquí están esas consultas y los ajustes que llevan todas.
 */

/** `limit` con este valor pide la lista entera, sin tope. */
export const UNLIMITED_ITEMS = -1;

/** Tope por defecto cuando no se pide uno: evita colas inmanejables. */
const DEFAULT_ITEM_LIMIT = 300;

/** Respuesta de un listado de items. */
export interface ItemsResult {
    Items?: BaseItemDto[];
    TotalRecordCount?: number;
}

/** Consulta de items, tal como la acepta el SDK. */
export type PlaybackQuery = Omit<LibraryApiGetItemsRequest, 'userId'>;

/**
 * Trae los items que se van a reproducir.
 *
 * Un solo id se pide directamente (más barato que un listado) y el resto pasa
 * por la consulta general, a la que se le añaden los campos que necesita el
 * reproductor: capítulos y trickplay para la barra de progreso, y fuera las
 * ubicaciones virtuales, que no tienen fichero detrás.
 */
export function getItemsForPlayback(
    serverId: string,
    query: PlaybackQuery
): Promise<ItemsResult> {
    const api = ServerConnections.getApi(serverId);
    if (!api) {
        return Promise.reject(new Error(`Sin conexión al servidor ${serverId}`));
    }

    const userId = ServerConnections.getCurrentUserId(serverId);
    const ids = query.ids ?? [];
    if (ids.length === 1) {
        return getLibraryApi(api).getItem({ itemId: ids[0], userId })
            .then(({ data }) => ({ Items: [data], TotalRecordCount: 1 }));
    }

    return getItems(api, {
        ...query,
        userId,
        limit: query.limit === UNLIMITED_ITEMS ? undefined : (query.limit || DEFAULT_ITEM_LIMIT),
        fields: [ItemFields.Chapters, ItemFields.Trickplay],
        excludeLocationTypes: [LocationType.Virtual],
        // El total no se usa para reproducir y cuesta un recuento en el servidor.
        enableTotalRecordCount: false,
        collapseBoxSetItems: false
    });
}

/**
 * Combina dos consultas asegurando que nunca se cuelan carpetas.
 *
 * Reproducir una carpeta no significa nada: lo que se reproduce es su
 * contenido, así que `IsNotFolder` va siempre, lo pida quien lo pida.
 */
export function mergePlaybackQueries(
    base: PlaybackQuery,
    overrides: PlaybackQuery
): PlaybackQuery {
    const query = { ...base, ...overrides };

    const filters = query.filters ?? [];

    return {
        ...query,
        filters: filters.includes(ItemFilter.IsNotFolder) ? filters : [...filters, ItemFilter.IsNotFolder]
    };
}

/** ¿El item viene del servidor, o es una URL suelta que se le ha pasado? */
export function isServerItem(item: BaseItemDto): boolean {
    return !!item.Id;
}

/**
 * ¿Toca poner intros (modo cine) antes de este item?
 *
 * Solo para vídeo del servidor, y nunca en directo: en un canal de TV o en una
 * grabación en curso el usuario espera imagen ya.
 */
export function enableIntros(item: BaseItemDto): boolean {
    if (item.MediaType !== 'Video') return false;
    if (item.Type === 'TvChannel') return false;
    if ((item as BaseItemDto & { Status?: string }).Status === 'InProgress') return false;

    return isServerItem(item);
}

/** Opciones de reproducción que deciden si procede poner intros. */
interface IntroOptions {
    startPositionTicks?: number;
    startIndex?: number;
    fullscreen?: boolean;
}

const NO_INTROS: ItemsResult = { Items: [] };

/**
 * Intros que preceden al item, si el modo cine está activo.
 *
 * No se ponen si la reproducción no empieza por el principio (retomar, saltar
 * a un índice) ni si se pide fuera de pantalla completa: en esos casos el
 * usuario va a algo concreto. Un fallo al pedirlas no impide reproducir.
 */
export function getIntros(
    firstItem: BaseItemDto,
    api: Api,
    options: IntroOptions
): Promise<ItemsResult> {
    const skip = options.startPositionTicks
        || options.startIndex
        || options.fullscreen === false
        || !enableIntros(firstItem)
        || !userSettings.enableCinemaMode();

    if (skip) {
        return Promise.resolve(NO_INTROS);
    }

    return getLibraryApi(api).getIntros({
        itemId: firstItem.Id as string,
        userId: ServerConnections.getCurrentUserId(firstItem.ServerId ?? undefined)
    })
        .then(({ data }) => data)
        .catch(() => NO_INTROS);
}
