import type { PlayTarget } from 'types/playTarget';

import {
    TARGET_MEDIA_TYPES,
    type PlaybackManagerLike,
    type Player
} from '../types/player';

/**
 * Destinos de reproducción: la lista de "dónde reproducir" que ve el usuario
 * en el selector de dispositivo (este navegador, un Chromecast, otra sesión…).
 *
 * Cada player aporta sus destinos. Los remotos los enumeran ellos mismos
 * (`getTargets`); los locales son un único destino que se construye aquí.
 */

/**
 * ¿Este player aporta destinos propios a la lista?
 *
 * El player local no: ya está representado por el destino "este dispositivo",
 * así que listarlo otra vez lo duplicaría.
 */
export function displayPlayerIndividually(player: Player): boolean {
    return !player.isLocalPlayer;
}

/**
 * Construye el destino que representa a un player.
 *
 * `playableMediaTypes` se filtra, no se mapea: el código original hacía
 * `['Audio','Video','Photo','Book'].map(player.canPlayMediaType)`, que produce
 * un array de booleanos donde el tipo declara `MediaType[]`. Pasaba
 * desapercibido porque hoy nadie lee el campo.
 */
export function createTarget(instance: PlaybackManagerLike, player: Player): PlayTarget {
    return {
        name: player.name,
        id: player.id,
        playerName: player.name,
        playableMediaTypes: TARGET_MEDIA_TYPES.filter(
            (mediaType) => player.canPlayMediaType(mediaType)
        ),
        isLocalPlayer: player.isLocalPlayer,
        supportedCommands: instance.getSupportedCommands(player)
    };
}

/**
 * Destinos que aporta un player: los suyos si los enumera, y si no, el único
 * destino que lo representa.
 */
export function getPlayerTargets(
    instance: PlaybackManagerLike,
    player: Player
): Promise<PlayTarget[]> {
    if (player.getTargets) {
        return player.getTargets();
    }

    return Promise.resolve([createTarget(instance, player)]);
}

/**
 * Nombre de destino en forma comparable.
 *
 * Se usa para casar el nombre que escribe el usuario con el del dispositivo,
 * donde no deberían importar ni mayúsculas ni espacios.
 *
 * El original usaba `replace(' ', '')`, que en JavaScript solo quita la
 * PRIMERA aparición: "Salón de Estar" quedaba en "salónde estar" y no casaba
 * con nada. Se quitan todas (con split/join, porque el `lib` del tsconfig
 * llega a ES2020 y `replaceAll` es ES2021).
 */
export function normalizeName(name: string): string {
    return name.toLowerCase().split(' ').join('');
}

/**
 * Ordena los destinos dejando primero el local y luego el resto por nombre.
 *
 * El truco del prefijo "0"/"1" hace las dos cosas en una sola comparación de
 * cadenas: el dígito agrupa y el nombre desempata dentro del grupo.
 */
export function sortPlayerTargets(a: PlayTarget, b: PlayTarget): number {
    const aVal = (a.isLocalPlayer ? 0 : 1).toString() + a.name;
    const bVal = (b.isLocalPlayer ? 0 : 1).toString() + b.name;

    return aVal.localeCompare(bVal);
}
