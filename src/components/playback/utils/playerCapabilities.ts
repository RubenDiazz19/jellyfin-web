import { appHost } from 'components/apphost';
import { AppFeature } from 'constants/appFeature';

import type { PlaybackManagerLike, Player } from '../types/player';

/**
 * Qué sabe hacer un player y quién se encarga de qué.
 *
 * Los players no declaran capacidades: se deducen de qué métodos implementan
 * y de si son locales o remotos. Estas preguntas estaban repartidas por
 * `playbackmanager`; aquí quedan juntas y con el porqué escrito.
 */

/**
 * ¿La cola la lleva el manager en vez del player?
 *
 * Un player que implementa `getPlaylist` gestiona su propia cola (una sesión
 * remota mantiene la suya en el otro extremo). Si no la implementa, y es
 * local, la cola es cosa del manager.
 */
export function enableLocalPlaylistManagement(player: Player): boolean {
    if (player.getPlaylist) {
        return false;
    }

    return !!player.isLocalPlayer;
}

/**
 * ¿El volumen lo controlan los botones físicos del dispositivo?
 *
 * Cuando es así, la app no debe pintar su propio deslizador de volumen: sería
 * un segundo control que no refleja el del sistema.
 */
export function supportsPhysicalVolumeControl(player: Player): boolean {
    return !!player.isLocalPlayer && appHost.supports(AppFeature.PhysicalVolumeControl);
}

/**
 * ¿Puede este player recibir reproducción sin que el usuario lo elija?
 *
 * Solo el local. Mandar algo a un dispositivo remoto es siempre una decisión
 * explícita del usuario.
 */
export function isAutomaticPlayer(player: Player): boolean {
    return !!player.isLocalPlayer;
}

/**
 * Players a los que se puede mandar reproducción sin preguntar.
 *
 * Si ya hay uno activo que no es automático (una sesión remota), manda ese: el
 * usuario lo eligió y lo que reproduzca debe seguir yendo allí.
 * `forceLocalPlayer` salta esa regla para lo que tiene que sonar aquí sí o sí.
 */
export function getAutomaticPlayers(
    instance: PlaybackManagerLike,
    forceLocalPlayer?: boolean
): Player[] {
    if (!forceLocalPlayer) {
        const player = instance._currentPlayer;
        if (player && !isAutomaticPlayer(player)) {
            return [player];
        }
    }

    return instance.getPlayers().filter(isAutomaticPlayer);
}
