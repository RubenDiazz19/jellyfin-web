// Resultado de intentar conectar con un servidor. Lo produce el `connect()` de
// esta misma capa, así que el tipo vive aquí y no en la declaración del paquete
// `jellyfin-apiclient`: era nuestro desde el principio, solo que declarado en el
// sitio equivocado.

import type { ConnectionState } from './connectionState';
import type ServerHandle from './serverHandle';

export interface ConnectResponse {
    /**
     * El servidor con el que se ha conectado.
     *
     * Aquí vivió `ConnectedServerHandle`, una interfaz que describía por forma
     * los dos getters que los consumidores leían de esto. Existía porque detrás
     * había una clase de un paquete de terceros y describirla por forma era lo
     * que permitía cambiarla sin tocar a quien la recibe. Cumplido ese cambio
     * —el de detrás es ahora `ServerHandle`, nuestro y en este mismo
     * directorio—, mantener un espejo escrito a mano de una clase propia solo
     * sería una copia que se desincroniza.
     */
    ApiClient: ServerHandle;
    Servers: unknown[];
    State: ConnectionState;
}
