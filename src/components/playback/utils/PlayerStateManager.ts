import type { StreamInfo } from '../types/streamInfo';
import type { Player } from '../types/player';

/**
 * Estado que el manager lleva de cada player.
 *
 * Es lo que el manager necesita recordar entre eventos y que el player no
 * expone: qué se está reproduciendo exactamente, qué pistas se eligieron y si
 * hay un cambio de calidad en curso.
 */
export interface PlayerState {
    /** Stream en curso: URL, fuente, método de reproducción, pistas de texto. */
    streamInfo?: StreamInfo;
    audioStreamIndex?: number | null;
    subtitleStreamIndex?: number | null;
    secondarySubtitleStreamIndex?: number | null;
    /** Techo de bitrate con el que se resolvió este stream. */
    maxStreamingBitrate?: number;
    /**
     * Hay un cambio de stream en curso (cambio de calidad o de pista que
     * obliga a rehacer la petición). Sirve para que la parada intermedia del
     * player no se confunda con el final de la reproducción.
     */
    isChangingStream?: boolean;
}

/**
 * Guarda el estado de reproducción de cada player.
 *
 * **Antes esto no funcionaba.** El manager tenía un objeto `playerStates` y una
 * función `getPlayerData()` que buscaba en él… y devolvía `player` en vez del
 * estado encontrado. Resultado: el mapa se rellenaba de objetos vacíos que no
 * leía nadie y todo el estado acababa pegado al propio objeto del player.
 *
 * Funcionaba de casualidad —lecturas y escrituras iban al mismo sitio, el
 * player— pero con dos consecuencias: el manager ensuciaba objetos que no son
 * suyos, y el mapa crecía sin sentido. Aquí el estado vive donde debía.
 *
 * Se indexa por el objeto del player, no por su nombre: así un player que se
 * vuelve a crear arranca con estado limpio, que es lo que pasaba antes al
 * vivir el estado en el propio objeto.
 */
export class PlayerStateManager {
    private readonly states = new Map<Player, PlayerState>();

    /**
     * Estado del player, creándolo vacío la primera vez.
     *
     * Se devuelve el objeto vivo a propósito: quien llama escribe sobre él
     * (`state.streamInfo = …`), igual que hacía el código original.
     */
    get(player: Player): PlayerState {
        if (!player) {
            throw new Error('player cannot be null');
        }
        if (!player.name) {
            throw new Error('player name cannot be null');
        }

        let state = this.states.get(player);
        if (!state) {
            state = {};
            this.states.set(player, state);
        }

        return state;
    }

    /**
     * Cuántos players tienen estado guardado.
     *
     * No hay forma de dar de baja un player —el manager nunca los quita de su
     * lista—, así que el mapa crece como mucho hasta el número de players
     * registrados. Se expone para poder comprobar justo eso.
     */
    get size(): number {
        return this.states.size;
    }
}
