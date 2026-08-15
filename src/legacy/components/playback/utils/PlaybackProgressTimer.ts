import type { Player } from '../types/player';

/**
 * Cada cuánto se le recuerda al servidor por dónde va la reproducción.
 *
 * Diez segundos es el compromiso de siempre: suficiente para que "seguir
 * viendo" quede razonablemente al día si el cliente se cierra de golpe, y poco
 * suficiente como para no cargar al servidor. El player también informa por su
 * cuenta en cada pausa, cambio de volumen o de pista.
 */
export const PROGRESS_REPORT_INTERVAL_MS = 10_000;

/**
 * Latido de progreso de cada player.
 *
 * El identificador del `setInterval` se guardaba como `player._progressInterval`
 * —otro campo del manager pegado a un objeto que no es suyo, como pasaba con
 * el estado antes de `PlayerStateManager`—. Aquí vive donde le corresponde.
 */
export class PlaybackProgressTimer {
    private readonly timers = new Map<Player, ReturnType<typeof setInterval>>();

    /**
     * Arranca (o reinicia) el latido de un player.
     *
     * Reiniciar es lo correcto al empezar una pista nueva: se cuenta desde
     * cero en vez de heredar lo que quedaba del intervalo anterior.
     */
    start(player: Player, tick: () => void): void {
        this.stop(player);
        this.timers.set(player, setInterval(tick, PROGRESS_REPORT_INTERVAL_MS));
    }

    /** Para el latido. Parar uno que no estaba corriendo no hace nada. */
    stop(player: Player): void {
        const timer = this.timers.get(player);
        if (timer === undefined) return;

        clearInterval(timer);
        this.timers.delete(player);
    }

    /** Cuántos players están informando. Se expone para poder comprobarlo. */
    get active(): number {
        return this.timers.size;
    }
}
