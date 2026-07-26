import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import merge from 'lodash-es/merge';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import * as userSettings from 'scripts/settings/userSettings';
import { getItems } from 'utils/jellyfin-apiclient/getItems';

/**
 * Consultas al servidor para armar la cola de reproducción.
 *
 * Cuando el usuario pulsa "reproducir" sobre una serie, una lista o un género,
 * hay que traducir eso a la lista concreta de items que se van a reproducir.
 * Aquí están esas consultas y los ajustes que llevan todas.
 */

/** `Limit` con este valor pide la lista entera, sin tope. */
export const UNLIMITED_ITEMS = -1;

/** Tope por defecto cuando no se pide uno: evita colas inmanejables. */
const DEFAULT_ITEM_LIMIT = 300;

/** Respuesta de un listado de items. */
export interface ItemsResult {
    Items?: BaseItemDto[];
    TotalRecordCount?: number;
}

/** Consulta de items, tal como la acepta el ApiClient legacy. */
export type PlaybackQuery = Record<string, unknown> & {
    Ids?: string;
    Limit?: number;
    Filters?: string;
};

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
    const apiClient = ServerConnections.getApiClient(serverId);
    if (!apiClient) {
        return Promise.reject(new Error(`Sin conexión al servidor ${serverId}`));
    }

    const ids = query.Ids ? query.Ids.split(',') : [];
    if (ids.length === 1) {
        // El original pasaba aquí el array entero en vez de su único elemento;
        // colaba porque el ApiClient lo interpola en la URL y un array de uno
        // se convierte en ese mismo id.
        return apiClient.getItem(apiClient.getCurrentUserId(), ids[0])
            .then((item: BaseItemDto) => ({ Items: [item], TotalRecordCount: 1 }));
    }

    if (query.Limit === UNLIMITED_ITEMS) {
        delete query.Limit;
    } else {
        query.Limit = query.Limit || DEFAULT_ITEM_LIMIT;
    }

    query.Fields = ['Chapters', 'Trickplay'];
    query.ExcludeLocationTypes = 'Virtual';
    // El total no se usa para reproducir y cuesta un recuento en el servidor.
    query.EnableTotalRecordCount = false;
    query.CollapseBoxSetItems = false;

    return getItems(apiClient, apiClient.getCurrentUserId(), query);
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
    const query: PlaybackQuery = merge({}, base, overrides);

    const filters = query.Filters?.split(',') || [];
    if (!filters.includes(ItemFilter.IsNotFolder)) {
        filters.push(ItemFilter.IsNotFolder);
    }
    query.Filters = filters.join(',');

    return query;
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

/** ApiClient legacy: aquí solo se piden las intros. */
interface IntrosApiClient {
    getIntros: (itemId: string) => Promise<ItemsResult>;
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
    apiClient: IntrosApiClient,
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

    return apiClient.getIntros(firstItem.Id as string)
        .catch(() => NO_INTROS);
}
