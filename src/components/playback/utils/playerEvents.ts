import Screenfull from 'screenfull';

import type { PlayTarget } from 'types/playTarget';
import Events from 'utils/events';

import type { Player } from '../types/player';

/**
 * Puentes entre los eventos del navegador / del manager y los del player.
 *
 * Se agrupan aquí para que se vea de un vistazo qué eventos emite el sistema
 * de reproducción y desde dónde.
 */

/**
 * Reemite el cambio de pantalla completa del navegador como evento del player.
 *
 * Safari en iOS no implementa la Fullscreen API estándar que envuelve
 * Screenfull, así que ahí se escucha el evento con prefijo directamente.
 */
export function bindToFullscreenChange(player: Player): void {
    const notify = () => {
        Events.trigger(player, 'fullscreenchange');
    };

    if (Screenfull.isEnabled) {
        Screenfull.on('change', notify);
    } else {
        document.addEventListener('webkitfullscreenchange', notify, false);
    }
}

/**
 * Anuncia que ha cambiado el player o el destino activos.
 *
 * Se calla en dos casos que no son cambios reales: cuando no había player
 * antes ni lo hay ahora, y cuando el destino es el mismo de antes (pasa al
 * reconectar con la misma sesión remota).
 */
export function triggerPlayerChange(
    instance: object,
    newPlayer: Player | null | undefined,
    newTarget: PlayTarget | null | undefined,
    previousPlayer: Player | null | undefined,
    previousTargetInfo: PlayTarget | null | undefined
): void {
    if (!newPlayer && !previousPlayer) {
        return;
    }

    if (newTarget && previousTargetInfo && newTarget.id === previousTargetInfo.id) {
        return;
    }

    Events.trigger(instance, 'playerchange', [newPlayer, newTarget, previousPlayer]);
}
