import Events from 'utils/events';

import type { Player } from '../types/player';

/**
 * Eventos del player que solo hay que trasladar al servidor.
 *
 * Son los que no cambian nada por dentro: el usuario pausa, sube el volumen o
 * reordena la cola, y lo único que toca es que el servidor se entere para
 * mantener al día la sesión y el "reproduciendo ahora" de los demás clientes.
 *
 * Estaban escritos como nueve funciones idénticas —cada una un
 * `sendProgressUpdate(this, 'su-nombre')`— y enganchadas dos veces, una por
 * cada rama de `initMediaPlayer`. Aquí es una tabla y un bucle.
 */

/** Un evento del player que se informa como progreso. */
export interface ProgressEventBinding {
    /** Nombre del evento que emite el player, y con el que viaja al servidor. */
    event: string;
    /**
     * Adjunta la cola entera al informe. Solo para los cambios de cola: el
     * servidor necesita la lista nueva, no basta con saber que cambió.
     */
    reportPlaylist?: boolean;
}

export const PLAYER_PROGRESS_EVENTS: readonly ProgressEventBinding[] = [
    { event: 'timeupdate' },
    { event: 'pause' },
    { event: 'unpause' },
    { event: 'volumechange' },
    { event: 'repeatmodechange' },
    { event: 'shufflequeuemodechange' },
    { event: 'playlistitemmove', reportPlaylist: true },
    { event: 'playlistitemremove', reportPlaylist: true },
    { event: 'playlistitemadd', reportPlaylist: true }
];

/** Envía un informe de progreso. Lo implementa el manager. */
export type SendProgressUpdate = (
    player: Player,
    progressEventName: string,
    reportPlaylist?: boolean
) => void;

/**
 * Engancha al player todos los eventos de la tabla.
 *
 * No hay forma de desengancharlos porque nunca hizo falta: los players se
 * registran una vez al arrancar y no se dan de baja.
 */
export function bindProgressEvents(player: Player, send: SendProgressUpdate): void {
    for (const { event, reportPlaylist } of PLAYER_PROGRESS_EVENTS) {
        Events.on(player, event, () => {
            send(player, event, reportPlaylist);
        });
    }
}
