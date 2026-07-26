import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';

import type { PlayTarget } from 'types/playTarget';

/**
 * Vista estructural del objeto "player" del sistema de reproducción.
 *
 * Los players son plugins (htmlvideoplayer, htmlaudioplayer, sesiones
 * remotas…) que cumplen un contrato implícito: nadie lo declaró nunca, cada
 * uno implementa lo que necesita y el resto se comprueba con `if (player.x)`.
 * Por eso casi todo es opcional — así el tipo describe la realidad en vez de
 * un ideal, y los `if` siguen siendo necesarios.
 *
 * Solo se declara lo que consumen los módulos extraídos de `playbackmanager`.
 * Al mover más código aquí, este tipo irá creciendo.
 */
export interface Player {
    name: string;
    id: string;
    isLocalPlayer?: boolean;

    /** Los players remotos exponen sus propios destinos; los locales, no. */
    getTargets?: () => Promise<PlayTarget[]>;
    canPlayMediaType: (mediaType: string) => boolean;

    /** Si el player gestiona su cola, el manager no lleva la suya. */
    getPlaylist?: () => Promise<BaseItemDto[]>;
    getPlaylistSync?: () => QueueItem[];

    duration?: () => number;
}

/** Item de la cola tal como lo maneja PlayQueueManager. */
export interface QueueItem extends BaseItemDto {
    PlaylistItemId?: string;
}

/**
 * Vista estructural del PlaybackManager para los módulos extraídos.
 *
 * Se declara aquí, y no se importa la clase, por dos motivos: el manager sigue
 * siendo JavaScript sin tipos, y así cada módulo depende de lo poco que usa en
 * vez de del monolito entero.
 */
export interface PlaybackManagerLike {
    _currentPlayer?: Player | null;
    _playQueueManager: { getPlaylist: () => QueueItem[] };
    getPlayers: () => Player[];
    getSupportedCommands: (player: Player) => string[];
}

/** Tipos de medio que se consultan al construir un destino. */
export const TARGET_MEDIA_TYPES: readonly MediaType[] = [
    MediaType.Audio,
    MediaType.Video,
    MediaType.Photo,
    MediaType.Book
];
