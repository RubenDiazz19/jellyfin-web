import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import type { StreamInfo } from '../types/streamInfo';

/**
 * Opciones de reproducción: normalizarlas y quedarse con lo que hay que
 * conservar de una pista a la siguiente.
 */

/** Opciones con las que se pide reproducir algo. */
export interface PlayOptions {
    fullscreen?: boolean;
    aspectRatio?: string;
    mediaSourceId?: string;
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    startPositionTicks?: number;
    [option: string]: unknown;
}

/**
 * Rellena los valores implícitos. Muta el objeto recibido a propósito: quien
 * llama sigue usando esa misma referencia después.
 *
 * Pantalla completa es el comportamiento por defecto, así que solo se
 * desactiva si se pide explícitamente `false` (no basta con omitirla).
 */
export function normalizePlayOptions(playOptions: PlayOptions): void {
    playOptions.fullscreen = playOptions.fullscreen !== false;
}

/**
 * Recorta las opciones a las que deben sobrevivir al cambio de pista.
 *
 * Al pasar de un episodio al siguiente se hereda cómo se está viendo (relación
 * de aspecto, pantalla completa, pistas elegidas) pero no las que solo valían
 * para el item anterior.
 */
export function truncatePlayOptions(playOptions: PlayOptions): PlayOptions {
    return {
        aspectRatio: playOptions.aspectRatio,
        fullscreen: playOptions.fullscreen,
        mediaSourceId: playOptions.mediaSourceId,
        audioStreamIndex: playOptions.audioStreamIndex,
        subtitleStreamIndex: playOptions.subtitleStreamIndex,
        startPositionTicks: playOptions.startPositionTicks
    };
}

/**
 * Info de stream para un item que ya trae su URL.
 *
 * Es el caso de lo que no viene del servidor (una URL suelta, contenido
 * local): no hay nada que negociar, se reproduce tal cual.
 */
export function createStreamInfoFromUrlItem(item: BaseItemDto): StreamInfo {
    return {
        // `Path` cubre los items locales, que no traen `Url`.
        url: (item as BaseItemDto & { Url?: string }).Url || item.Path,
        playMethod: 'DirectPlay',
        item,
        textTracks: [],
        mediaType: item.MediaType
    } as StreamInfo;
}
